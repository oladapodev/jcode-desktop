//! Count real Panel renders, not a surrogate cache implementation.
use super::*;
use crate::render_stats::test_renders;

fn count(panel: &gpui::Entity<Panel>) -> usize {
    test_renders::count(panel.entity_id())
}

#[gpui::test]
fn panel_cache_reuses_transcript_on_workspace_notifications(cx: &mut gpui::TestAppContext) {
    let (workspace, vcx) = cx.add_window_view(|_, cx| {
        let mut workspace = Workspace::for_test(learning::Coach::new(), cx);
        workspace.push_test_panel("cached-panel", cx);
        workspace
    });
    let panel = workspace.read_with(vcx, |w, _| w.test_panel(0).unwrap());
    vcx.run_until_parked();
    // Settle camera and focus invalidations before measuring chrome-only work.
    for _ in 0..3 {
        workspace.update(vcx, |_, cx| cx.notify());
        vcx.run_until_parked();
    }
    let before = count(&panel);
    assert!(before > 0);
    for _ in 0..20 {
        workspace.update(vcx, |_, cx| cx.notify());
        vcx.run_until_parked();
    }
    assert_eq!(
        count(&panel),
        before,
        "chrome redraws must reuse the real transcript subtree"
    );
    panel.update(vcx, |_, cx| cx.notify());
    vcx.run_until_parked();
    assert!(
        count(&panel) > before,
        "panel notifications must invalidate the cached subtree"
    );
}

#[gpui::test]
fn panel_cache_preserves_streaming_and_resize(cx: &mut gpui::TestAppContext) {
    let (workspace, vcx) = cx.add_window_view(|_, cx| {
        let mut workspace = Workspace::for_test(learning::Coach::new(), cx);
        workspace.push_test_panel("cache-stream", cx);
        workspace
    });
    let panel = workspace.read_with(vcx, |w, _| w.test_panel(0).unwrap());
    vcx.run_until_parked();
    let before = count(&panel);
    panel.update(vcx, |panel, cx| {
        panel.apply(
            &jcode_sdk::ApiEvent::TextDelta {
                message_id: None,
                session_id: "cache-stream".into(),
                text: "A visible streaming response".into(),
            },
            cx,
        );
    });
    vcx.run_until_parked();
    assert!(
        count(&panel) > before,
        "streaming must invalidate cached content"
    );
    let before = count(&panel);
    vcx.simulate_resize(gpui::size(px(900.), px(700.)));
    vcx.run_until_parked();
    assert!(
        count(&panel) > before,
        "resizing must relayout cached content"
    );
}

#[gpui::test]
fn panel_cache_descendant_composer_notifications_remain_live(cx: &mut gpui::TestAppContext) {
    let (workspace, vcx) = cx.add_window_view(|_, cx| {
        let mut workspace = Workspace::for_test(learning::Coach::new(), cx);
        workspace.push_test_panel("cache-input", cx);
        workspace
    });
    let panel = workspace.read_with(vcx, |w, _| w.test_panel(0).unwrap());
    vcx.run_until_parked();
    vcx.update(|window, cx| window.focus(&panel.read(cx).input_focus_handle(cx), cx));
    vcx.run_until_parked();
    let before = count(&panel);
    vcx.simulate_keystrokes("cache");
    vcx.simulate_keystrokes("space");
    vcx.simulate_keystrokes("invalidation");
    vcx.run_until_parked();
    assert!(
        count(&panel) > before,
        "a descendant composer change must invalidate its cached parent"
    );
    assert_eq!(
        panel.read_with(vcx, |panel, cx| panel.snapshot(cx).draft.content),
        "cache invalidation"
    );
}

#[gpui::test]
fn typing_pauses_do_not_repaint_the_panel_while_the_caret_is_solid(cx: &mut gpui::TestAppContext) {
    let (workspace, vcx) = cx.add_window_view(|_, cx| {
        let mut workspace = Workspace::for_test(learning::Coach::new(), cx);
        workspace.push_test_panel("caret-solid", cx);
        workspace
    });
    let panel = workspace.read_with(vcx, |w, _| w.test_panel(0).unwrap());
    vcx.run_until_parked();
    vcx.update(|window, cx| window.focus(&panel.read(cx).input_focus_handle(cx), cx));
    vcx.simulate_keystrokes("h i");
    vcx.run_until_parked();
    vcx.update(|window, cx| window.simulate_next_frame(cx));
    vcx.run_until_parked();
    // A typing pause shorter than the solid caret phase. The caret is fully
    // opaque, so every composer frame here would re-render the whole chat
    // panel for nothing and compete with the next keystroke.
    let before = count(&panel);
    for _ in 0..12 {
        vcx.executor()
            .advance_clock(std::time::Duration::from_millis(34));
        vcx.run_until_parked();
    }
    assert!(
        count(&panel) - before <= 1,
        "solid caret repainted the panel {} times between keystrokes",
        count(&panel) - before
    );
    // Breathing still animates afterwards, in the composer alone: the panel
    // around it is drawn from the last frame.
    let input = panel.read_with(vcx, |panel, _| panel.input.clone());
    let before = count(&panel);
    let input_before = count_id(input.entity_id());
    for _ in 0..30 {
        vcx.executor()
            .advance_clock(std::time::Duration::from_millis(34));
        vcx.run_until_parked();
    }
    assert!(
        count_id(input.entity_id()) > input_before + 10,
        "caret breathing must keep animating"
    );
    assert!(
        count(&panel) - before <= 1,
        "caret breathing rebuilt the panel {} times",
        count(&panel) - before
    );
}

