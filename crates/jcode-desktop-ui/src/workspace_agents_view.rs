//! Full-canvas live swarm map. All nodes come from the session catalog, not a
//! separate illustration or a second copy of swarm state.
use super::*;

fn location(session: &jcode_sdk::SessionInfo) -> String {
    session
        .session_id
        .strip_prefix("ssh://")
        .and_then(|remote| remote.split('/').next())
        .filter(|host| !host.is_empty())
        .unwrap_or("This laptop")
        .to_owned()
}

fn connector_lines(states: Vec<sidebar_swarm::AgentState>) -> gpui::AnyElement {
    gpui::canvas(
        |_, _, _| (),
        move |bounds, _, window, _| {
            let count = states.len();
            if count == 0 {
                return;
            }
            let width = f32::from(bounds.size.width);
            let height = f32::from(bounds.size.height);
            let start = bounds.origin;
            for (index, state) in states.iter().enumerate() {
                let from_x = width / 2.0;
                let to_x = width * (index as f32 + 0.5) / count as f32;
                let color = state.color().opacity(if *state == sidebar_swarm::AgentState::Idle {
                    0.32
                } else { 0.8 });
                // Keep dash lengths even in pixels, not in parameter-space:
                // cubic curves move at different speeds along their length.
                let dashed = *state == sidebar_swarm::AgentState::Working;
                let mut path = gpui::PathBuilder::stroke(px(if dashed { 1.55 } else { 1.3 }));
                let mut distance = 0.0_f32;
                let mut previous = (from_x, 0.0_f32);
                let mut drawing = false;
                for step in 0..=120 {
                    let t = step as f32 / 120.0;
                    let inv = 1.0 - t;
                    let x = inv.powi(3) * from_x
                        + 3.0 * inv.powi(2) * t * from_x
                        + 3.0 * inv * t.powi(2) * to_x
                        + t.powi(3) * to_x;
                    let y = inv.powi(3) * 0.0
                        + 3.0 * inv.powi(2) * t * (height * 0.58)
                        + 3.0 * inv * t.powi(2) * (height * 0.45)
                        + t.powi(3) * height;
                    let point = start + gpui::point(px(x), px(y));
                    if step > 0 {
                        distance += ((x - previous.0).powi(2) + (y - previous.1).powi(2)).sqrt();
                    }
                    let should_draw = !dashed || (distance % 11.0) < 6.0;
                    if should_draw && !drawing {
                        path.move_to(point);
                    } else if should_draw {
                        path.line_to(point);
                    }
                    drawing = should_draw;
                    previous = (x, y);
                }
                if let Ok(path) = path.build() {
                    window.paint_path(path, color);
                }
            }
        },
    )
    .w_full()
    .h(px(74.0))
    .into_any_element()
}

fn map_icon(data: &'static [u8], color: gpui::Rgba, size: f32) -> gpui::AnyElement {
    gpui::svg().data(data).size(px(size)).flex_none().text_color(color).into_any_element()
}

fn machine_icon(machine: &str) -> &'static [u8] {
    if machine == "This laptop" {
        include_bytes!("../../../assets/icons/computer.svg")
    } else {
        include_bytes!("../../../assets/icons/machine-cloud.svg")
    }
}

fn legend_item(label: &'static str, color: gpui::Rgba) -> gpui::AnyElement {
    div().flex().items_center().gap(px(6.0))
        .child(div().size(px(7.0)).rounded_full().bg(color))
        .child(label).into_any_element()
}

fn coordinator_logo(model: Option<&str>) -> &'static [u8] {
    let model = model.unwrap_or("").to_ascii_lowercase();
    if model.contains("claude") || model.contains("anthropic") {
        include_bytes!("../../../assets/icons/anthropic.svg")
    } else if model.contains("gpt") || model.contains("openai") || model.starts_with("o3") {
        include_bytes!("../../../assets/icons/openai.svg")
    } else if model.contains("gemini") || model.contains("google") {
        include_bytes!("../../../assets/icons/gemini.svg")
    } else {
        include_bytes!("../../../assets/icons/jcode.svg")
    }
}

impl Workspace {
    pub(super) fn show_agents_view(&mut self, cx: &mut Context<Self>) {
        self.agents_view = true;
        self.overview = false;
        self.overview_progress.set(0.0, Instant::now());
        cx.notify();
    }

