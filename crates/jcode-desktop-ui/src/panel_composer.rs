//! Composer chrome: editor and controls in one quiet card, with routing below.
use super::*;

/// Pill height.
pub(super) const TAB_HEIGHT: f32 = 28.;
/// Gap between the input and the pill row below it.
const PILL_GAP: f32 = 0.;
/// Distance from the input's right edge to the in-box voice button.
/// Height of the soft ramp above the floating composer.
const DOCK_FADE: f32 = 28.;
/// Opacity of the veil behind the composer. High enough that history behind
/// the controls is a quiet hint, never competing with the draft.
const DOCK_VEIL_ALPHA: f32 = 0.86;
/// Right padding the input reserves so text never runs under the voice
/// button. Linux shows a single-glyph keycap; other platforms spell out the
/// chord, so their button is wider.
#[cfg(not(any(target_os = "macos", target_os = "windows")))]
pub(super) const VOICE_TRAILING_SPACE: f32 = 0.;
#[cfg(target_os = "macos")]
pub(super) const VOICE_TRAILING_SPACE: f32 = 0.;
#[cfg(target_os = "windows")]
pub(super) const VOICE_TRAILING_SPACE: f32 = 0.;

impl Panel {
    /// Prompt input with its pill row below. Every composer location
    /// (fresh session, startup layout, docked) uses this so the pills never
    /// drift apart from the input they label.
    pub(super) fn render_composer(
        &mut self,
        window: &mut Window,
        cx: &mut Context<Self>,
    ) -> gpui::AnyElement {
        let theme = Theme::global();
        let compact = window.viewport_size().width < px(480.);
        let card_focused = self.input.read(cx).focus_handle.is_focused(window);
        let screenshot_mode = crate::config::display().screenshot_mode;
        let account_label = account_method_label(self.provider.as_deref(), self.auth_method.as_deref());
        let model_label = pretty_model_label(self.model.as_deref());
        let effort = self
            .reasoning_effort
            .as_deref()
            .map(str::trim)
            .filter(|effort| !effort.is_empty() && self.model.is_some())
            .map(str::to_string);
        let remote_machine = (!screenshot_mode)
            .then(|| crate::harness::remote_host(&self.session_id))
            .flatten()
            .map(|host| {
                if host == crate::managed_cloud::HOST {
                    "Jcode Cloud".to_string()
                } else {
                    host
                }
            });
        let location = self
            .working_dir
            .as_deref()
            .filter(|dir| !screenshot_mode && !dir.is_empty())
            .map(|dir| {
                if remote_machine.is_some() {
                    remote_location_label(dir)
                } else {
                    location_label(dir)
                }
            });
        // Status remains available below the card, without crowding the
        // model, effort and voice controls inside it.
        let status_line = self.status_line();
        let meta = div()
            .debug_selector(|| "panel-meta".into())
            .flex_shrink(4.)
            .min_w_0()
            .h(px(22.))
            .px_1()
            .flex()
            .items_center()
            .justify_end()
            .gap_2()
            .flex_nowrap()
            .overflow_hidden()
            .whitespace_nowrap()
            .text_size(px(10.5))
            .font_family(theme.FONT_UI)
            .text_color(theme.TEXT_FAINT)
            .child(
                div()
                    .debug_selector(|| "panel-status".into())
                    .min_w_0()
                    .flex_shrink_1()
                    .flex()
                    .items_center()
                    .gap_2()
                    .overflow_hidden()
                    .children(self.render_voice_status(status_line))
                    .children(self.render_usage_meters())
                    .children(self.render_image_pane_toggle(cx)),
            )
            .when(self.show_build_footer && !screenshot_mode, |el| {
                el.child(
                    div()
                        .id("panel-build")
                        .debug_selector(|| "panel-build".into())
                        .tooltip(|_, cx| cx.new(|_| crate::build_info::BuildTooltip).into())
                        .flex_shrink_1()
                        .min_w_0()
                        .truncate()
                        .child(crate::build_info::label()),
                )
            });
        let pills = div()
            .debug_selector(|| "composer-tabs".into())
            .w_full()
            .min_w_0()
            .flex()
            .items_center()
            .gap_1()
            .pl(px(8.0))
            .pr(px(8.0))
            .pb(px(9.0))
            .mt(px(PILL_GAP))
            .child(
                div()
                    .debug_selector(|| "panel-identity".into())
                    // Auto basis: the pills claim their width before the
                    // trailing directory, which truncates first.
                    .flex_1()
                    .min_w_0()
                    .flex()
                    .items_center()
                    .gap_1()
                    .overflow_hidden()
                    .child(
                        div()
                            .id("composer-attach")
                            .debug_selector(|| "composer-attach".into())
                            .flex_none()
                            .size(px(30.))
                            .rounded_full()
                            .flex()
                            .items_center()
                            .justify_center()
                            .text_size(px(21.))
                            .text_color(theme.TEXT_DIM)
                            .cursor_pointer()
                            .hover(|el| el.bg(theme.TOOL_BG).text_color(theme.TEXT))
                            .tooltip(|_, cx| cx.new(|_| super::usage::MeterTooltip("Reference a file with @, or paste an image".into())).into())
                            .child("+")
                            .on_click(cx.listener(|this, _, window, cx| {
                                let input = this.input.clone();
                                window.defer(cx, move |window, cx| {
                                    input.update(cx, |input, cx| {
                                        let text = format!("{}@", input.content);
                                        input.set_content(text, cx);
                                        input.focus_handle(cx).focus(window, cx);
                                    });
                                });
                                cx.stop_propagation();
                            })),
                    )
                    .when(!compact, |identity| identity.child(
                        composer_pill("composer-mode")
                            .child("✦")
                            .child("Agent")
                            .tooltip(|_, cx| cx.new(|_| super::usage::MeterTooltip("Agent mode: edits files and runs commands".into())).into()),
                    ))
                    .child(
                        composer_pill("panel-model")
                            .flex_shrink_1()
                            .min_w(px(56.))
                            .children(self.model.as_deref().and_then(|model| {
                                let logo = match model.to_ascii_lowercase().as_str() {
                                    m if m.contains("claude") || m.contains("opus") || m.contains("sonnet") => "anthropic-api",
                                    m if m.contains("gpt") || m.contains("o3") => "openai",
                                    m if m.contains("gemini") => "gemini",
                                    _ => "",
                                };
                                crate::accounts::logo(logo).map(|data| gpui::svg().data(data).size(px(14.)).text_color(theme.TEXT_DIM))
                            }))
                            .child(
                                div()
                                    .debug_selector(|| "panel-model-name".into())
                                    .min_w_0()
                                    .truncate()
                                    .child(model_label),
                            )
                            .child("⌄")
                            .on_click(cx.listener(|this, _, window, cx| {
                                this.toggle_model_picker(window, cx);
                                cx.stop_propagation();
                            })),
                    )
                    .children(effort.filter(|_| !compact).map(|effort| {
                        composer_pill("panel-model-effort")
                            .flex_shrink(3.)
                            .min_w(px(24.))
                            .text_color(theme.TEXT_FAINT)
                            .child(div().min_w_0().truncate().child("▂▄▆"))
                            .child(div().min_w_0().truncate().child(effort))
                            .on_click(cx.listener(|this, _, window, cx| {
                                this.toggle_effort_picker(window, cx);
                                cx.stop_propagation();
                            }))
                    }))
                    .child(
                        composer_pill("panel-login")
                            .flex_shrink(2.)
                            .min_w(px(24.))
                            .text_color(theme.TEXT_FAINT)
                            .child(div().min_w_0().truncate().child(if compact { "•••".to_string() } else { account_label }))
                            .on_click(cx.listener(|this, _, window, cx| {
                                this.toggle_provider_picker(window, cx);
                                cx.stop_propagation();
                            })),
                    ),
            )
            .child(
                div()
                    .debug_selector(|| "composer-trailing".into())
                    // The directory yields space before the identity pills.
                    .flex_none()
                    .min_w_0()
                    .flex()
                    .items_center()
                    .justify_end()
                    .gap_1()
                    .overflow_hidden()
                    .children((!compact).then(|| self.render_context_meter()).flatten())
                    .child(self.render_voice_tab(cx))
                    .children(self.render_publish_button(cx))
            )
            .child(self.render_send_button(cx));
        let strips = self.render_composer_applets(window, cx);
        div()
            .debug_selector(|| "composer".into())
            .w_full()
            .min_w_0()
            .flex()
            .flex_col()
            .children(strips)
            .children(self.render_provider_picker(window, cx))
            .child(
                // One card: the editor on top, its controls on a row below.
                div()
                    .debug_selector(|| "composer-card".into())
                    .w_full()
                    .min_w_0()
                    .flex()
                    .flex_col()
                    .rounded(px(20.0))
                    .bg(theme.USER_BG)
                    .border_1()
                    .border_color(if card_focused {
                        theme.PANEL_BORDER_FOCUS
                    } else {
                        theme.PANEL_BORDER
                    })
                    .child(
                        div()
                            .relative()
                            .w_full()
                            .min_w_0()
                            .child(self.render_voice_input_slot(cx)),
                    )
                    .child(pills),
            )
            .child(
                div()
                    .w_full()
                    .h(px(22.))
                    .px_2()
                    .flex()
                    .items_center()
                    .justify_between()
                    .gap_2()
                    .text_size(px(10.5))
                    .font_family(theme.FONT_UI)
                    .text_color(theme.TEXT_FAINT)
                    .child(
                        div()
                            .min_w_0()
                            .flex()
                            .items_center()
                            .gap_1()
                            .child("Running on")
                            .child(remote_machine.unwrap_or_else(|| "This laptop".into()))
                            .children(location.map(|(name, detail)| {
                                div()
                                    .debug_selector(|| "composer-location".into())
                                    .min_w_0()
                                    .truncate()
                                    .font_family(theme.FONT_MONO)
                                    .child(match detail { Some(parent) => format!("{parent}/{name}"), None => name })
                            })),
                    )
                    .child(div().flex().items_center().gap_1().child("@ files  |  / commands").child(meta)),
            )
            .into_any_element()
    }