fn count_id(id: gpui::EntityId) -> usize {
    test_renders::count(id)
}

#[gpui::test]
fn focus_moves_and_new_panels_do_not_rerender_other_panels(cx: &mut gpui::TestAppContext) {
    let (workspace, vcx) = cx.add_window_view(|_, cx| {
        let mut workspace = Workspace::for_test(learning::Coach::new(), cx);
        for name in ["p0", "p1", "p2", "p3"] {
            workspace.push_test_panel(name, cx);
        }
        workspace
    });
    let panels: Vec<_> = (0..4)
        .map(|i| workspace.read_with(vcx, |w, _| w.test_panel(i).unwrap()))
        .collect();
    vcx.run_until_parked();
    for _ in 0..3 {
        workspace.update(vcx, |_, cx| cx.notify());
        vcx.run_until_parked();
    }
    let before: Vec<_> = panels.iter().map(count).collect();
    workspace.update_in(vcx, |w, window, cx| w.focus_left(&FocusLeft, window, cx));
    vcx.run_until_parked();
    let after: Vec<_> = panels.iter().map(count).collect();
    assert_eq!(
        after, before,
        "moving focus must reuse every panel's render"
    );
    workspace.update(vcx, |w, cx| w.push_test_panel("p4", cx));
    vcx.run_until_parked();
    let after: Vec<_> = panels.iter().map(count).collect();
    assert_eq!(after, before, "opening a panel must not rebuild the others");
}

#[gpui::test]
fn camera_pan_frames_skip_offscreen_panels(cx: &mut gpui::TestAppContext) {
    let (workspace, vcx) = cx.add_window_view(|_, cx| {
        let mut workspace = Workspace::for_test(learning::Coach::new(), cx);
        for name in ["p0", "p1", "p2", "p3"] {
            workspace.push_test_panel(name, cx);
        }
        workspace
    });
    let panels: Vec<_> = (0..4)
        .map(|i| workspace.read_with(vcx, |w, _| w.test_panel(i).unwrap()))
        .collect();
    vcx.run_until_parked();
    for _ in 0..3 {
        workspace.update(vcx, |_, cx| cx.notify());
        vcx.run_until_parked();
    }
    let before: Vec<_> = panels.iter().map(count).collect();
    for step in 0..10 {
        workspace.update(vcx, |w, cx| {
            let row = w.active_row;
            w.camera_target[row] = step as f32 * 13.0;
            w.camera_x[row] = step as f32 * 13.0;
            w.camera_started[row] = None;
            w.camera_dirty[row] = false;
            cx.notify();
        });
        vcx.run_until_parked();
    }
    let after: Vec<_> = panels.iter().map(count).collect();
    // Moving the camera changes every panel's bounds, so on-screen panels
    // are drawn again. Panels outside the viewport must not be built at all.
    let untouched = before.iter().zip(&after).filter(|(b, a)| b == a).count();
    assert!(
        untouched >= 1,
        "off-screen panels were rebuilt on every camera frame: {before:?} -> {after:?}"
    );
}

