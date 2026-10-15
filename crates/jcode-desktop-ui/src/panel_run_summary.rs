//! The run thread: once a turn has finished, a consecutive run of finished
//! tool rows folds into one quiet summary row ("Read 3 files, ran 2
//! commands") that expands back to the individual rows on click. Rows stay
//! expanded while their turn is live, and failed calls are never hidden.
use super::*;

/// Summary rows are derived, never stored in `items`. Their row indices sit
/// between item indices and the applet rows at `usize::MAX / 2`.
pub(super) const RUN_ROW_BASE: usize = usize::MAX / 4;

/// Fewest consecutive finished tools worth folding.
const MIN_RUN: usize = 2;

/// Most distinct glyphs stacked in front of the label.
const MAX_ICONS: usize = 4;

/// Diameter of each stacked glyph disc, and the offset between discs.
const ICON_DISC: f32 = 20.;
const ICON_STEP: f32 = 15.;

const CHEVRON_RIGHT: &[u8] = b"<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m9 18 6-6-6-6\"/></svg>";
const CHEVRON_DOWN: &[u8] = b"<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"m6 9 6 6 6-6\"/></svg>";

/// One folded run of finished tool calls.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct ToolRun {
    /// The first call id, which keys the run's disclosure state.
    pub(super) id: String,
    /// Tool names in call order.
    pub(super) names: Vec<String>,
    pub(super) failed: usize,
    pub(super) expanded: bool,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum Kind {
    Read,
    Edit,
    Command,
    Search,
    Web,
    Other,
}

fn kind(name: &str) -> Kind {
    match crate::tool_icon::canonical_name(name) {
        "read" => Kind::Read,
        "write" | "edit" | "multiedit" | "replace" | "patch" | "apply_patch" => Kind::Edit,
        "bash" => Kind::Command,
        "agentgrep"
        | "grep"
        | "glob"
        | "find"
        | "ls"
        | "conversation_search"
        | "session_search" => Kind::Search,
        "websearch" | "webfetch" | "browser" => Kind::Web,
        _ => Kind::Other,
    }
}

fn phrase(kind: Kind, count: usize) -> String {
    let plural = |one: &str, many: &str| if count == 1 { one } else { many }.to_owned();
    let noun = match kind {
        Kind::Read => return format!("read {count} {}", plural("file", "files")),
        Kind::Edit => return format!("edited {count} {}", plural("file", "files")),
        Kind::Command => return format!("ran {count} {}", plural("command", "commands")),
        Kind::Search => plural("search", "searches"),
        Kind::Web => plural("web lookup", "web lookups"),
        Kind::Other => return format!("used {count} {}", plural("tool", "tools")),
    };
    format!("{count} {noun}")
}

/// "Read 3 files, edited 2 files, ran 4 commands", in first-use order.
pub(super) fn summary_label(names: &[String]) -> String {
    let mut counts: Vec<(Kind, usize)> = Vec::new();
    for name in names {
        let kind = kind(name);
        match counts.iter_mut().find(|(existing, _)| *existing == kind) {
            Some((_, count)) => *count += 1,
            None => counts.push((kind, 1)),
        }
    }
    let label = counts
        .into_iter()
        .map(|(kind, count)| phrase(kind, count))
        .collect::<Vec<_>>()
        .join(", ");
    let mut chars = label.chars();
    match chars.next() {
        Some(first) => first.to_uppercase().chain(chars).collect(),
        None => label,
    }
}

/// Up to `MAX_ICONS` tool names that draw distinct glyphs, in call order.
fn distinct_icons(names: &[String]) -> Vec<&str> {
    let mut icons: Vec<&str> = Vec::new();
    for name in names {
        if icons.len() == MAX_ICONS {
            break;
        }
        if !icons
            .iter()
            .any(|seen| crate::tool_icon::same_icon(seen, name))
        {
            icons.push(name);
        }
    }
    icons
}

pub(super) fn is_summary_row(row: &TranscriptRenderRow) -> bool {
    (RUN_ROW_BASE..usize::MAX / 2).contains(&row.index)
}