    /// The ordinary composer, floating over the bottom of the transcript.
    /// History scrolls beneath a translucent veil instead of stopping at a
    /// hard edge. The veil eases from clear to mostly opaque so text behind
    /// the controls reads as a soft, frosted hint rather than competing ink.
    /// Its measured height pads the list so the live end clears it.
    pub(super) fn render_composer_dock(
        &mut self,
        input_bounds: std::rc::Rc<std::cell::Cell<Option<gpui::Bounds<gpui::Pixels>>>>,
        window: &mut Window,
        cx: &mut Context<Self>,
    ) -> gpui::AnyElement {
        let background = Theme::global().panel_background(self.surface_focused);
        let veil = |alpha: f32| gpui::Rgba {
            a: alpha,
            ..background
        };
        let panel = cx.entity().downgrade();
        div()
            .debug_selector(|| "composer-dock".into())
            .absolute()
            .left_0()
            .right_0()
            .bottom_0()
            .flex()
            .flex_col()
            // Do not let clicks reach transcript rows hidden under the veil,
            // but keep wheel and touchpad scrolling the transcript.
            .block_mouse_except_scroll()
            .child(
                div()
                    .debug_selector(|| "composer-veil".into())
                    .w_full()
                    .h(px(DOCK_FADE))
                    .bg(gpui::linear_gradient(
                        0.,
                        gpui::linear_color_stop(veil(DOCK_VEIL_ALPHA), 0.),
                        gpui::linear_color_stop(veil(0.), 1.),
                    )),
            )
            .child(
                div()
                    .w_full()
                    .min_w_0()
                    .px_2()
                    .pb(px(16.))
                    .bg(veil(DOCK_VEIL_ALPHA))
                    .flex()
                    .flex_col()
                    .items_center()
                    .when(self.recovery_picker_open, |el| {
                        el.child(self.render_recovery_model_picker(cx))
                    })
                    .children(self.render_voice_overlay(window, cx))
                    .children(self.render_preview_badge(cx))
                    .child(
                        div()
                            .relative()
                            .w_full()
                            .min_w_0()
                            .max_w(px(710.))
                            .flex()
                            .flex_col()
                            .gap_2()
                            .children(self.render_prompt_queue(cx))
                            .children(self.render_voice_pending())
                            .child(self.render_composer(window, cx))
                            .child(startup::input_marker(input_bounds)),
                    ),
            )
            .child(
                gpui::canvas(
                    |_, _, _| (),
                    move |bounds, _, _, cx| {
                        // Measure after paint. The fade is see-through, so
                        // only the solid part below it reserves list space.
                        let height = (f32::from(bounds.size.height) - DOCK_FADE).max(0.).round();
                        let panel = panel.clone();
                        cx.defer(move |cx| {
                            let Some(entity) = panel.upgrade() else {
                                return;
                            };
                            if (entity.read(cx).composer_dock_height - height).abs() < 0.5 {
                                return;
                            }
                            entity.update(cx, |panel, cx| {
                                panel.composer_dock_height = height;
                                cx.notify();
                            });
                        });
                    },
                )
                .absolute()
                .size_full(),
            )
            .into_any_element()
    }