#[gpui::test]
fn panel_rebuilds_reuse_transcript_derived_data_until_items_change(cx: &mut gpui::TestAppContext) {
    let (workspace, vcx) = cx.add_window_view(|_, cx| {
        let mut workspace = Workspace::for_test(learning::Coach::new(), cx);
        workspace.push_test_panel("derived", cx);
        workspace
    });
    let panel = workspace.read_with(vcx, |w, _| w.test_panel(0).unwrap());
    panel.update(vcx, |panel, cx| {
        panel
            .items
            .extend((0..50).map(|n| crate::panel::Item::Assistant(format!("message {n}"))));
        cx.notify();
    });
    vcx.run_until_parked();
    let rows = |vcx: &mut gpui::VisualTestContext| {
        panel.read_with(vcx, |panel, _| panel.test_transcript_rows_ptr())
    };
    let before = rows(vcx);
    assert!(before.is_some());
    // Panel rebuilt without a transcript change: rows are reused, not rebuilt.
    for _ in 0..5 {
        panel.update(vcx, |_, cx| cx.notify());
        vcx.run_until_parked();
    }
    assert_eq!(
        rows(vcx),
        before,
        "unchanged transcript must reuse its rows"
    );
    panel.update(vcx, |panel, cx| {
        panel
            .items
            .push(crate::panel::Item::Assistant("one more".into()));
        cx.notify();
    });
    vcx.run_until_parked();
    assert_ne!(
        rows(vcx),
        before,
        "a transcript change must rebuild its rows"
    );
    assert_eq!(
        panel.read_with(vcx, |panel, _| panel.test_transcript_row_count()),
        51
    );
}

/// Renders of `name` recorded by `render_stats` on this test's thread.
fn view_renders(name: &str) -> u64 {
    crate::render_stats::snapshot()
        .into_iter()
        .find(|(view, _)| *view == name)
        .map_or(0, |(_, stat)| stat.renders)
}

#[gpui::test]
fn working_session_animation_ticks_do_not_rebuild_workspace_or_panel(
    cx: &mut gpui::TestAppContext,
) {
    let (workspace, vcx) = cx.add_window_view(|_, cx| {
        let mut workspace = Workspace::for_test(learning::Coach::new(), cx);
        workspace.push_test_panel("working-ticks", cx);
        workspace
    });
    let panel = workspace.read_with(vcx, |w, _| w.test_panel(0).unwrap());
    panel.update(vcx, |panel, cx| {
        panel.status = "running_tools".into();
        cx.notify();
    });
    vcx.run_until_parked();
    for _ in 0..3 {
        vcx.executor()
            .advance_clock(std::time::Duration::from_millis(34));
        vcx.run_until_parked();
    }
    let workspace_before = view_renders("Workspace");
    let panel_before = view_renders("Panel");
    let ring_before = view_renders("TabOutline");
    let spinner_before = view_renders("Spinner");
    for _ in 0..30 {
        vcx.executor()
            .advance_clock(std::time::Duration::from_millis(17));
        vcx.run_until_parked();
    }
    let workspace = view_renders("Workspace") - workspace_before;
    let panel = view_renders("Panel") - panel_before;
    let ring = view_renders("TabOutline") - ring_before;
    let spinner = view_renders("Spinner") - spinner_before;
    eprintln!("workspace={workspace} panel={panel} ring={ring} spinner={spinner}");
    assert!(
        ring + spinner > 10,
        "working indicators must keep animating (ring {ring}, spinner {spinner})"
    );
    assert!(
        workspace <= 2 && panel <= 2,
        "decorative ticks rebuilt Workspace {workspace} and Panel {panel} times in 30 frames"
    );
}

#[gpui::test]
fn running_tool_row_pulses_do_not_rebuild_the_panel(cx: &mut gpui::TestAppContext) {
    let (workspace, vcx) = cx.add_window_view(|_, cx| {
        let mut workspace = Workspace::for_test(learning::Coach::new(), cx);
        workspace.push_test_panel("running-tool", cx);
        workspace
    });
    let panel = workspace.read_with(vcx, |w, _| w.test_panel(0).unwrap());
    panel.update(vcx, |panel, cx| {
        panel.apply(
            &jcode_sdk::ApiEvent::ToolStart {
                session_id: "running-tool".into(),
                call_id: "call-1".into(),
                name: "bash".into(),
            },
            cx,
        );
    });
    vcx.run_until_parked();
    for _ in 0..3 {
        vcx.executor()
            .advance_clock(std::time::Duration::from_millis(50));
        vcx.run_until_parked();
    }
    let workspace_before = view_renders("Workspace");
    let panel_before = view_renders("Panel");
    let ticker_before = view_renders("Ticker");
    for _ in 0..20 {
        vcx.executor()
            .advance_clock(std::time::Duration::from_millis(50));
        vcx.run_until_parked();
    }
    let workspace = view_renders("Workspace") - workspace_before;
    let panel = view_renders("Panel") - panel_before;
    let ticker = view_renders("Ticker") - ticker_before;
    eprintln!("running tool: workspace={workspace} panel={panel} ticker={ticker}");
    assert!(
        ticker >= 15,
        "the running tool's pulse and clock must keep animating ({ticker} ticks)"
    );
    assert!(
        workspace <= 2 && panel <= 4,
        "a running tool row rebuilt Workspace {workspace} and Panel {panel} times in one second"
    );
}

