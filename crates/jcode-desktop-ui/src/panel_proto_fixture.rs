//! Offline screenshot data that mirrors the web prototype's demo content
//! (`design/prototype-v2/src/lib/data.ts`), so tile comparisons against
//! `design/reference/*.png` are like for like. Enabled with
//! `JCODE_DESKTOP_SCREENSHOT_DEMO_DATA=prototype` (`screenshot.py --demo-data
//! prototype`). Never active outside screenshot mode.
use super::{Item, TodoCardItem, TodoCardPayload, TodoCardPlan};

pub(crate) const MODEL: &str = "gpt-6-astra";
/// Share of the context window the composer meter shows.
pub(crate) const CONTEXT_PERCENT: u64 = 62;

pub(crate) fn enabled() -> bool {
    crate::harness::screenshot_mode()
        && std::env::var("JCODE_DESKTOP_SCREENSHOT_DEMO_DATA").as_deref() == Ok("prototype")
}

pub(super) fn context_tokens() -> u64 {
    let window = super::context_window_for_model(MODEL).unwrap_or(272_000);
    window * CONTEXT_PERCENT / 100
}

fn tool(id: &str, name: &str, input: serde_json::Value, output: &str) -> Item {
    Item::Tool {
        call_id: id.into(),
        name: name.into(),
        input: input.to_string(),
        output: output.into(),
        done: true,
        error: None,
    }
}

fn patch(file: &str, added: usize, removed: usize) -> String {
    let mut text = format!("*** Update File: {file}\n@@\n");
    for index in 0..removed {
        text.push_str(&format!("-    let old_{index} = 0;\n"));
    }
    for index in 0..added {
        text.push_str(&format!("+    let new_{index} = 1;\n"));
    }
    text
}

pub(super) fn items() -> Vec<Item> {
    let todos = [
        ("Collect reference photos of Lagos korope buses", "completed"),
        ("Identify the base vehicle (Suzuki Every DA52)", "completed"),
        ("Fix stray panel geometry on the korope", "completed"),
        ("Weld the danfo roof seam to the pillar", "in_progress"),
        ("Write catalog provenance tests", "pending"),
    ];
    let snippet = "pub fn roof_joints(body: &Body) -> Seam {\n    let seam = body.roof_edge();\n    // Weld the roof edge onto the pillar so no gap shows in renders.\n    let gap = seam.offset(0.0).weld(&body.pillar);\n    debug_assert!(gap.max_distance() < 1e-3);\n    gap\n}";
    let edits = format!(
        "*** Begin Patch\n{}{}{}*** End Patch",
        patch("src/scene/korope.rs", 48, 12),
        patch("src/scene/danfo_roof.rs", 21, 9),
        patch("assets/provenance.toml", 6, 0),
    );
    vec![
        Item::User("Search for the exact bus models that are used and see if there's something online you can use as a starting point. For the danfo I saw one, but the korope is the actual vehicle model. This is very good, it looks almost like the real deal, it just needs tiny details and polish.".into()),
        Item::Reasoning("The korope in the photos is a Suzuki Every (DA52) with the high roof. The danfo is a VW T3. Match by headlight shape and grille, then fix the roof seam that shows a gap.".into()),
        tool("proto-search", "websearch", serde_json::json!({"intent": "Searched the web", "query": "Suzuki Every DA52 Lagos korope"}), "8 sources"),
        tool("proto-read", "read", serde_json::json!({"intent": "Read reference photos", "file_path": "reference/transport-korope/"}), "6 images"),
        tool("proto-edit-1", "edit", serde_json::json!({"intent": "Edited src/scene/korope.rs", "file_path": "src/scene/korope.rs", "old_string": "let roof = Roof::flat(1.42);", "new_string": "let roof = Roof::high(1.58).with_drip_rail();"}), "Edited"),
        tool("proto-edit-2", "edit", serde_json::json!({"intent": "Edited src/scene/danfo_roof.rs", "file_path": "src/scene/danfo_roof.rs", "old_string": "seam.offset(0.2)", "new_string": "seam.offset(0.0).weld(&body.pillar)"}), "Edited"),
        tool("proto-bash", "bash", serde_json::json!({"intent": "Ran tests", "command": "cargo test -p render korope"}), "   Compiling render v0.4.1\n    Finished test in 38.2s\ntest geometry::no_stray_panels ... ok\ntest geometry::roof_joints ... ok\n\ntest result: ok. 14 passed; 0 failed"),
        Item::Assistant(format!("The korope now uses the **Suzuki Every DA52** high-roof body, which matches your photos: the taller roof line, drip rail and the narrow grille. I also welded the danfo roof seam to the pillar, so the gap you saw is gone. All 14 geometry tests pass.\n\n`src/scene/danfo_roof.rs`\n\n```rust\n{snippet}\n```")),
        tool("proto-changes", "apply_patch", serde_json::json!({"intent": "3 files changed", "patch_text": edits}), "Updated src/scene/korope.rs, src/scene/danfo_roof.rs and assets/provenance.toml"),
        Item::Todos(TodoCardPayload {
            todos: todos
                .into_iter()
                .map(|(content, status)| TodoCardItem {
                    content: content.into(),
                    status: status.into(),
                    group: None,
                    blocked_by: vec![],
                    confidence: None,
                    completion_confidence: None,
                })
                .collect(),
            plan: TodoCardPlan::default(),
            goals: Vec::new(),
        }),
        tool(
            "proto-ask",
            "user_response",
            serde_json::json!({
                "title": "Needs your answer",
                "content": "Should the korope keep the faded blue livery from the photos, or use a clean factory finish?\n\n- Faded, like the photos\n- Clean factory finish\n- Something else",
            }),
            "",
        ),
    ]
}