    /// Composer-placed applet instances for this session, as a compact strip
    /// directly above the pills (suggestions, pickers).
    fn render_composer_applets(
        &mut self,
        window: &mut Window,
        cx: &mut Context<Self>,
    ) -> Option<gpui::AnyElement> {
        let instances: Vec<String> = crate::applet_runtime::get(cx)
            .host
            .borrow()
            .composer_for(&self.session_id)
            .map(|mounted| mounted.instance.id.clone())
            .collect();
        if instances.is_empty() {
            return None;
        }
        let selection = self.applet_selection.clone();
        let cards: Vec<gpui::AnyElement> = instances
            .iter()
            .filter_map(|instance| {
                crate::applet_surface::card(instance, false, &selection, window, cx)
            })
            .collect();
        Some(
            div()
                .debug_selector(|| "composer-applets".into())
                .w_full()
                .min_w_0()
                .px_1()
                .mb(px(PILL_GAP))
                .flex()
                .flex_col()
                .gap_1()
                .children(cards)
                .into_any_element(),
        )
    }
}

impl Panel {
    /// Send, or stop while a turn runs and the draft is empty.
    fn render_send_button(&self, cx: &mut Context<Self>) -> gpui::AnyElement {
        const SEND_ICON: &[u8] = br#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7" fill="none" stroke="black" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>"#;
        const STOP_ICON: &[u8] = br#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2.5" fill="black"/></svg>"#;
        let theme = Theme::global();
        let has_draft = self.input.read(cx).has_draft();
        let stop = !has_draft && self.can_stop_turn();
        let enabled = stop || has_draft;
        div()
            .id("composer-send")
            .debug_selector(|| "composer-send".into())
            .flex_none()
            .ml_1()
            .size(px(30.0))
            .flex()
            .items_center()
            .justify_center()
            .rounded_full()
            .bg(if stop { theme.TEXT } else { theme.ACCENT })
            .when(enabled, |el| el.cursor_pointer().hover(|el| el.opacity(0.88)))
            .tooltip(move |_, cx| {
                cx.new(|_| super::usage::MeterTooltip(if stop { "Stop  Esc" } else { "Send  Enter" }.into()))
                    .into()
            })
            .child(
                gpui::svg()
                    .data(if stop { STOP_ICON } else { SEND_ICON })
                    .size(px(if stop { 12.0 } else { 15.0 }))
                    .text_color(theme.BG),
            )
            .on_mouse_down(gpui::MouseButton::Left, |_, window, cx| {
                window.prevent_default();
                cx.stop_propagation();
            })
            .on_click(cx.listener(move |this, _, window, cx| {
                cx.stop_propagation();
                if stop {
                    this.stop_turn();
                    cx.notify();
                } else {
                    // Submitting calls back into this panel, so run it after
                    // this handler releases the panel.
                    let input = this.input.clone();
                    window.defer(cx, move |window, cx| {
                        input.update(cx, |input, cx| input.submit_from_button(window, cx));
                    });
                }
            }))
            .into_any_element()
    }
}