fn idle_session(id: &str, parent: Option<&str>, status: &str) -> jcode_sdk::SessionInfo {
    jcode_sdk::SessionInfo {
        user_connected: false,
        session_id: id.into(),
        working_dir: Some("/tmp/idle-project".into()),
        title: Some(id.into()),
        status: status.into(),
        transcript_bytes: None,
        saved: false,
        updated_at_ms: Some(1),
        last_active_at_ms: Some(1),
        archived: false,
        archived_at_ms: None,
        save_label: None,
        parent_session_id: parent.map(str::to_owned),
        agent_label: parent.map(|_| "Idle agent".to_owned()),
        swarm_status: parent.map(|_| "completed".to_owned()),
        edit_stats: None,
    }
}

/// Frames requested and Workspace/Panel renders over one idle second.
fn idle_second(vcx: &mut gpui::VisualTestContext) -> (usize, u64, u64) {
    let workspace_before = view_renders("Workspace");
    let panel_before = view_renders("Panel");
    let mut frames = 0;
    for _ in 0..30 {
        frames += vcx.update(|window, cx| window.simulate_next_frame(cx));
        vcx.executor()
            .advance_clock(std::time::Duration::from_millis(34));
        vcx.run_until_parked();
    }
    (
        frames,
        view_renders("Workspace") - workspace_before,
        view_renders("Panel") - panel_before,
    )
}

fn assert_idle_workspace_is_still(layout_mode: crate::config::LayoutMode, cx: &mut gpui::TestAppContext) {
    let sessions = vec![
        idle_session("session_idle_lead", None, "idle"),
        idle_session("session_idle_agent", Some("session_idle_lead"), "completed"),
        idle_session("session_idle_other", None, "closed"),
    ];
    let (workspace, vcx) = cx.add_window_view(|_, cx| {
        let mut workspace = Workspace::for_test(learning::Coach::new(), cx);
        workspace.layout_mode = layout_mode;
        // A fresh draft panel shows the home screen.
        workspace.push_test_panel("idle-home", cx);
        workspace
    });
    workspace.update(vcx, |w, cx| {
        w.apply(Update::Sessions { sessions: sessions.clone() }, cx);
        cx.notify();
    });
    // Let entrance motion and first-layout measurements settle.
    let settle = |vcx: &mut gpui::VisualTestContext| {
        for _ in 0..4 {
            vcx.update(|window, cx| window.simulate_next_frame(cx));
            vcx.executor()
                .advance_clock(std::time::Duration::from_millis(500));
            vcx.run_until_parked();
        }
    };
    settle(vcx);
    let (frames, workspace_renders, panel_renders) = idle_second(vcx);
    assert!(
        frames == 0 && workspace_renders == 0 && panel_renders == 0,
        "{layout_mode:?}: idle sidebar, header and home requested {frames} frames and rebuilt \
         Workspace {workspace_renders} and Panel {panel_renders} times in one second"
    );

    // The periodic session refresh almost always returns the same catalog.
    let changed = workspace.update(vcx, |w, cx| {
        w.apply(Update::Sessions { sessions: sessions.clone() }, cx)
    });
    vcx.run_until_parked();
    let (frames, workspace_renders, panel_renders) = idle_second(vcx);
    assert!(!changed, "an identical session refresh must report no change");
    assert!(
        frames == 0 && workspace_renders == 0 && panel_renders == 0,
        "{layout_mode:?}: a no-op session refresh requested {frames} frames and rebuilt \
         Workspace {workspace_renders} and Panel {panel_renders} times"
    );

    // The Agents view with a finished swarm is just as still.
    workspace.update(vcx, |w, cx| w.show_agents_view(cx));
    settle(vcx);
    let (frames, workspace_renders, panel_renders) = idle_second(vcx);
    assert!(
        frames == 0 && workspace_renders == 0 && panel_renders == 0,
        "{layout_mode:?}: the idle Agents view requested {frames} frames and rebuilt \
         Workspace {workspace_renders} and Panel {panel_renders} times in one second"
    );
}

/// The shipped (redesigned) sidebar, header, home and Agents view must not
/// draw anything while nothing changes. The Normal layout once waited every
/// frame for a navigation strip the redesign no longer renders, redrawing the
/// whole workspace at the display rate for as long as the app was open.
#[gpui::test]
fn idle_workspace_views_request_no_frames_and_ignore_noop_refreshes(
    cx: &mut gpui::TestAppContext,
) {
    super::REDESIGNED_NAVIGATION_IN_TEST.with(|cell| cell.set(true));
    assert_idle_workspace_is_still(crate::config::LayoutMode::Normal, cx);
    assert_idle_workspace_is_still(crate::config::LayoutMode::FolderTabs, cx);
    super::REDESIGNED_NAVIGATION_IN_TEST.with(|cell| cell.set(false));
}