/// The list splice that turns `old` rows into `new` ones, when the change
/// folds or unfolds a run. Splicing exactly the changed span keeps the
/// reader's logical scroll anchor when a run above the viewport changes.
/// Other changes keep the transcript's tail-only splicing.
pub(super) fn row_splice(
    old: &[TranscriptRenderRow],
    new: &[TranscriptRenderRow],
) -> Option<(std::ops::Range<usize>, usize)> {
    let prefix = old
        .iter()
        .zip(new)
        .take_while(|(a, b)| a.index == b.index)
        .count();
    let limit = old.len().min(new.len()) - prefix;
    let suffix = old[prefix..]
        .iter()
        .rev()
        .zip(new[prefix..].iter().rev())
        .take(limit)
        .take_while(|(a, b)| a.index == b.index)
        .count();
    let old_range = prefix..old.len() - suffix;
    let new_range = prefix..new.len() - suffix;
    if old_range.is_empty() && new_range.is_empty() {
        return None;
    }
    // A run's members follow its summary row, so toggling it changes the
    // rows right after an unchanged summary.
    let touches_run = prefix
        .checked_sub(1)
        .is_some_and(|row| is_summary_row(&new[row]))
        || old[old_range.clone()]
            .iter()
            .chain(&new[new_range.clone()])
            .any(is_summary_row);
    touches_run.then(|| (old_range, new_range.len()))
}

impl Panel {
    /// The call id and failure state of a settled row that may fold into a
    /// run. Running calls, cards addressed to the user and applet tool cards
    /// interrupt a run instead.
    fn foldable_tool(&self, row: &TranscriptRenderRow) -> Option<(&str, &str, bool)> {
        let TranscriptRowSource::Settled(index) = row.source else {
            return None;
        };
        let Item::Tool {
            call_id,
            name,
            input,
            output,
            done,
            error,
        } = &self.items[index]
        else {
            return None;
        };
        if (!*done && error.is_none())
            || name == "todo"
            || self.run_card_calls.contains(call_id)
            || (error.is_none() && user_response::parse(name, input).is_some())
            || gmail_draft_card::parse(name, input).is_some()
            || gmail_read_card::parse(name, input, output, *done, error.as_deref()).is_some()
            || mcp_list_card::parse(name, input, output, *done, error.as_deref()).is_some()
        {
            return None;
        }
        Some((call_id, name, error.is_some()))
    }

    /// Whether finished runs of the current turn must stay expanded.
    pub(super) fn tool_runs_live(&self) -> bool {
        self.activity_active()
    }

    /// Replace each run of `MIN_RUN` or more finished tool rows with a
    /// summary row. Expanded runs keep every member after the summary.
    /// Collapsed runs keep their failed members.
    pub(super) fn fold_tool_runs(
        &self,
        rows: Vec<TranscriptRenderRow>,
    ) -> Vec<TranscriptRenderRow> {
        let live = self.tool_runs_live();
        let turn_start = self
            .items
            .iter()
            .rposition(|item| matches!(item, Item::User(_)));
        let mut out = Vec::with_capacity(rows.len());
        let mut pending: Vec<TranscriptRenderRow> = Vec::new();
        for row in rows {
            if self.foldable_tool(&row).is_some() {
                pending.push(row);
                continue;
            }
            self.flush_tool_run(&mut pending, &mut out, live, turn_start);
            out.push(row);
        }
        self.flush_tool_run(&mut pending, &mut out, live, turn_start);
        out
    }

    fn flush_tool_run(
        &self,
        pending: &mut Vec<TranscriptRenderRow>,
        out: &mut Vec<TranscriptRenderRow>,
        live: bool,
        turn_start: Option<usize>,
    ) {
        let first_index = match pending.first().map(|row| &row.source) {
            Some(TranscriptRowSource::Settled(index)) => *index,
            _ => {
                out.append(pending);
                return;
            }
        };
        let current_turn = turn_start.is_none_or(|start| first_index > start);
        if pending.len() < MIN_RUN || (live && current_turn) {
            out.append(pending);
            return;
        }
        let mut run = ToolRun::default();
        let mut failed_rows = Vec::new();
        for row in pending.iter() {
            let Some((call_id, name, failed)) = self.foldable_tool(row) else {
                continue;
            };
            if run.id.is_empty() {
                run.id = call_id.to_owned();
            }
            run.names.push(name.to_owned());
            if failed {
                run.failed += 1;
                failed_rows.push(row.index);
            }
        }
        run.expanded = self.expanded_runs.contains(&run.id);
        let expanded = run.expanded;
        out.push(TranscriptRenderRow {
            index: RUN_ROW_BASE + first_index,
            source: TranscriptRowSource::Owned(Box::new(Item::ToolRun(run))),
            role: None,
            show_label: false,
        });
        out.extend(
            pending
                .drain(..)
                .filter(|row| expanded || failed_rows.contains(&row.index)),
        );
    }