/// A compact rounded pill: flat text until hovered.
pub(super) fn composer_pill(id: &'static str) -> gpui::Stateful<gpui::Div> {
    let theme = Theme::global();
    div()
        .id(id)
        .debug_selector(move || id.into())
        .h(px(TAB_HEIGHT))
        .px(px(9.0))
        .flex()
        .items_center()
        .gap_1p5()
        .rounded_full()
        .text_size(px(12.0))
        .font_weight(gpui::FontWeight::MEDIUM)
        .font_family(theme.FONT_UI)
        .text_color(theme.TEXT_DIM)
        .whitespace_nowrap()
        .cursor_pointer()
        .hover(|el| el.text_color(theme.TEXT).bg(theme.TOOL_BG))
}

/// `claude-opus-4-8` reads `Opus 4.8`. The provider already appears in the
/// method pill, so the redundant `Claude` family prefix is dropped, matching
/// the TUI's compact model label.
pub(super) fn pretty_model_label(model: Option<&str>) -> String {
    let Some(model) = model.map(str::trim).filter(|model| !model.is_empty()) else {
        return "Choose model".into();
    };
    let pretty = jcode_provider_core::model_names::pretty_model_display_name(model);
    match pretty.strip_prefix("Claude ") {
        Some(rest) if !rest.trim().is_empty() => rest.to_string(),
        _ => pretty,
    }
}

