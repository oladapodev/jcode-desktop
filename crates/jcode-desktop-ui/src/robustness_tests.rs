//! Real-server data shapes the redesign fixtures never exercise: very long
//! titles, project names and hostnames, untitled sessions, 50+ sessions in
//! one project and swarms of 20+ agents. Each test asserts that nothing
//! overflows its container or overlaps its neighbour.
use super::*;

const LONG_TITLE: &str = "Investigate why the reconnect logic drops queued prompts when the laptop sleeps for longer than the server keepalive interval";
const LONG_HOST: &str = "a-very-long-cloud-machine-hostname.internal.example.com";

fn session(id: &str, title: Option<&str>) -> jcode_sdk::SessionInfo {
    jcode_sdk::SessionInfo {
        user_connected: false,
        session_id: id.into(),
        working_dir: None,
        title: title.map(str::to_owned),
        status: "idle".into(),
        transcript_bytes: None,
        saved: false,
        updated_at_ms: None,
        last_active_at_ms: None,
        archived: false,
        archived_at_ms: None,
        save_label: None,
        parent_session_id: None,
        agent_label: None,
        swarm_status: None,
        edit_stats: None,
    }
}

fn contains(outer: gpui::Bounds<gpui::Pixels>, inner: gpui::Bounds<gpui::Pixels>) -> bool {
    inner.left() >= outer.left() - px(0.5) && inner.right() <= outer.right() + px(0.5)
}

/// A swarm with 24 agents, long labels, untitled agents and long remote
/// hostnames: every visible card keeps its name and machine inside itself
/// and never overlaps the next card. The list shows every agent.
#[gpui::test]
fn agents_map_with_many_long_named_agents_never_overflows(cx: &mut gpui::TestAppContext) {
    let (_workspace, vcx) = cx.add_window_view(|_, cx| {
        let mut w = Workspace::for_test(learning::Coach::new(), cx);
        let mut root = session("lead", Some(LONG_TITLE));
        root.status = "working".into();
        let mut sessions = vec![root];
        for index in 0..24 {
            let id = if index % 2 == 1 {
                format!("ssh://{LONG_HOST}/agent-{index}")
            } else {
                format!("agent-{index}")
            };
            let mut child = session(&id, (index % 5 != 4).then_some(LONG_TITLE));
            child.parent_session_id = Some("lead".into());
            child.agent_label = (index % 3 == 0)
                .then(|| format!("Agent {index} with a long descriptive label for its sub task"));
            child.swarm_status =
                Some(["working", "waiting", "failed", "completed", "queued"][index % 5].into());
            sessions.push(child);
        }
        w.sessions = sessions;
        w.show_agents_view(cx);
        w
    });
    let handle = vcx.update(|window, _| window.window_handle());
    for width in [1440.0, 1024.0] {
        vcx.simulate_window_resize(handle, gpui::size(px(width), px(900.0)));
        vcx.run_until_parked();
        let map = vcx.debug_bounds("agents-swarm-map").expect("swarm map");
        let mut previous: Option<gpui::Bounds<gpui::Pixels>> = None;
        for index in 0..6 {
            let card = vcx
                .debug_bounds(format!("agents-map-agent-{index}").leak())
                .expect("visible agent card");
            assert!(contains(map, card), "width={width} card {index} leaves the map");
            for part in ["name", "machine"] {
                let inner = vcx
                    .debug_bounds(format!("agents-map-agent-{part}-{index}").leak())
                    .expect("card text");
                assert!(
                    contains(card, inner),
                    "width={width} card {index} {part} {inner:?} overflows {card:?}"
                );
            }
            if let Some(previous) = previous {
                assert!(card.left() >= previous.right(), "width={width} cards {index} overlap");
            }
            previous = Some(card);
        }
        assert!(vcx.debug_bounds("agents-map-agent-6").is_none());
        assert!(vcx.debug_bounds("agents-list-agent-23").is_some());
    }
}

