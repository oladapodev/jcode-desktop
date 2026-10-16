//! The fresh-session home screen, after the prototype's `Home.tsx`: a
//! greeting, the hero composer, context chips for where the session starts,
//! starter cards that prefill the composer, and recent sessions.
//!
//! Everything here wires to existing actions: the folder picker, machine
//! picker (`/ssh`), the sidebar's worktree form and session activation.
use super::*;
use std::cell::RefCell;
use std::path::Path;

/// Width of the home column and of the composer that leaves it on submit.
pub(crate) const COLUMN_WIDTH: f32 = 656.0;
/// Horizontal breathing room around the column, shared with the startup
/// layout so the composer keeps its exact width when the first prompt lands.
/// Narrow panels give the composer's controls the room instead.
pub(crate) fn side_padding(window: &Window) -> f32 {
    if window.viewport_size().width < px(560.) { 16. } else { 24. }
}
const RECENT_LIMIT: usize = 3;

/// Starter cards: icon, title, one faint line and the prompt they prefill.
pub(crate) const STARTS: [(&[u8], &str, &str, &str); 4] = [
    (BUG_ICON, "Fix a failing test", "Run the suite, find the cause, patch it", "Run the tests and fix whatever fails"),
    (NETWORK_ICON, "Split work across agents", "A swarm takes the big task in parallel", "/swarm "),
    (SCAN_ICON, "Review my changes", "A second opinion on the current diff", "/review"),
    (MOON_ICON, "Work while I sleep", "Runs overnight, reports in the morning", "/overnight "),
];

/// Recent top-level sessions, newest first, published by the workspace so a
/// panel can list them without depending on it.
#[derive(Default)]
pub(crate) struct HomeSessions(pub Arc<Vec<jcode_sdk::SessionInfo>>);
impl gpui::Global for HomeSessions {}

pub(crate) fn publish(sessions: &[jcode_sdk::SessionInfo], cx: &mut App) {
    let mut recent = sessions
        .iter()
        .filter(|s| {
            !s.archived
                && s.parent_session_id.is_none()
                && !Panel::is_pending_session_id(&s.session_id)
                && !s.session_id.contains("://")
        })
        .cloned()
        .collect::<Vec<_>>();
    recent.sort_by(|a, b| {
        recency(b)
            .cmp(&recency(a))
            .then_with(|| a.session_id.cmp(&b.session_id))
    });
    let mut seen = HashSet::new();
    recent.retain(|s| seen.insert(s.session_id.clone()));
    recent.truncate(RECENT_LIMIT + 5);
    if cx
        .try_global::<HomeSessions>()
        .is_some_and(|current| *current.0 == recent)
    {
        return;
    }
    cx.set_global(HomeSessions(Arc::new(recent)));
    cx.refresh_windows();
}