/// Model label plus effort, used where a single string is needed.
#[cfg(test)]
pub(super) fn model_tab_label(model: Option<&str>, effort: Option<&str>) -> String {
    let pretty = pretty_model_label(model);
    match effort.map(str::trim).filter(|effort| !effort.is_empty()) {
        Some(effort) if model.is_some_and(|m| !m.trim().is_empty()) => format!("{pretty} {effort}"),
        _ => pretty,
    }
}

/// Repo name (the last path component) plus its home-relative parent path.
/// `/home/me/src/jcode` reads `jcode` then `~/src`. Windows paths split on
/// either separator, so `C:\Users\me\src\jcode` reads `jcode` then `~\src`.
pub(super) fn location_label(path: &str) -> (String, Option<String>) {
    let trimmed = path.trim_end_matches(['/', '\\']);
    if trimmed.is_empty() {
        return ("/".into(), None);
    }
    if crate::platform_dirs::tilde(trimmed) == "~" {
        return ("~".into(), None);
    }
    let (parent, name) = match trimmed.rsplit_once(['/', '\\']) {
        Some((parent, name)) => (parent, name),
        None => return (trimmed.into(), None),
    };
    // `C:\` keeps its separator so the parent of `C:\repo` is not `C:`.
    let parent = if parent.is_empty() {
        "/".to_string()
    } else if parent.ends_with(':') {
        trimmed[..parent.len() + 1].to_string()
    } else {
        crate::platform_dirs::tilde(parent)
    };
    (name.to_string(), Some(parent))
}