/// The header keeps a very long title and project on one line each, inside
/// its slot, and the agent count stays visible after a long project name.
#[gpui::test]
fn header_with_long_title_and_project_stays_in_its_slot(cx: &mut gpui::TestAppContext) {
    let long_dir = format!("/home/dev/{}", "an-extremely-long-project-directory-name".repeat(3));
    let (workspace, vcx) = cx.add_window_view(|_, cx| {
        let mut w = Workspace::for_test(learning::Coach::new(), cx);
        w.push_test_panel("lead", cx);
        let mut root = session("lead", Some(LONG_TITLE));
        root.working_dir = Some(long_dir.clone());
        let mut sessions = vec![root];
        for index in 0..3 {
            let mut child = session(&format!("agent-{index}"), None);
            child.parent_session_id = Some("lead".into());
            sessions.push(child);
        }
        w.sessions = sessions;
        w
    });
    workspace.update(vcx, |w, cx| {
        let panel = w.test_panel(0).unwrap();
        panel.update(cx, |panel, _| {
            panel.title = LONG_TITLE.into();
            panel.working_dir = Some(long_dir.clone());
        });
        cx.notify();
    });
    let handle = vcx.update(|window, _| window.window_handle());
    // 1200 is near the narrowest window whose canvas still gets the wide
    // two-line header (canvas >= HEADER_WIDE_BREAKPOINT beside the sidebar).
    for width in [1440.0, 1280.0, 1200.0] {
        vcx.simulate_window_resize(handle, gpui::size(px(width), px(800.0)));
        vcx.run_until_parked();
        let slot = vcx.debug_bounds("header-title-slot").expect("title slot");
        let title = vcx
            .debug_bounds("header-session-title")
            .unwrap_or_else(|| panic!("header title at width={width}"));
        assert!(contains(slot, title), "width={width} title {title:?} leaves {slot:?}");
        let count = vcx.debug_bounds("header-agent-count").expect("agent count stays visible");
        assert!(contains(slot, count), "width={width} agent count {count:?} clipped by {slot:?}");
        assert!(title.size.height <= px(52.0));
    }
}

/// 60 sessions in one long-named project, including untitled ones and
/// unbroken titles: rows keep one height, and titles stay inside rows.
#[gpui::test]
fn sidebar_with_many_untitled_and_long_sessions_keeps_rows_aligned(cx: &mut gpui::TestAppContext) {
    let long_dir = format!("/home/dev/{}", "an-extremely-long-project-directory-name".repeat(3));
    let (_workspace, vcx) = cx.add_window_view(|_, cx| {
        let mut w = Workspace::for_test(learning::Coach::new(), cx);
        w.sidebar_history.show_all = true;
        w.sessions = (0..60)
            .map(|index| {
                let unbroken = "averyveryverylongunbrokentitlewithoutanyspaces".repeat(4);
                let title = match index % 4 {
                    0 => None,
                    1 => Some(""),
                    2 => Some(LONG_TITLE),
                    _ => Some(unbroken.as_str()),
                };
                let mut s = session(&format!("session_fox_{index}"), title);
                s.working_dir = Some(long_dir.clone());
                s.updated_at_ms = Some(1_000_000 - index as i64);
                s
            })
            .collect();
        w
    });
    let handle = vcx.update(|window, _| window.window_handle());
    vcx.simulate_window_resize(handle, gpui::size(px(1440.0), px(900.0)));
    vcx.run_until_parked();
    let sidebar = vcx.debug_bounds("sidebar").expect("sidebar");
    let mut heights = Vec::new();
    for index in 0..60 {
        let Some(row) = vcx.debug_bounds(format!("sidebar-session-{index}").leak()) else {
            continue;
        };
        let title = vcx
            .debug_bounds(format!("sidebar-session-title-{index}").leak())
            .expect("row title");
        assert!(contains(row, title), "row {index} title overflows");
        assert!(contains(sidebar, row), "row {index} leaves the sidebar");
        heights.push(row.size.height);
    }
    assert!(heights.len() >= 8, "visible rows: {}", heights.len());
    assert!(heights.windows(2).all(|pair| pair[0] == pair[1]), "{heights:?}");
    if let Some(label) = vcx.debug_bounds("sidebar-project-label-0") {
        assert!(contains(sidebar, label));
    }
}

fn plan_items(count: usize) -> Vec<crate::panel::Item> {
    let todos = (0..count)
        .map(|index| {
            serde_json::json!({
                "content": format!("Step {index}: {}", "a long task description ".repeat(index % 4)),
                "status": if index < count / 3 { "completed" } else { "pending" },
            })
        })
        .collect::<Vec<_>>();
    let payload = serde_json::json!({"Todos": {"todos": todos}});
    vec![
        crate::panel::Item::User("Plan this".into()),
        serde_json::from_value(payload).expect("todo payload"),
    ]
}