    pub(super) fn close_agents_view(&mut self, cx: &mut Context<Self>) {
        self.agents_view = false;
        cx.notify();
    }

    fn agents_open_session(&mut self, session_id: &str, window: &mut Window, cx: &mut Context<Self>) {
        if let Some(session) = self.sessions.iter().find(|session| session.session_id == session_id).cloned() {
            self.agents_view = false;
            self.activate_session(session, window, cx);
        }
    }

    fn agent_card(&self, session: &jcode_sdk::SessionInfo, index: usize, cx: &mut Context<Self>) -> gpui::AnyElement {
        let theme = Theme::global();
        let member = sidebar_swarm::Member::of(session);
        let state = member.state;
        let id = session.session_id.clone();
        let machine = location(session);
        div()
            .id(("agents-map-agent", index))
            .debug_selector(move || format!("agents-map-agent-{index}"))
            .min_w_0().flex_1().h(px(88.0)).px(px(9.0)).py(px(10.0))
            .flex().flex_col().items_center().justify_center().gap(px(5.0))
            .rounded(px(14.0)).bg(theme.HEADER_BG)
            .when(state == sidebar_swarm::AgentState::Working, |el| {
                el.border_1().border_color(theme.ACCENT.opacity(0.65))
            })
            .cursor_pointer()
            .hover(|el| el.bg(Theme::global().USER_BG))
            .on_click(cx.listener(move |this, _, window, cx| {
                this.agents_open_session(&id, window, cx);
            }))
            .child(div().min_w_0().flex().items_center().justify_center().gap(px(6.0))
                .child(if state == sidebar_swarm::AgentState::Done {
                    map_icon(include_bytes!("../../../assets/icons/check.svg"), state.color(), 12.0)
                } else {
                    div().size(px(7.0)).rounded_full().bg(state.color()).into_any_element()
                })
                .child(div().truncate().text_size(px(13.0)).font_weight(gpui::FontWeight::MEDIUM).child(member.name)))
            .child(div().text_size(px(11.0)).text_color(state.color()).child(if state == sidebar_swarm::AgentState::Idle { "queued" } else { state.word() }))
            // There is no server-side numeric progress. A short live segment
            // communicates motion without claiming a completion percentage.
            .when(state == sidebar_swarm::AgentState::Working, |el| el.child(div().h(px(3.0)).w_full()
                .rounded_full().bg(theme.TEXT.opacity(0.09))
                    .child(div().h_full().w(relative(0.35)).rounded_full().bg(state.color()))
            ))
            .child(div().flex().items_center().justify_center().gap(px(5.0)).text_color(theme.TEXT_DIM)
                .child(map_icon(machine_icon(&machine), theme.TEXT_DIM, 11.0))
                .child(div().truncate().text_size(px(10.5)).child(machine)))
            .into_any_element()
    }

    fn agents_inbox_card(&self, session: &jcode_sdk::SessionInfo, index: usize, cx: &mut Context<Self>) -> gpui::AnyElement {
        let theme = Theme::global();
        let member = sidebar_swarm::Member::of(session);
        let id = session.session_id.clone();
        let action_id = id.clone();
        let title = session.title.as_deref().filter(|title| !title.is_empty())
            .unwrap_or(if member.state == sidebar_swarm::AgentState::Failed { "Agent failed" } else { "Waiting for your input" });
        div().id(("agents-inbox", index))
            .debug_selector(move || format!("agents-inbox-{index}"))
            .min_w_0().flex_1().min_h(px(62.0)).px(px(15.0)).py(px(10.0))
            .flex().items_center().gap(px(12.0))
            .rounded(px(14.0)).bg(theme.PANEL_BG)
            .cursor_pointer().hover(|el| el.bg(Theme::global().USER_BG))
            .on_click(cx.listener(move |this, _, window, cx| this.agents_open_session(&id, window, cx)))
            .child(div().size(px(32.0)).flex_none().flex().items_center().justify_center()
                .rounded_full().bg(member.state.color().opacity(0.12))
                .child(map_icon(include_bytes!("../../../assets/icons/swarm.svg"), member.state.color(), 16.0)))
            .child(div().min_w_0().flex_1().flex().flex_col().gap(px(3.0))
                .child(div().truncate().text_size(px(13.0)).font_weight(gpui::FontWeight::MEDIUM).child(title.to_owned()))
                .child(div().truncate().text_size(px(11.5)).text_color(theme.TEXT_DIM).child(member.name)))
            .child(div().id(("agents-inbox-action", index))
                .debug_selector(move || format!("agents-inbox-action-{index}"))
                .flex_none().px(px(13.0)).py(px(7.0)).rounded_full()
                .bg(theme.ACCENT).text_size(px(11.5)).text_color(theme.BG)
                .on_click(cx.listener(move |this, _, window, cx| {
                    cx.stop_propagation();
                    this.agents_open_session(&action_id, window, cx);
                }))
                .child(if member.state == sidebar_swarm::AgentState::Waiting { "Answer" } else { "Open" }))
            .into_any_element()
    }