/// Repo name plus its full parent path on another machine. The local `$HOME`
/// says nothing about the remote user's home, so nothing is abbreviated
/// except the managed cloud's own home directory.
pub(super) fn remote_location_label(path: &str) -> (String, Option<String>) {
    let trimmed = path.trim_end_matches('/');
    if trimmed.is_empty() {
        return ("/".into(), None);
    }
    let cloud_home = "/home/ec2-user";
    if trimmed == cloud_home {
        return ("~".into(), None);
    }
    let Some((parent, name)) = trimmed.rsplit_once('/') else {
        return (trimmed.into(), None);
    };
    let parent = if parent.is_empty() { "/" } else { parent };
    let parent = match parent.strip_prefix(cloud_home) {
        Some("") => "~".to_string(),
        Some(rest) if rest.starts_with('/') => format!("~{rest}"),
        _ => parent.to_string(),
    };
    (name.to_string(), Some(parent))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn model_tab_uses_pretty_names_and_effort() {
        assert_eq!(model_tab_label(None, Some("high")), "Choose model");
        assert_eq!(model_tab_label(Some(" "), None), "Choose model");
        assert_eq!(model_tab_label(Some("claude-opus-4-8"), None), "Opus 4.8");
        assert_eq!(
            model_tab_label(Some("gpt-5.5"), Some("high")),
            "GPT-5.5 high"
        );
        assert_eq!(model_tab_label(None, Some("high")), "Choose model");
        assert_eq!(
            model_tab_label(Some("gpt-5.1-codex-max"), Some("")),
            "GPT-5.1 Codex Max"
        );
    }

    #[test]
    fn remote_location_keeps_the_remote_path() {
        assert_eq!(
            remote_location_label("/home/ec2-user/workspaces"),
            ("workspaces".into(), Some("~".into()))
        );
        assert_eq!(
            remote_location_label("/home/ec2-user/workspaces/app/"),
            ("app".into(), Some("~/workspaces".into()))
        );
        assert_eq!(
            remote_location_label("/srv/app"),
            ("app".into(), Some("/srv".into()))
        );
        assert_eq!(remote_location_label("/home/ec2-user"), ("~".into(), None));
        assert_eq!(
            remote_location_label("/home/ec2-userx/a"),
            ("a".into(), Some("/home/ec2-userx".into()))
        );
    }

    #[test]
    fn location_label_splits_repo_name_from_parent() {
        let home = std::env::var("HOME").unwrap();
        assert_eq!(
            location_label(&format!("{home}/jcode")),
            ("jcode".into(), Some("~".into()))
        );
        assert_eq!(
            location_label(&format!("{home}/src/jcode/")),
            ("jcode".into(), Some("~/src".into()))
        );
        assert_eq!(location_label(&home), ("~".into(), None));
        assert_eq!(
            location_label("/srv/app"),
            ("app".into(), Some("/srv".into()))
        );
        assert_eq!(location_label("/"), ("/".into(), None));
        assert_eq!(
            location_label(r"D:\work\jcode\"),
            ("jcode".into(), Some(r"D:\work".into()))
        );
        assert_eq!(
            location_label(r"C:\repo"),
            ("repo".into(), Some(r"C:\".into()))
        );
    }

    #[gpui::test]
    fn controls_sit_below_editor_with_location_below_card(cx: &mut gpui::TestAppContext) {
        let (panel, vcx) = cx.add_window_view(|_, cx| Panel::new_preview(PreviewState::Empty, cx));
        let handle = vcx.update(|window, _| window.window_handle());
        for width in [240., 480., 1440.] {
            vcx.simulate_window_resize(handle, gpui::size(px(width), px(600.)));
            panel.update(vcx, |panel, cx| {
                panel.model = Some("claude-opus-4-8".into());
                panel.reasoning_effort = Some("high".into());
                panel.provider = Some("anthropic".into());
                panel.auth_method = Some("oauth".into());
                panel.working_dir = Some("/srv/projects/jcode".into());
                *panel.items = vec![Item::User("Hello".into())];
                cx.notify();
            });
            vcx.run_until_parked();
            let input = vcx.debug_bounds("prompt-input").unwrap();
            let editor = vcx.debug_bounds("prompt-editor").unwrap();
            let model = vcx.debug_bounds("panel-model").unwrap();
            let name = vcx.debug_bounds("panel-model-name").unwrap();
            let effort = vcx.debug_bounds("panel-model-effort");
            let login = vcx.debug_bounds("panel-login").unwrap();
            let context = vcx.debug_bounds("panel-context-meter");
            let voice = vcx.debug_bounds("voice-toggle").unwrap();
            for (tab_name, tab) in [("model", model), ("login", login), ("voice", voice)] {
                assert!(
                    tab.top() > input.bottom(),
                    "{tab_name} pill sits below the input at {width}: {tab:?} {input:?}"
                );
                if width >= 800. {
                    assert!(tab.left() >= input.left() && tab.right() <= input.right());
                }
            }
            assert!(name.right() <= model.right());
            if let Some(effort) = effort {
                assert!(model.right() <= effort.left(), "effort follows the model");
                assert!(effort.right() <= login.left(), "method follows effort");
            } else {
                assert!(model.right() <= login.left(), "method follows model");
            }
            if width >= 800. {
                let context = context.expect("wide toolbar keeps context ring");
                assert!(login.right() <= context.left(), "context follows method");
                assert!(context.right() <= voice.left(), "voice follows context");
            }
            assert!(editor.right() <= input.right());
            if width >= 480. {
                let location = vcx.debug_bounds("composer-location").unwrap();
                assert!(
                    location.top() > model.bottom(),
                    "location is below the card"
                );
                let send = vcx.debug_bounds("composer-send").unwrap();
                assert!(
                    voice.right() <= send.left() && input.right() - send.right() < px(16.),
                    "send sits at the right edge at {width}: {voice:?} {send:?} {input:?}"
                );
            }
        }
    }
}