    fn toggle_tool_run(&mut self, id: &str, cx: &mut Context<Self>) {
        if !self.expanded_runs.remove(id) {
            self.expanded_runs.insert(id.to_owned());
        }
        self.transcript_measurements.dirty = true;
        cx.notify();
    }

    pub(super) fn render_tool_run(
        &self,
        index: usize,
        run: &ToolRun,
        cx: &mut Context<Self>,
    ) -> gpui::AnyElement {
        let theme = Theme::global();
        let ring = theme.panel_background(self.surface_focused);
        let group: SharedString = format!("tool-run-{index}").into();
        let id = run.id.clone();
        let expanded = run.expanded;
        // Discs overlap by a few pixels. Place them absolutely inside a
        // stack of explicit width so the label always starts after them.
        let glyphs = distinct_icons(&run.names);
        let stack_width = ICON_DISC + ICON_STEP * glyphs.len().saturating_sub(1) as f32;
        let icons = div()
            .debug_selector(|| "tool-run-icons".into())
            .relative()
            .flex_none()
            .w(px(stack_width))
            .h(px(ICON_DISC))
            .children(glyphs.into_iter().enumerate().map(|(position, name)| {
                div()
                    .absolute()
                    .top_0()
                    .left(px(ICON_STEP * position as f32))
                    .size(px(ICON_DISC))
                    .rounded_full()
                    .bg(theme.USER_BG)
                    .border_2()
                    .border_color(ring)
                    .flex()
                    .items_center()
                    .justify_center()
                    .child(crate::tool_icon::render_sized(name, 11., theme.TEXT_DIM))
            }));
        let label = summary_label(&run.names);
        div()
            .flex()
            .flex_row()
            .child(
                div()
                    .id(("tool-run", index))
                    .debug_selector(|| "tool-run-summary".into())
                    .group(group.clone())
                    .flex_none()
                    .flex()
                    .flex_row()
                    .items_center()
                    .gap(px(8.))
                    .ml(px(-2.))
                    .px(px(4.))
                    .py(px(3.))
                    .rounded(px(8.))
                    .cursor_pointer()
                    .text_size(px(13.))
                    .line_height(px(18.))
                    .text_color(theme.TEXT_FAINT)
                    .hover(move |style| style.text_color(theme.TEXT_DIM))
                    .on_click(cx.listener(move |this, _event, _window, cx| {
                        cx.stop_propagation();
                        this.toggle_tool_run(&id, cx);
                    }))
                    .child(icons)
                    .child(
                        div()
                            .debug_selector(|| "tool-run-label".into())
                            .whitespace_nowrap()
                            .child(label),
                    )
                    .when(run.failed > 0, |el| {
                        el.child(
                            div()
                                .debug_selector(|| "tool-run-failed".into())
                                .whitespace_nowrap()
                                .text_color(theme.ERROR)
                                .child(format!("{} failed", run.failed)),
                        )
                    })
                    .child(
                        div()
                            .debug_selector(|| "tool-run-chevron".into())
                            .flex_none()
                            .size(px(13.))
                            .opacity(if expanded { 1. } else { 0. })
                            .group_hover(group, |el| el.opacity(1.))
                            .child(
                                gpui::svg()
                                    .data(if expanded {
                                        CHEVRON_DOWN
                                    } else {
                                        CHEVRON_RIGHT
                                    })
                                    .size(px(13.))
                                    .text_color(theme.TEXT_FAINT),
                            ),
                    ),
            )
            .into_any_element()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn names(list: &[&str]) -> Vec<String> {
        list.iter().map(|name| (*name).to_owned()).collect()
    }

    #[test]
    fn labels_group_tools_by_kind_in_first_use_order() {
        assert_eq!(
            summary_label(&names(&[
                "read",
                "read",
                "edit",
                "apply_patch",
                "bash",
                "read"
            ])),
            "Read 3 files, edited 2 files, ran 1 command"
        );
        assert_eq!(
            summary_label(&names(&["bash", "functions.bash"])),
            "Ran 2 commands"
        );
        assert_eq!(
            summary_label(&names(&["agentgrep", "webfetch", "swarm", "mcp__x__y"])),
            "1 search, 1 web lookup, used 2 tools"
        );
        assert_eq!(summary_label(&[]), "");
    }

    #[test]
    fn stacked_icons_are_distinct_and_capped() {
        assert_eq!(
            distinct_icons(&names(&["read", "read", "functions.read", "bash"])),
            vec!["read", "bash"]
        );
        assert_eq!(
            distinct_icons(&names(&["read", "bash", "edit", "ls", "glob", "grep"])).len(),
            MAX_ICONS
        );
    }

    fn row(index: usize) -> TranscriptRenderRow {
        TranscriptRenderRow {
            index,
            source: TranscriptRowSource::Settled(index.min(100)),
            role: None,
            show_label: false,
        }
    }

    #[test]
    fn splices_cover_only_the_folded_span() {
        let summary = RUN_ROW_BASE + 1;
        let expanded = [0, summary, 1, 2, 3, 4].map(row);
        let collapsed = [0, summary, 4].map(row);
        let unfolded = [0, 1, 2, 3, 4].map(row);
        assert_eq!(row_splice(&collapsed, &expanded), Some((2..2, 3)));
        assert_eq!(row_splice(&expanded, &collapsed), Some((2..5, 0)));
        assert_eq!(row_splice(&unfolded, &collapsed), Some((1..4, 1)));
        // Ordinary appends keep the tail splice.
        assert_eq!(row_splice(&unfolded, &[0, 1, 2, 3, 4, 5].map(row)), None);
        assert_eq!(row_splice(&unfolded, &unfolded), None);
    }

    fn tool(id: &str, name: &str, error: Option<&str>) -> Item {
        Item::Tool {
            call_id: id.into(),
            name: name.into(),
            input: serde_json::json!({ "intent": format!("{name} {id}") }).to_string(),
            output: "done".into(),
            done: true,
            error: error.map(str::to_owned),
        }
    }

    fn mount(cx: &mut gpui::TestAppContext) -> (Entity<Panel>, &mut gpui::VisualTestContext) {
        cx.update(|cx| crate::bind_workspace_keys(cx));
        let (workspace, vcx) = cx.add_window_view(|_, cx| {
            let mut workspace =
                crate::workspace::Workspace::for_test(crate::learning::Coach::new(), cx);
            workspace.push_test_panel("run-thread", cx);
            workspace
        });
        vcx.run_until_parked();
        let panel = workspace
            .read_with(vcx, |workspace, _| workspace.test_panel(0))
            .expect("panel exists");
        (panel, vcx)
    }

    fn set(
        panel: &Entity<Panel>,
        vcx: &mut gpui::VisualTestContext,
        update: impl FnOnce(&mut Panel),
    ) {
        panel.update(vcx, |panel, cx| {
            update(panel);
            cx.notify();
        });
        vcx.run_until_parked();
    }

    fn runs(panel: &Entity<Panel>, vcx: &mut gpui::VisualTestContext) -> Vec<ToolRun> {
        panel.read_with(vcx, |panel, _| {
            panel
                .transcript_render_rows()
                .into_iter()
                .filter_map(|row| match row.source {
                    TranscriptRowSource::Owned(item) => match *item {
                        Item::ToolRun(run) => Some(run),
                        _ => None,
                    },
                    _ => None,
                })
                .collect()
        })
    }

    /// The virtual list, the cached derived rows and a fresh derivation agree.
    fn assert_row_counts(panel: &Entity<Panel>, vcx: &mut gpui::VisualTestContext, rows: usize) {
        panel.read_with(vcx, |panel, _| {
            let activity = usize::from(panel.activity_active());
            assert_eq!(panel.transcript_render_rows().len(), rows);
            assert_eq!(panel.test_transcript_row_count(), rows);
            assert_eq!(panel.transcript_row_count, rows + activity);
            assert_eq!(panel.transcript_list.item_count(), rows + activity);
        });
    }

    fn turn() -> Vec<Item> {
        vec![
            Item::User("Tidy the parser".into()),
            tool("a", "read", None),
            tool("b", "read", None),
            tool("c", "bash", None),
            Item::Assistant("Done.".into()),
        ]
    }

    #[gpui::test]
    fn finished_turn_collapses_its_tool_run(cx: &mut gpui::TestAppContext) {
        let (panel, vcx) = mount(cx);
        set(&panel, vcx, |panel| {
            *panel.items = turn();
            panel.status = "running_tools".into();
        });
        assert!(vcx.debug_bounds("tool-run-summary").is_none());
        assert_row_counts(&panel, vcx, 5);

        set(&panel, vcx, |panel| panel.status = "idle".into());
        assert!(vcx.debug_bounds("tool-run-summary").is_some());
        assert!(vcx.debug_bounds("tool-header").is_none());
        assert_row_counts(&panel, vcx, 3);
        let runs = runs(&panel, vcx);
        assert_eq!(runs.len(), 1);
        assert_eq!(runs[0].id, "a");
        assert_eq!(summary_label(&runs[0].names), "Read 2 files, ran 1 command");
    }

    #[gpui::test]
    fn stacked_icons_sit_before_the_label(cx: &mut gpui::TestAppContext) {
        let (panel, vcx) = mount(cx);
        set(&panel, vcx, |panel| *panel.items = turn());
        let icons = vcx.debug_bounds("tool-run-icons").expect("icon stack");
        let label = vcx.debug_bounds("tool-run-label").expect("label");
        // Read and bash: two discs, one step apart.
        assert_eq!(icons.size.width, px(ICON_DISC + ICON_STEP));
        assert!(label.left() >= icons.right(), "{icons:?} {label:?}");
    }

    #[gpui::test]
    fn summary_expands_on_click_and_collapses_again(cx: &mut gpui::TestAppContext) {
        let (panel, vcx) = mount(cx);
        set(&panel, vcx, |panel| *panel.items = turn());
        assert_row_counts(&panel, vcx, 3);

        let summary = vcx.debug_bounds("tool-run-summary").expect("summary row");
        vcx.simulate_click(summary.center(), gpui::Modifiers::default());
        vcx.run_until_parked();
        assert_row_counts(&panel, vcx, 6);
        assert!(runs(&panel, vcx)[0].expanded);
        assert!(vcx.debug_bounds("tool-header").is_some());
        let remeasured = panel.read_with(vcx, |panel, _| {
            panel.transcript_measurements.remeasured_rows
        });
        assert!(remeasured > 0);

        let summary = vcx.debug_bounds("tool-run-summary").expect("summary row");
        vcx.simulate_click(summary.center(), gpui::Modifiers::default());
        vcx.run_until_parked();
        assert_row_counts(&panel, vcx, 3);
        assert!(!runs(&panel, vcx)[0].expanded);
        assert!(vcx.debug_bounds("tool-header").is_none());
    }

    #[gpui::test]
    fn failed_tool_stays_visible_below_the_summary(cx: &mut gpui::TestAppContext) {
        let (panel, vcx) = mount(cx);
        set(&panel, vcx, |panel| {
            *panel.items = vec![
                Item::User("Run the checks".into()),
                tool("a", "bash", None),
                tool("b", "bash", Some("exit status 101")),
                tool("c", "read", None),
                Item::Assistant("One check failed.".into()),
            ];
        });
        // User, summary, the failed call, and the reply.
        assert_row_counts(&panel, vcx, 4);
        let runs = runs(&panel, vcx);
        assert_eq!(runs[0].failed, 1);
        assert_eq!(runs[0].names.len(), 3);
        assert!(vcx.debug_bounds("tool-run-failed").is_some());
        assert!(vcx.debug_bounds("tool-error").is_some());
        let headers = panel.read_with(vcx, |panel, _| {
            panel
                .transcript_render_rows()
                .iter()
                .filter(|row| matches!(row.source, TranscriptRowSource::Settled(2)))
                .count()
        });
        assert_eq!(headers, 1, "the failed call keeps its own row");
    }

    #[gpui::test]
    fn live_turn_keeps_its_rows_but_folds_earlier_turns(cx: &mut gpui::TestAppContext) {
        let (panel, vcx) = mount(cx);
        set(&panel, vcx, |panel| {
            let mut items = turn();
            items.push(Item::User("Now the lexer".into()));
            items.push(tool("d", "read", None));
            items.push(tool("e", "edit", None));
            *panel.items = items;
            panel.status = "running_tools".into();
        });
        let runs = runs(&panel, vcx);
        assert_eq!(runs.len(), 1, "only the finished turn folds");
        assert_eq!(runs[0].id, "a");
        // User, summary, reply, user, and both live tool rows.
        assert_row_counts(&panel, vcx, 6);

        set(&panel, vcx, |panel| panel.status = "idle".into());
        assert_row_counts(&panel, vcx, 5);
    }

    #[gpui::test]
    fn single_tools_and_running_tools_never_fold(cx: &mut gpui::TestAppContext) {
        let (panel, vcx) = mount(cx);
        set(&panel, vcx, |panel| {
            *panel.items = vec![
                Item::User("Check".into()),
                tool("a", "read", None),
                Item::Assistant("Reading.".into()),
                tool("b", "bash", None),
                Item::Tool {
                    call_id: "c".into(),
                    name: "bash".into(),
                    input: "{}".into(),
                    output: String::new(),
                    done: false,
                    error: None,
                },
            ];
        });
        assert!(runs(&panel, vcx).is_empty());
        assert_row_counts(&panel, vcx, 5);
    }
}