fn recency(session: &jcode_sdk::SessionInfo) -> i64 {
    session
        .last_active_at_ms
        .or(session.updated_at_ms)
        .unwrap_or_default()
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
enum State {
    Working,
    Waiting,
    Failed,
    Finished,
    Quiet,
}

fn state_of(status: &str) -> State {
    match status.to_ascii_lowercase().as_str() {
        "working" | "running" | "running_tools" | "thinking" | "streaming" => State::Working,
        "waiting" | "needs_input" | "needs-input" | "awaiting_input" | "blocked" => State::Waiting,
        "failed" | "error" | "crashed" => State::Failed,
        "idle" | "ready" | "completed" | "done" | "finished" => State::Finished,
        _ => State::Quiet,
    }
}

fn number_word(n: usize) -> String {
    const WORDS: [&str; 10] = [
        "no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine",
    ];
    WORDS.get(n).map(|w| (*w).to_owned()).unwrap_or_else(|| n.to_string())
}

fn capitalize(text: &str) -> String {
    let mut chars = text.chars();
    match chars.next() {
        Some(first) => first.to_uppercase().chain(chars).collect(),
        None => String::new(),
    }
}

/// One calm line about live work, or nothing when nothing needs attention.
fn summary(working: usize, waiting: usize) -> Option<String> {
    let agents = |n: usize| {
        format!(
            "{} {} {}",
            number_word(n),
            if n == 1 { "agent" } else { "agents" },
            if n == 1 { "is" } else { "are" }
        )
    };
    let answer = |n: usize| format!("{} {} your answer", number_word(n), if n == 1 { "needs" } else { "need" });
    let line = match (working, waiting) {
        (0, 0) => return None,
        (w, 0) => format!("{} working.", agents(w)),
        (0, n) => format!(
            "{} {} {} your answer.",
            number_word(n),
            if n == 1 { "session" } else { "sessions" },
            if n == 1 { "needs" } else { "need" }
        ),
        (w, n) => format!("{} working and {}.", agents(w), answer(n)),
    };
    Some(capitalize(&line))
}

fn compact_age(seconds: u64) -> String {
    let minutes = seconds / 60;
    match minutes {
        0 => "now".into(),
        1..=59 => format!("{minutes}m"),
        60..=1439 => format!("{}h", minutes / 60),
        1440..=10079 => format!("{}d", minutes / 1440),
        _ => format!("{}w", minutes / 10080),
    }
}

fn age_label(session: &jcode_sdk::SessionInfo) -> Option<String> {
    let at = u64::try_from(session.last_active_at_ms.or(session.updated_at_ms)?).ok()?;
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or_default();
    Some(compact_age(now.saturating_sub(at) / 1_000))
}

fn local_hour() -> u32 {
    #[cfg(unix)]
    {
        // SAFETY: `time` and `localtime_r` only write into the provided,
        // zero-initialised `tm`; no pointers escape.
        unsafe {
            let now = libc::time(std::ptr::null_mut());
            let mut tm: libc::tm = std::mem::zeroed();
            if !libc::localtime_r(&now, &mut tm).is_null() {
                return tm.tm_hour.clamp(0, 23) as u32;
            }
        }
    }
    12
}

fn greeting() -> String {
    let screenshot = crate::harness::screenshot_mode();
    let hour = if screenshot { 9 } else { local_hour() };
    let greet = match hour {
        0..=11 => "Good morning",
        12..=17 => "Good afternoon",
        _ => "Good evening",
    };
    let name = if screenshot {
        Some("dev".to_owned())
    } else {
        std::env::var("USER")
            .or_else(|_| std::env::var("USERNAME"))
            .ok()
            .map(|name| name.trim().to_owned())
            .filter(|name| !name.is_empty() && name != "root")
    };
    match name {
        Some(name) => format!("{greet}, {name}."),
        None => format!("{greet}."),
    }
}

/// Branch checked out in the nearest enclosing repository, read from `.git`
/// (never by spawning Git) and cached briefly so rendering stays cheap.
fn git_branch(directory: &str) -> Option<String> {
    // The prototype demo's projects are not real checkouts on the render host.
    if crate::panel::proto_fixture::enabled() && directory.starts_with("/home/dev/Desktop/") {
        return Some("master".into());
    }
    thread_local! {
        static CACHE: RefCell<HashMap<String, (Instant, Option<String>)>> = RefCell::new(HashMap::new());
    }
    CACHE.with(|cache| {
        let mut cache = cache.borrow_mut();
        if let Some((at, branch)) = cache.get(directory)
            && at.elapsed() < Duration::from_secs(5)
        {
            return branch.clone();
        }
        let branch = probe_branch(Path::new(directory));
        cache.insert(directory.to_owned(), (Instant::now(), branch.clone()));
        branch
    })
}

fn probe_branch(directory: &Path) -> Option<String> {
    for ancestor in directory.ancestors() {
        let marker = ancestor.join(".git");
        let gitdir = if marker.is_dir() {
            marker
        } else if marker.is_file() {
            let contents = std::fs::read_to_string(&marker).ok()?;
            ancestor.join(contents.trim().strip_prefix("gitdir:")?.trim())
        } else {
            continue;
        };
        let head = std::fs::read_to_string(gitdir.join("HEAD")).ok()?;
        let head = head.trim();
        return Some(match head.strip_prefix("ref:") {
            Some(reference) => {
                let reference = reference.trim();
                reference
                    .strip_prefix("refs/heads/")
                    .unwrap_or(reference)
                    .to_owned()
            }
            None => format!("detached {}", head.chars().take(8).collect::<String>()),
        });
    }
    None
}

fn icon(data: &'static [u8], size: f32, color: gpui::Rgba) -> gpui::Svg {
    gpui::svg().data(data).flex_none().size(px(size)).text_color(color)
}

macro_rules! lucide {
    ($body:literal) => {
        concat!(
            r#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">"#,
            $body,
            "</svg>"
        )
        .as_bytes()
    };
}

const FOLDER_ICON: &[u8] = lucide!(r#"<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/><path d="M2 10h20"/>"#);
const CHEVRON_ICON: &[u8] = lucide!(r#"<path d="m6 9 6 6 6-6"/>"#);
const BRANCH_ICON: &[u8] = lucide!(r#"<path d="M6 3v12"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>"#);
const PLUS_ICON: &[u8] = lucide!(r#"<path d="M5 12h14"/><path d="M12 5v14"/>"#);
const CLOUD_ICON: &[u8] = lucide!(r#"<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>"#);
const BUG_ICON: &[u8] = lucide!(r#"<path d="m8 2 1.88 1.88"/><path d="M14.12 3.88 16 2"/><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6"/><path d="M12 20v-9"/><path d="M6.53 9C4.6 8.8 3 7.1 3 5"/><path d="M6 13H2"/><path d="M3 21c0-2.1 1.7-3.9 3.8-4"/><path d="M20.97 5c0 2.1-1.6 3.8-3.5 4"/><path d="M22 13h-4"/><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4"/>"#);
const NETWORK_ICON: &[u8] = lucide!(r#"<rect x="16" y="16" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="9" y="2" width="6" height="6" rx="1"/><path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3"/><path d="M12 12V8"/>"#);
const SCAN_ICON: &[u8] = lucide!(r#"<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><circle cx="12" cy="12" r="1"/><path d="M18.944 12.33a1 1 0 0 0 0-.66 7.5 7.5 0 0 0-13.888 0 1 1 0 0 0 0 .66 7.5 7.5 0 0 0 13.888 0"/>"#);
const MOON_ICON: &[u8] = lucide!(r#"<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>"#);

fn tint(color: gpui::Rgba, alpha: f32) -> gpui::Rgba {
    gpui::Rgba { a: alpha, ..color }
}

fn chip(id: &'static str) -> gpui::Stateful<gpui::Div> {
    let theme = Theme::global();
    div()
        .id(id)
        .debug_selector(move || id.into())
        .h(px(30.))
        .px(px(12.))
        .flex()
        .flex_none()
        .items_center()
        .gap(px(6.))
        .rounded_full()
        .border_1()
        .border_color(theme.PANEL_BORDER)
        .font_family(theme.FONT_UI)
        .text_size(px(12.5))
        .text_color(theme.TEXT_DIM)
        .cursor_pointer()
        .hover(|el| {
            el.border_color(Theme::global().PANEL_BORDER_FOCUS)
                .text_color(Theme::global().TEXT)
        })
}

impl Panel {
    /// Recent sessions other than this one, newest first.
    fn home_recents(&self, cx: &App) -> Vec<jcode_sdk::SessionInfo> {
        cx.try_global::<HomeSessions>()
            .map(|sessions| {
                sessions
                    .0
                    .iter()
                    .filter(|s| s.session_id != self.session_id)
                    .take(RECENT_LIMIT)
                    .cloned()
                    .collect()
            })
            .unwrap_or_default()
    }

    /// Prefill the composer with a starter prompt and focus it.
    pub(super) fn apply_home_suggestion(&mut self, prompt: &str, window: &mut Window, cx: &mut Context<Self>) {
        self.input
            .update(cx, |input, cx| input.set_content(prompt.to_owned(), cx));
        self.focus_input(window, cx);
        cx.notify();
    }

    fn render_home_chips(&self, cx: &mut Context<Self>) -> gpui::AnyElement {
        let theme = Theme::global();
        let remote = crate::harness::remote_host(&self.session_id);
        let directory = self
            .working_dir
            .clone()
            .filter(|dir| !dir.trim().is_empty());
        let branch = directory
            .as_deref()
            .filter(|_| remote.is_none())
            .and_then(git_branch);
        let folder = directory.as_deref().map(|dir| {
            Path::new(dir)
                .file_name()
                .map(|name| name.to_string_lossy().into_owned())
                .unwrap_or_else(|| dir.to_owned())
        });
        let machine = match remote.as_deref() {
            None => "This laptop".to_owned(),
            Some(host) if host == crate::managed_cloud::HOST => "Jcode Cloud".to_owned(),
            Some(host) => host.to_owned(),
        };
        let worktree_dir = directory.clone().filter(|_| branch.is_some());
        let connected = self.status != "disconnected";
        let ring = Theme::global().panel_background(self.surface_focused);
        div()
            .debug_selector(|| "home-chips".into())
            .mt(px(12.))
            .flex()
            .flex_wrap()
            .items_center()
            .gap(px(8.))
            .children(folder.map(|folder| {
                chip("home-chip-folder")
                    .tooltip(|_, cx| cx.new(|_| super::usage::MeterTooltip("Start in another folder".into())).into())
                    .child(icon(FOLDER_ICON, 13., theme.ACCENT))
                    .child(div().max_w(px(180.)).truncate().child(folder))
                    .child(icon(CHEVRON_ICON, 12., theme.TEXT_FAINT))
                    .on_click(cx.listener(|_, _, window, cx| {
                        if let Ok(action) = cx.build_action("workspace::OpenFolder", None) {
                            window.dispatch_action(action, cx);
                        }
                        cx.stop_propagation();
                    }))
            }))
            .child(
                chip("home-chip-machine")
                    .tooltip(|_, cx| cx.new(|_| super::usage::MeterTooltip("Choose where new sessions run".into())).into())
                    .child(if remote.is_some() {
                        icon(CLOUD_ICON, 13., theme.TEXT_DIM).into_any_element()
                    } else {
                        crate::machine_glyph::laptop(
                            15.,
                            theme.ACCENT,
                            Some(crate::machine_glyph::status_color(connected)),
                            ring,
                        )
                        .into_any_element()
                    })
                    .child(
                        div()
                            .when(remote.is_none(), |el| el.text_color(theme.ACCENT))
                            .child(machine),
                    )
                    .child(icon(CHEVRON_ICON, 12., theme.TEXT_FAINT))
                    .on_click(cx.listener(|_, _, window, cx| {
                        let panel = cx.entity();
                        Panel::dispatch_workspace_command(&panel, "/ssh", window, cx);
                        cx.stop_propagation();
                    })),
            )
            .children(branch.map(|branch| {
                chip("home-chip-branch")
                    .cursor_default()
                    .child(icon(BRANCH_ICON, 13., theme.TEXT_DIM))
                    .child(div().max_w(px(160.)).truncate().child(branch))
            }))
            .children(worktree_dir.map(|directory| {
                chip("home-chip-worktree")
                    .text_color(theme.TEXT_FAINT)
                    .tooltip(|_, cx| cx.new(|_| super::usage::MeterTooltip("Start a branch in its own checkout".into())).into())
                    .child(icon(PLUS_ICON, 13., theme.TEXT_FAINT))
                    .child("New worktree")
                    .on_click(cx.listener(move |_, _, window, cx| {
                        window.dispatch_action(
                            Box::new(crate::ui_actions::BeginWorktree {
                                directory: directory.clone(),
                            }),
                            cx,
                        );
                        cx.stop_propagation();
                    }))
            }))
            .into_any_element()
    }

    fn render_home_starts(&self, cx: &mut Context<Self>) -> gpui::AnyElement {
        let theme = Theme::global();
        let single = self.composer_width > 0. && self.composer_width < 460.;
        let card = |index: usize, cx: &mut Context<Self>| {
            let (glyph, title, desc, prompt) = STARTS[index];
            div()
                .id(("fresh-suggestion", index))
                .debug_selector(move || format!("home-suggestion-{index}").into())
                .flex_1()
                .min_w_0()
                .flex()
                .items_start()
                .gap(px(12.))
                .p(px(14.))
                .rounded(px(14.))
                .bg(theme.HEADER_BG)
                .cursor_pointer()
                .hover(|el| el.bg(Theme::global().USER_BG))
                .child(
                    div()
                        .size(px(32.))
                        .flex_none()
                        .flex()
                        .items_center()
                        .justify_center()
                        .rounded(px(9.))
                        .bg(tint(theme.TEXT, 0.06))
                        .child(icon(glyph, 15., theme.TEXT_DIM)),
                )
                .child(
                    div()
                        .min_w_0()
                        .flex()
                        .flex_col()
                        .gap(px(1.))
                        .font_family(theme.FONT_UI)
                        .child(
                            div()
                                .truncate()
                                .text_size(px(14.))
                                .line_height(px(19.))
                                .font_weight(FontWeight::MEDIUM)
                                .text_color(theme.TEXT)
                                .child(title),
                        )
                        .child(
                            div()
                                .truncate()
                                .text_size(px(12.5))
                                .line_height(px(17.))
                                .text_color(theme.TEXT_FAINT)
                                .child(desc),
                        ),
                )
                .on_click(cx.listener(move |this, _, window, cx| {
                    this.apply_home_suggestion(prompt, window, cx);
                    cx.stop_propagation();
                }))
        };
        let row = |a: usize, b: usize, cx: &mut Context<Self>| {
            div().flex().gap(px(10.)).child(card(a, cx)).child(card(b, cx))
        };
        div()
            .debug_selector(|| "home-starts".into())
            .mt(px(40.))
            .flex()
            .flex_col()
            .gap(px(10.))
            .map(|el| {
                if single {
                    el.children((0..STARTS.len()).map(|index| card(index, cx)))
                } else {
                    el.child(row(0, 1, cx)).child(row(2, 3, cx))
                }
            })
            .into_any_element()
    }

    fn render_home_recent(
        &self,
        recents: Vec<jcode_sdk::SessionInfo>,
        cx: &mut Context<Self>,
    ) -> Option<gpui::AnyElement> {
        if recents.is_empty() {
            return None;
        }
        let theme = Theme::global();
        Some(
            div()
                .debug_selector(|| "home-recent".into())
                .mt(px(40.))
                .flex()
                .flex_col()
                .child(
                    div()
                        .mb(px(8.))
                        .font_family(theme.FONT_UI)
                        .text_size(px(13.))
                        .font_weight(FontWeight::SEMIBOLD)
                        .text_color(theme.TEXT_DIM)
                        .child("Recent"),
                )
                .child(
                    div()
                        .flex()
                        .flex_col()
                        .rounded(px(14.))
                        .overflow_hidden()
                        .bg(theme.HEADER_BG)
                        .children(recents.into_iter().enumerate().map(|(index, session)| {
                            let dot = match state_of(&session.status) {
                                State::Working => theme.ACCENT,
                                State::Waiting => theme.WARN,
                                State::Failed => theme.ERROR,
                                State::Finished => theme.OK,
                                State::Quiet => theme.TEXT_FAINT,
                            };
                            let title = folder_session_title(
                                &session.session_id,
                                session.title.as_deref().unwrap_or_default(),
                            );
                            let age = age_label(&session);
                            let session_id = session.session_id.clone();
                            div()
                                .id(("home-recent", index))
                                .debug_selector(move || format!("home-recent-{index}").into())
                                .h(px(46.))
                                .px(px(14.))
                                .flex()
                                .items_center()
                                .gap(px(12.))
                                .cursor_pointer()
                                .when(index > 0, |el| el.border_t_1().border_color(theme.INPUT_BORDER))
                                .hover(|el| el.bg(Theme::global().USER_BG))
                                .font_family(theme.FONT_UI)
                                .child(div().size(px(7.)).flex_none().rounded_full().bg(dot))
                                .child(
                                    div()
                                        .flex_1()
                                        .min_w_0()
                                        .truncate()
                                        .text_size(px(13.5))
                                        .font_weight(FontWeight::MEDIUM)
                                        .text_color(theme.TEXT)
                                        .child(title),
                                )
                                .children(age.map(|age| {
                                    div()
                                        .flex_none()
                                        .text_size(px(12.))
                                        .text_color(theme.TEXT_FAINT)
                                        .child(age)
                                }))
                                .on_click(cx.listener(move |_, _, window, cx| {
                                    window.dispatch_action(
                                        Box::new(crate::ui_actions::OpenRecentSession {
                                            session_id: session_id.clone(),
                                        }),
                                        cx,
                                    );
                                    cx.stop_propagation();
                                }))
                        })),
                )
                .into_any_element(),
        )
    }

    /// The whole home screen. The composer keeps its measured position when
    /// the first prompt is sent (see `startup`), so nothing here may move it.
    pub(super) fn render_home(
        &mut self,
        input_bounds: std::rc::Rc<std::cell::Cell<Option<gpui::Bounds<gpui::Pixels>>>>,
        window: &mut Window,
        cx: &mut Context<Self>,
    ) -> gpui::AnyElement {
        let theme = Theme::global();
        let viewport = f32::from(window.viewport_size().height);
        // Short windows keep only the composer and its context in view.
        let compact = viewport < 400.;
        let top = if compact { 12. } else { (viewport * 0.09 - 60.).clamp(16., 64.).round() };
        let recents = self.home_recents(cx);
        let mut working = 0;
        let mut waiting = 0;
        for session in &recents {
            match state_of(&session.status) {
                State::Working => working += 1,
                State::Waiting => waiting += 1,
                _ => {}
            }
        }
        self.composer_hero = true;
        let composer = self.render_composer(window, cx);
        self.composer_hero = false;
        div()
            .id("fresh-session")
            .debug_selector(|| "fresh-session".into())
            .size_full()
            .overflow_y_scroll()
            .child(
                div()
                    .w_full()
                    .flex()
                    .justify_center()
                    .px(px(side_padding(window)))
                    .pt(px(top))
                    .pb(px(48.))
                    .child(
                        div()
                            .w_full()
                            .max_w(px(COLUMN_WIDTH))
                            .flex()
                            .flex_col()
                            .font_family(theme.FONT_UI)
                            .when(!compact, |el| el.child(
                                div()
                                    .debug_selector(|| "home-mark".into())
                                    .size(px(34.))
                                    .mb(px(20.))
                                    .flex()
                                    .items_center()
                                    .justify_center()
                                    .rounded(px(9.))
                                    .bg(theme.ACCENT)
                                    .font_weight(FontWeight::BOLD)
                                    .text_size(px(21.))
                                    .text_color(theme.BG)
                                    .child("J"),
                            ))
                            .when(!compact, |el| el.child(
                                div()
                                    .debug_selector(|| "fresh-session-heading".into())
                                    .font_weight(FontWeight::SEMIBOLD)
                                    .text_size(px(30.))
                                    .line_height(px(37.))
                                    .text_color(theme.TEXT)
                                    .child(greeting()),
                            ))
                            .children(summary(working, waiting).filter(|_| !compact).map(|line| {
                                div()
                                    .debug_selector(|| "home-summary".into())
                                    .mt(px(6.))
                                    .text_size(px(15.))
                                    .line_height(px(21.))
                                    .text_color(theme.TEXT_DIM)
                                    .child(line)
                            }))
                            .child(
                                div()
                                    .when(!compact, |el| el.mt(px(28.)))
                                    .relative()
                                    .flex()
                                    .flex_col()
                                    .gap_2()
                                    .children(self.render_prompt_queue(cx))
                                    .children(self.render_voice_pending())
                                    .child(composer)
                                    .child(startup::input_marker(input_bounds)),
                            )
                            .child(self.render_home_chips(cx))
                            .child(self.render_home_starts(cx))
                            .children(self.render_home_recent(recents, cx)),
                    ),
            )
            .into_any_element()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn summary_reads_naturally() {
        assert_eq!(summary(0, 0), None);
        assert_eq!(summary(2, 1).as_deref(), Some("Two agents are working and one needs your answer."));
        assert_eq!(summary(1, 0).as_deref(), Some("One agent is working."));
        assert_eq!(summary(0, 2).as_deref(), Some("Two sessions need your answer."));
    }

    #[test]
    fn branch_probe_reads_head() {
        let dir = tempfile::tempdir().unwrap();
        std::fs::create_dir_all(dir.path().join(".git")).unwrap();
        std::fs::write(dir.path().join(".git/HEAD"), "ref: refs/heads/master\n").unwrap();
        let nested = dir.path().join("src");
        std::fs::create_dir_all(&nested).unwrap();
        assert_eq!(probe_branch(&nested).as_deref(), Some("master"));
    }
}