/// The plan inspector needs pane width, not just window width. Two half
/// panes on a 1440 window keep the plan inline instead of squeezing the
/// chat to a sliver; a lone wide pane keeps the inspector.
#[gpui::test]
fn plan_inspector_only_opens_in_a_wide_enough_pane(cx: &mut gpui::TestAppContext) {
    cx.update(|cx| crate::bind_workspace_keys(cx));
    let (workspace, vcx) = cx.add_window_view(|_, cx| {
        let mut w = Workspace::for_test(learning::Coach::new(), cx);
        w.push_test_panel("plan", cx);
        w
    });
    let panel = workspace.read_with(vcx, |w, _| w.test_panel(0)).unwrap();
    panel.update(vcx, |panel, cx| {
        *panel.items = plan_items(30);
        cx.notify();
    });
    let handle = vcx.update(|window, _| window.window_handle());
    // Wide window, one pane at full width: inspector beside the chat.
    workspace.update(vcx, |w, cx| {
        w.slots[0].width_fraction = 1.0;
        w.slots[0].animated_width = AnimatedValue::new(1.0, Duration::ZERO);
        cx.notify();
    });
    vcx.simulate_window_resize(handle, gpui::size(px(1440.0), px(900.0)));
    vcx.run_until_parked();
    vcx.run_until_parked();
    assert!(vcx.debug_bounds("plan-tab-active").is_some(), "lone wide pane shows the inspector");
    let pane = vcx.debug_bounds("pinned-todo-card").unwrap();
    let surface = vcx.debug_bounds("panel-0").unwrap();
    assert!(contains(surface, pane));

    // A second pane halves the width: the plan returns inline.
    workspace.update(vcx, |w, cx| {
        w.push_test_panel("other", cx);
        for slot in &mut w.slots {
            slot.width_fraction = 0.5;
            slot.animated_width = AnimatedValue::new(0.5, Duration::ZERO);
        }
        w.active = 0;
        cx.notify();
    });
    vcx.run_until_parked();
    vcx.run_until_parked();
    assert!(vcx.debug_bounds("plan-tab-active").is_none(), "half pane keeps the plan inline");
    assert!(vcx.debug_bounds("pinned-todo-card").is_some());

    // 1024 wide: always inline, and empty plans render nothing.
    vcx.simulate_window_resize(handle, gpui::size(px(1024.0), px(768.0)));
    vcx.run_until_parked();
    assert!(vcx.debug_bounds("plan-tab-active").is_none());
    panel.update(vcx, |panel, cx| {
        *panel.items = plan_items(0);
        cx.notify();
    });
    vcx.run_until_parked();
    assert!(vcx.debug_bounds("pinned-todo-card").is_none());
}

/// The overview's swarm card keeps a very long coordinator title on one
/// line inside the card instead of running past its right edge.
#[gpui::test]
fn overview_swarm_card_truncates_long_titles(cx: &mut gpui::TestAppContext) {
    let (workspace, vcx) = cx.add_window_view(|_, cx| {
        let mut w = Workspace::for_test(learning::Coach::new(), cx);
        w.push_test_panel("lead", cx);
        let mut sessions = vec![session("lead", Some(&LONG_TITLE.repeat(2)))];
        for index in 0..20 {
            let mut child = session(&format!("agent-{index}"), None);
            child.parent_session_id = Some("lead".into());
            child.agent_label = Some(format!("Agent {index} with a long descriptive label for its sub task"));
            sessions.push(child);
        }
        w.sessions = sessions;
        w
    });
    let handle = vcx.update(|window, _| window.window_handle());
    vcx.simulate_window_resize(handle, gpui::size(px(1440.0), px(900.0)));
    workspace.update(vcx, |w, cx| {
        w.overview = true;
        w.overview_progress = AnimatedValue::new(1.0, Duration::ZERO);
        cx.notify();
    });
    vcx.run_until_parked();
    let card = vcx.debug_bounds("overview-swarm-map").expect("swarm card");
    let title = vcx.debug_bounds("overview-swarm-title").expect("swarm title");
    assert!(contains(card, title), "title {title:?} overflows {card:?}");
}
