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
                    0.27
                } else { 0.74 });
                // Sample a cubic curve into one or several stroked paths. A
                // working edge is dashed, while completed and waiting edges
                // remain continuous and legible in both palettes.
                let dashed = *state == sidebar_swarm::AgentState::Working;
                let steps = 28;
                let mut path = gpui::PathBuilder::stroke(px(if dashed { 1.7 } else { 1.35 }));
                for step in 0..=steps {
                    let t = step as f32 / steps as f32;
                    let inv = 1.0 - t;
                    let x = inv.powi(3) * from_x
                        + 3.0 * inv.powi(2) * t * from_x
                        + 3.0 * inv * t.powi(2) * to_x
                        + t.powi(3) * to_x;
                    let y = inv.powi(3) * 0.0
                        + 3.0 * inv.powi(2) * t * (height * 0.65)
                        + 3.0 * inv * t.powi(2) * (height * 0.35)
                        + t.powi(3) * height;
                    let point = start + gpui::point(px(x), px(y));
                    if step == 0 || (dashed && step % 4 == 0) {
                        path.move_to(point);
                    } else if !dashed || step % 4 < 3 {
                        path.line_to(point);
                    }
                }
                if let Ok(path) = path.build() {
                    window.paint_path(path, color);
                }
            }
        },
    )
    .w_full()
    .h(px(78.0))
    .into_any_element()
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
            .min_w_0().flex_1().h(px(104.0)).px(px(12.0)).py(px(11.0))
            .flex().flex_col().gap(px(5.0))
            .rounded(px(14.0)).bg(theme.HEADER_BG)
            .when(state == sidebar_swarm::AgentState::Working, |el| {
                el.border_1().border_color(theme.ACCENT.opacity(0.65))
            })
            .cursor_pointer()
            .hover(|el| el.bg(Theme::global().USER_BG))
            .on_click(cx.listener(move |this, _, window, cx| {
                this.agents_open_session(&id, window, cx);
            }))
            .child(div().truncate().text_size(px(13.0)).font_weight(gpui::FontWeight::MEDIUM).child(member.name))
            .child(div().text_size(px(11.5)).text_color(state.color()).child(state.word()))
            // There is no server-side numeric progress. A short live segment
            // communicates motion without claiming a completion percentage.
            .child(div().h(px(3.0)).w_full().when(state == sidebar_swarm::AgentState::Working, |el| {
                el.rounded_full().bg(theme.TEXT.opacity(0.09))
                    .child(div().h_full().w(relative(0.35)).rounded_full().bg(state.color()))
            }))
            .child(div().truncate().text_size(px(10.5)).text_color(theme.TEXT_DIM).child(machine))
            .into_any_element()
    }

    fn agents_inbox_card(&self, session: &jcode_sdk::SessionInfo, index: usize, cx: &mut Context<Self>) -> gpui::AnyElement {
        let theme = Theme::global();
        let member = sidebar_swarm::Member::of(session);
        let id = session.session_id.clone();
        let title = session.title.as_deref().filter(|title| !title.is_empty())
            .unwrap_or(if member.state == sidebar_swarm::AgentState::Failed { "Agent failed" } else { "Waiting for your input" });
        div().id(("agents-inbox", index))
            .debug_selector(move || format!("agents-inbox-{index}"))
            .min_w_0().flex_1().min_h(px(62.0)).px(px(15.0)).py(px(10.0))
            .flex().items_center().gap(px(12.0))
            .rounded(px(14.0)).bg(theme.PANEL_BG)
            .cursor_pointer().hover(|el| el.bg(Theme::global().USER_BG))
            .on_click(cx.listener(move |this, _, window, cx| this.agents_open_session(&id, window, cx)))
            .child(div().min_w_0().flex_1().flex().flex_col().gap(px(3.0))
                .child(div().truncate().text_size(px(13.0)).font_weight(gpui::FontWeight::MEDIUM).child(title.to_owned()))
                .child(div().truncate().text_size(px(11.5)).text_color(theme.TEXT_DIM).child(member.name)))
            .child(div().flex_none().text_size(px(11.5)).text_color(member.state.color()).child(member.state.word()))
            .child(div().flex_none().px(px(11.0)).py(px(6.0)).rounded_full()
                .bg(theme.HEADER_BG).text_size(px(11.5)).text_color(theme.TEXT)
                .child("Open session"))
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
        let stat = |label: &'static str, count: usize, color: gpui::Rgba| {
            div().min_w_0().flex_1().h(px(75.0)).px(px(16.0)).py(px(11.0))
                .rounded(px(14.0)).bg(theme.PANEL_BG)
                .flex().flex_col().gap(px(3.0))
                .child(div().text_size(px(11.0)).text_color(theme.TEXT_DIM).child(label))
                .child(div().text_size(px(22.0)).font_weight(gpui::FontWeight::SEMIBOLD).text_color(color).child(count.to_string()))
        };
        let mut body = div().w_full().max_w(px(940.0)).mx_auto().px(px(26.0)).pt(px(34.0)).pb(px(64.0))
            .flex().flex_col()
            .child(div().flex().items_center().justify_between()
                .child(div().flex().flex_col().gap(px(7.0))
                    .child(div().debug_selector(|| "agents-view-title".into()).text_size(px(27.0))
                        .font_weight(gpui::FontWeight::SEMIBOLD).child("Agents"))
                    .child(div().text_size(px(13.0)).text_color(theme.TEXT_DIM)
                        .child(format!("{working} working, {} need you, across {machines} {}.", needs.len(), if machines == 1 { "machine" } else { "machines" }))))
                .child(div().id("agents-view-back").debug_selector(|| "agents-view-back".into())
                    .px(px(13.0)).py(px(7.0)).rounded_full().bg(theme.HEADER_BG)
                    .cursor_pointer().text_size(px(12.5)).text_color(theme.TEXT_DIM)
                    .hover(|el| el.text_color(Theme::global().TEXT))
                    .on_click(cx.listener(|this, _, _, cx| this.close_agents_view(cx)))
                    .child("Back to workspace")))
            .child(div().mt(px(30.0)).flex().gap(px(9.0))
                .child(stat("Working", working, theme.ACCENT))
                .child(stat("Needs you", needs.len(), theme.WARN))
                .child(stat("Agents", members.len(), theme.TEXT)));

        if let Some((root, children)) = active_swarm {
            let visible = children.iter().take(6).collect::<Vec<_>>();
            let root_id = root.session_id.clone();
            let root_title = root.title.clone().unwrap_or_else(|| "Active swarm".into());
            let root_state = sidebar_swarm::AgentState::from_status(Some(&root.status));
            let states = visible.iter().map(|child| sidebar_swarm::Member::of(&child.session).state).collect();
            body = body.child(div().mt(px(24.0)).p(px(19.0)).rounded(px(18.0)).bg(theme.PANEL_BG)
                .debug_selector(|| "agents-swarm-map".into())
                .child(div().flex().items_center().gap(px(11.0))
                    .child(div().min_w_0().truncate().font_weight(gpui::FontWeight::SEMIBOLD).text_size(px(13.5)).child(root_title))
                    .child(div().px(px(9.0)).py(px(3.0)).rounded_full().bg(theme.ACCENT_DIM)
                        .text_size(px(11.0)).text_color(theme.ACCENT).child(format!("{} agents", children.len())))
                    .child(div().flex_1())
                    .child(div().text_size(px(11.5)).text_color(theme.TEXT_DIM).child(format!("coordinator on {}", location(root)))))
                .child(div().mt(px(22.0)).flex().justify_center()
                    .child(div().id("agents-map-coordinator").debug_selector(|| "agents-map-coordinator".into())
                        .px(px(16.0)).py(px(10.0)).rounded(px(13.0)).bg(theme.HEADER_BG)
                        .border_1().border_color(theme.ACCENT.opacity(0.4))
                        .cursor_pointer().hover(|el| el.bg(Theme::global().USER_BG))
                        .on_click(cx.listener(move |this, _, window, cx| this.agents_open_session(&root_id, window, cx)))
                        .text_size(px(13.0)).font_weight(gpui::FontWeight::MEDIUM)
                        .child("Coordinator")
                        .child(div().text_size(px(11.0)).text_color(root_state.color()).child(root_state.word()))))
                .child(connector_lines(states))
                .child(div().flex().gap(px(8.0)).children(visible.iter().enumerate().map(|(index, child)| self.agent_card(&child.session, index, cx))))
                .child(div().mt(px(16.0)).flex().gap(px(17.0)).text_size(px(11.0)).text_color(theme.TEXT_DIM)
                    .child("Working · dashed")
                    .child("Needs you · warm")
                    .child("Finished · solid")
                    .child("Queued · faint")));
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
        let card = vcx.debug_bounds("agents-map-agent-0").expect("live agent card");
        vcx.simulate_click(card.center(), gpui::Modifiers::default());
        vcx.run_until_parked();
        workspace.read_with(vcx, |w, cx| {
            assert!(!w.agents_view);
            assert_eq!(w.slots[w.active].panel.read(cx).session_id, "agent");
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