    pub(super) fn render_agents_view(&mut self, cx: &mut Context<Self>) -> gpui::AnyElement {
        let theme = Theme::global();
        let groups = sidebar_swarm::groups(&self.sessions);
        let mut swarms = groups.children.iter().collect::<Vec<_>>();
        swarms.sort_by(|(id_a, a), (id_b, b)| b.len().cmp(&a.len()).then(id_a.cmp(id_b)));
        let members = swarms.iter().flat_map(|(_, children)| children.iter().map(|child| &child.session)).collect::<Vec<_>>();
        let working = members.iter().filter(|s| sidebar_swarm::Member::of(s).state == sidebar_swarm::AgentState::Working).count();
        let needs = members.iter().copied().filter(|s| matches!(sidebar_swarm::Member::of(s).state, sidebar_swarm::AgentState::Waiting | sidebar_swarm::AgentState::Failed)).collect::<Vec<_>>();
        let machines = members.iter().map(|s| location(s)).collect::<HashSet<_>>().len();
        let active_swarm = swarms.first().and_then(|(id, children)| {
            self.sessions.iter().find(|s| &s.session_id == *id).map(|root| (root, children))
        });
        let mut body = div().w_full().max_w(px(940.0)).mx_auto().px(px(26.0)).pt(px(34.0)).pb(px(64.0))
            .flex().flex_col()
            .child(div().flex().items_center().justify_between()
                .child(div().flex().items_center().gap(px(16.0))
                    .child(div().debug_selector(|| "agents-view-title".into()).text_size(px(27.0))
                        .font_weight(gpui::FontWeight::SEMIBOLD).child("Agents"))
                    .child(div().flex().items_center().gap(px(11.0)).text_size(px(11.5))
                        .child(div().text_color(theme.ACCENT).child(format!("{working} working")))
                        .child(div().text_color(theme.WARN).child(format!("{} need you", needs.len())))
                        .child(div().text_color(theme.TEXT_DIM).child(format!("{machines} {}", if machines == 1 { "machine" } else { "machines" })))))
                .child(div().id("agents-view-back").debug_selector(|| "agents-view-back".into())
                    .px(px(13.0)).py(px(7.0)).rounded_full().bg(theme.HEADER_BG)
                    .cursor_pointer().text_size(px(12.5)).text_color(theme.TEXT_DIM)
                    .hover(|el| el.text_color(Theme::global().TEXT))
                    .on_click(cx.listener(|this, _, _, cx| this.close_agents_view(cx)))
                    .child("Back to workspace")));

        if let Some((root, children)) = active_swarm {
            let visible = children.iter().take(6).collect::<Vec<_>>();
            let root_id = root.session_id.clone();
            let root_title = root.title.clone().unwrap_or_else(|| "Active swarm".into());
            let root_state = sidebar_swarm::AgentState::from_status(Some(&root.status));
            let states = visible.iter().map(|child| sidebar_swarm::Member::of(&child.session).state).collect();
            let logo = self.slots.iter().find_map(|slot| {
                let panel = slot.panel.read(cx);
                (panel.session_id == root.session_id).then(|| coordinator_logo(panel.model.as_deref()))
            }).unwrap_or_else(|| coordinator_logo(None));
            body = body.child(div().mt(px(30.0)).p(px(16.0)).rounded(px(18.0)).bg(theme.PANEL_BG)
                .debug_selector(|| "agents-swarm-map".into())
                .child(div().flex().items_center().gap(px(11.0))
                    .child(div().min_w_0().truncate().font_weight(gpui::FontWeight::SEMIBOLD).text_size(px(13.5)).child(root_title))
                    .child(div().px(px(9.0)).py(px(3.0)).rounded_full().bg(theme.ACCENT_DIM)
                        .text_size(px(11.0)).text_color(theme.ACCENT).child(format!("{} agents", children.len())))
                    .child(div().flex_1())
                    .child(div().text_size(px(11.5)).text_color(theme.TEXT_DIM).child(format!("coordinator on {}", location(root)))))
                .child(div().mt(px(16.0)).flex().justify_center()
                    .child(div().id("agents-map-coordinator").debug_selector(|| "agents-map-coordinator".into())
                        .h(px(44.0)).px(px(14.0)).flex().items_center().gap(px(9.0))
                        .rounded(px(14.0)).bg(theme.HEADER_BG)
                        .border_1().border_color(theme.ACCENT.opacity(0.7))
                        .cursor_pointer().hover(|el| el.bg(Theme::global().USER_BG))
                        .on_click(cx.listener(move |this, _, window, cx| this.agents_open_session(&root_id, window, cx)))
                        .text_size(px(13.0)).font_weight(gpui::FontWeight::MEDIUM)
                        .child(div().size(px(25.0)).flex().items_center().justify_center().rounded(px(7.0))
                            .bg(theme.ACCENT.opacity(0.14))
                            .child(map_icon(include_bytes!("../../../assets/icons/swarm.svg"), theme.ACCENT, 15.0)))
                        .child("Coordinator")
                        .child(map_icon(logo, theme.TEXT_DIM, 15.0))
                        .child(div().size(px(7.0)).rounded_full().bg(root_state.color()))))
                .child(connector_lines(states))
                .child(div().flex().gap(px(8.0)).children(visible.iter().enumerate().map(|(index, child)| self.agent_card(&child.session, index, cx))))
                .child(div().mt(px(15.0)).flex().items_center().gap(px(16.0)).text_size(px(11.0)).text_color(theme.TEXT_DIM)
                    .child(legend_item("working", theme.ACCENT))
                    .child(legend_item("needs you", theme.WARN))
                    .child(legend_item("finished", theme.OK))
                    .child(legend_item("queued", theme.TEXT_FAINT))
                    .child(div().flex_1())
                    .child(div().text_color(theme.TEXT_FAINT).child("Click an agent to inspect it"))));
        } else {
            body = body.child(div().mt(px(24.0)).p(px(28.0)).rounded(px(18.0)).bg(theme.PANEL_BG)
                .text_size(px(13.0)).text_color(theme.TEXT_DIM).child("No active swarms yet"));
        }

        if !needs.is_empty() {
            body = body.child(div().mt(px(30.0)).mb(px(10.0)).flex().items_center().gap(px(9.0))
                .child(div().text_size(px(14.0)).font_weight(gpui::FontWeight::SEMIBOLD).child("Needs you"))
                .child(div().text_size(px(11.0)).text_color(theme.WARN).child(needs.len().to_string())));
            for (index, row) in needs.iter().enumerate() {
                body = body.child(div().mb(px(7.0)).child(self.agents_inbox_card(row, index, cx)));
            }
        }

        body = body.child(div().mt(px(29.0)).mb(px(11.0)).text_size(px(14.0))
            .font_weight(gpui::FontWeight::SEMIBOLD).child("All agents"));
        for (index, session) in members.iter().enumerate() {
            let member = sidebar_swarm::Member::of(session);
            let id = session.session_id.clone();
            body = body.child(div().id(("agents-list-agent", index))
                .debug_selector(move || format!("agents-list-agent-{index}"))
                .min_h(px(44.0)).px(px(13.0)).mb(px(5.0)).flex().items_center().gap(px(12.0))
                .rounded_full().bg(theme.PANEL_BG).cursor_pointer()
                .hover(|el| el.bg(Theme::global().USER_BG))
                .on_click(cx.listener(move |this, _, window, cx| this.agents_open_session(&id, window, cx)))
                .child(div().min_w_0().flex_1().truncate().text_size(px(12.5)).child(member.name))
                .child(div().text_size(px(11.5)).text_color(theme.TEXT_DIM).child(location(session)))
                .child(div().w(px(75.0)).text_align(gpui::TextAlign::Right).text_size(px(11.5))
                    .text_color(member.state.color()).child(member.state.word())));
        }
        div().id("agents-view").size_full().bg(theme.BG).overflow_y_scroll()
            .debug_selector(|| "agents-view".into())
            .font_family(theme.FONT_UI).text_color(theme.TEXT)
            .child(body).into_any_element()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn session(id: &str, parent: Option<&str>) -> jcode_sdk::SessionInfo {
        jcode_sdk::SessionInfo {
            user_connected: false,
            session_id: id.into(),
            working_dir: None,
            title: Some(id.into()),
            status: "running".into(),
            transcript_bytes: None,
            saved: false,
            updated_at_ms: None,
            last_active_at_ms: None,
            archived: false,
            archived_at_ms: None,
            save_label: None,
            parent_session_id: parent.map(str::to_owned),
            agent_label: None,
            swarm_status: None,
            edit_stats: None,
        }
    }

    #[gpui::test]
    fn agents_map_renders_and_click_opens_agent_session(cx: &mut gpui::TestAppContext) {
        let (workspace, vcx) = cx.add_window_view(|_, cx| {
            let mut w = Workspace::for_test(learning::Coach::new(), cx);
            let mut root = session("lead", None);
            root.title = Some("Native swarm".into());
            let mut child = session("agent", Some("lead"));
            child.agent_label = Some("Rendering agent".into());
            child.swarm_status = Some("waiting".into());
            w.sessions = vec![root, child];
            w.show_agents_view(cx);
            w
        });
        vcx.run_until_parked();
        assert!(vcx.debug_bounds("agents-view-title").is_some());
        assert!(vcx.debug_bounds("agents-swarm-map").is_some());
        assert!(vcx.debug_bounds("agents-inbox-0").is_some());
        let coordinator = vcx.debug_bounds("agents-map-coordinator").expect("coordinator node");
        let card = vcx.debug_bounds("agents-map-agent-0").expect("live agent card");
        assert!((f32::from(coordinator.center().x) - f32::from(card.center().x)).abs() < 2.0);
        assert!(coordinator.bottom() < card.top());
        vcx.simulate_click(card.center(), gpui::Modifiers::default());
        vcx.run_until_parked();
        workspace.read_with(vcx, |w, cx| {
            assert!(!w.agents_view);
            assert_eq!(w.slots[w.active].panel.read(cx).session_id, "agent");
        });
    }

    #[gpui::test]
    fn agents_inbox_answer_focuses_waiting_session(cx: &mut gpui::TestAppContext) {
        let (workspace, vcx) = cx.add_window_view(|_, cx| {
            let mut w = Workspace::for_test(learning::Coach::new(), cx);
            let root = session("lead", None);
            let mut child = session("needs-answer", Some("lead"));
            child.swarm_status = Some("waiting".into());
            w.sessions = vec![root, child];
            w.show_agents_view(cx);
            w
        });
        vcx.run_until_parked();
        let action = vcx.debug_bounds("agents-inbox-action-0").expect("answer button");
        vcx.simulate_click(action.center(), gpui::Modifiers::default());
        vcx.run_until_parked();
        workspace.read_with(vcx, |w, cx| {
            assert!(!w.agents_view);
            assert_eq!(w.slots[w.active].panel.read(cx).session_id, "needs-answer");
        });
    }

    #[gpui::test]
    fn agents_view_back_and_escape_restore_the_workspace(cx: &mut gpui::TestAppContext) {
        let (workspace, vcx) = cx.add_window_view(|_, cx| {
            let mut w = Workspace::for_test(learning::Coach::new(), cx);
            w.show_agents_view(cx);
            w
        });
        vcx.run_until_parked();
        let back = vcx.debug_bounds("agents-view-back").expect("back button");
        vcx.simulate_click(back.center(), gpui::Modifiers::default());
        vcx.run_until_parked();
        assert!(!workspace.read_with(vcx, |w, _| w.agents_view));
        workspace.update(vcx, |w, cx| w.show_agents_view(cx));
        vcx.run_until_parked();
        vcx.update(|window, cx| {
            let focus = workspace.read(cx).focus_handle.clone();
            window.focus(&focus, cx);
        });
        vcx.simulate_keystrokes("escape");
        vcx.run_until_parked();
        assert!(!workspace.read_with(vcx, |w, _| w.agents_view));
    }
}
