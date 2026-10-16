//! Screenshot-only prototype panes. They use the same read-only code and change
//! review panels as production, with deterministic source files under the
//! screenshot runner's isolated directory.
use super::*;

const KOROPE: &str = "use crate::mesh::{Mesh, Roof, Grille};\nuse crate::paint::Livery;\n\n/// Lagos korope minibus, modelled on the Suzuki Every (DA52).\npub fn korope_body() -> Mesh {\n    let roof = Roof::high(1.58).with_drip_rail();\n    let grille = Grille::da52();\n    let cab = cab_shell(0.94);\n\n    // Faded blue livery sampled from the reference photos.\n    let paint = Livery::faded(\"#3f78b5\", 0.35);\n\n    Mesh::join([cab, roof, grille]).paint(paint)\n}\n";
const DANFO: &str = "use crate::mesh::{Body, Seam};\n\n/// Join the danfo roof without leaving a gap at the pillar.\npub fn roof_joints(body: &Body) -> Seam {\n    let seam = body.roof_edge();\n    // Weld the roof edge onto the pillar so no gap shows in renders.\n    let gap = seam.offset(0.0).weld(&body.pillar);\n    debug_assert!(gap.max_distance() < 1e-3);\n    gap\n}\n\n#[cfg(test)]\nmod tests {\n    use super::*;\n\n    #[test]\n    fn roof_seam_meets_pillar() {\n        let body = Body::danfo();\n        assert!(roof_joints(&body).max_distance() < 1e-3);\n    }\n}\n";

/// A complete, positioned unified diff. Counts mirror the prototype's three
/// file list, while the visible first hunk uses its actual korope source lines.
fn prototype_patch() -> String {
    fn file(patch: &mut String, path: &str, kind: &str, lines: &[String]) {
        let old = lines.iter().filter(|line| !line.starts_with('+')).count();
        let new = lines.iter().filter(|line| !line.starts_with('-')).count();
        let before = if kind == "Add" { "/dev/null".to_owned() } else { format!("a/{path}") };
        patch.push_str(&format!("diff --git a/{path} b/{path}\n"));
        if kind == "Add" {
            patch.push_str("new file mode 100644\n");
        }
        patch.push_str(&format!("--- {before}\n+++ b/{path}\n@@ -{},{} +1,{new} @@\n", if kind == "Add" { 0 } else { 1 }, old));
        for line in lines {
            patch.push_str(line);
            patch.push('\n');
        }
    }
    let mut patch = String::new();
    let mut korope = [
        " use crate::mesh::{Mesh, Roof, Grille};",
        " use crate::paint::Livery;",
        " ",
        "-/// Lagos korope minibus.",
        "+/// Lagos korope minibus, modelled on the Suzuki Every (DA52).",
        " pub fn korope_body() -> Mesh {",
        "-    let roof = Roof::flat(1.42);",
        "+    let roof = Roof::high(1.58).with_drip_rail();",
        "+    let grille = Grille::da52();",
        "     let cab = cab_shell(0.94);",
        " ",
        "+    // Faded blue livery sampled from the reference photos.",
        "+    let paint = Livery::faded(\"#3f78b5\", 0.35);",
        " ",
        "-    Mesh::join([cab, roof])",
        "+    Mesh::join([cab, roof, grille]).paint(paint)",
        " }",
        " ",
        " fn cab_shell(width: f32) -> Mesh {",
        "-    Mesh::boxed(width, 1.1, 2.2).bevel(0.04)",
        "+    Mesh::boxed(width, 1.1, 2.2)",
        "+        .bevel(0.04)",
        "+        .with_sliding_door(Side::Left)",
        " }",
        " ",
        " #[cfg(test)]",
        " mod tests {",
        "     use super::*;",
        " ",
        "     #[test]",
        "     fn roof_height_matches_reference() {",
        "         let body = korope_body();",
        "-        assert_eq!(body.roof_height(), 1.42);",
        "+        assert_eq!(body.roof_height(), 1.58);",
        "     }",
        " }",
        " ",
        " // The catalogue keeps the photographed silhouette across all angles.",
        " fn measured_silhouette(body: &Mesh) -> Silhouette {",
        "     Silhouette::from_mesh(body)",
        " }",
        " ",
        " #[test]",
        " fn grille_matches_reference_width() {",
        "     let body = korope_body();",
        "     assert!(body.grille_width() < body.cab_width());",
        " }",
        " ",
        " #[test]",
        " fn sliding_door_clears_drip_rail() {",
        "     let body = korope_body();",
        "     assert!(body.sliding_door().clears(body.roof()));",
        " }",
        " ",
    ].into_iter().map(str::to_owned).collect::<Vec<_>>();
    // The rest of the change is below the first screenshot viewport. Keep the
    // prototype's per-file totals without inventing visible context lines.
    let additions = korope.iter().filter(|line| line.starts_with('+')).count();
    let removals = korope.iter().filter(|line| line.starts_with('-')).count();
    korope.extend((additions..48).map(|n| format!("+// Reference geometry adjustment {n}")));
    korope.extend((removals..12).map(|n| format!("-// Superseded geometry adjustment {n}")));
    file(&mut patch, "src/scene/korope.rs", "Edit", &korope);

    let mut danfo = vec![
        " use crate::mesh::{Body, Seam};".into(),
        " ".into(),
        " pub fn roof_joints(body: &Body) -> Seam {".into(),
        "     let seam = body.roof_edge();".into(),
        "-    let gap = seam.offset(0.2);".into(),
        "+    // Weld the roof edge onto the pillar so no gap shows in renders.".into(),
        "+    let gap = seam.offset(0.0).weld(&body.pillar);".into(),
        "+    debug_assert!(gap.max_distance() < 1e-3);".into(),
        "     gap".into(),
        " }".into(),
    ];
    danfo.extend((3..21).map(|n| format!("+// Roof seam refinement {n}")));
    danfo.extend((1..9).map(|n| format!("-// Old roof seam refinement {n}")));
    file(&mut patch, "src/scene/danfo_roof.rs", "Edit", &danfo);
    let provenance = [
        "+[sources.korope]", "+model = \"Suzuki Every DA52\"", "+region = \"Lagos\"",
        "+[sources.danfo]", "+model = \"Volkswagen T3\"", "+region = \"Lagos\"",
    ].map(str::to_owned);
    file(&mut patch, "assets/provenance.toml", "Add", &provenance);
    patch
}

impl Workspace {
    pub(super) fn open_prototype_pane_fixture(&mut self, kind: &str, cx: &mut Context<Self>) {
        if !crate::panel::proto_fixture::enabled() || !matches!(kind, "code" | "review") {
            return;
        }
        self.show_beta_notice = false;
        let Some(root) = std::env::var_os("JCODE_DESKTOP_SCREENSHOT_PROTOTYPE_PROJECT").map(PathBuf::from) else {
            return;
        };
        let scene = root.join("src/scene");
        let assets = root.join("assets");
        std::fs::create_dir_all(&scene).expect("isolated screenshot scene directory");
        std::fs::create_dir_all(&assets).expect("isolated screenshot assets directory");
        for (path, contents) in [
            (scene.join("korope.rs"), KOROPE),
            (scene.join("danfo_roof.rs"), DANFO),
            (scene.join("lighting.rs"), "pub fn light() {}\n"),
            (root.join("src/main.rs"), "fn main() {}\n"),
            (assets.join("provenance.toml"), "[sources.korope]\nmodel = \"Suzuki Every DA52\"\n"),
        ] {
            std::fs::write(path, contents).expect("isolated screenshot source file");
        }
        let Some(mut chat_slot) = (!self.slots.is_empty()).then(|| self.slots.remove(0)) else {
            return;
        };
        let chat = chat_slot.panel.clone();
        chat.update(cx, |panel, cx| {
            panel.working_dir = Some(root.display().to_string());
            *panel.items = vec![crate::panel::Item::User("Search for the exact bus models that are used and see if there's something online you can use as a starting point. For the danfo I saw one, but the korope is the actual vehicle model. This is very good, it looks almost like the real deal, it just needs tiny details and polish.".into())];
            panel.status = "thinking".into();
            cx.notify();
        });
        let pane = if kind == "review" {
            let input = serde_json::json!({"patch_text": prototype_patch()}).to_string();
            let request = crate::ui_actions::OpenChangeReview {
                source: chat.entity_id(), name: "apply_patch".into(), input,
                output: String::new(), selected: 0, done: true, failed: false,
            };
            cx.new(|cx| Panel::new_change_review(
                format!("review://{}", chat.read(cx).session_id),
                Some(root.display().to_string()), &request, self.bridge.clone(), cx,
            ))
        } else {
            cx.new(|cx| Panel::new_code_file(scene.join("danfo_roof.rs"), self.bridge.clone(), cx))
        };
        pane.update(cx, |panel, cx| {
            panel.title = if kind == "review" { "Changes" } else { "Code" }.into();
            panel.working_dir = Some(root.display().to_string());
            cx.notify();
        });
        let pane_slot = Slot {
            panel: pane, row: self.active_row, width_fraction: 0.66,
            animated_width: AnimatedValue::new(0.66, transition::policy(Transition::PanelWidth).duration),
            order_offset: AnimatedValue::new(0.0, transition::policy(Transition::PanelOrder).duration),
            order_distance_fraction: 0.66,
            close_progress: AnimatedValue::new(1.0, transition::policy(Transition::PanelClose).duration),
            closing: false, restore_fraction: None,
        };
        chat_slot.width_fraction = 0.34;
        chat_slot.animated_width = AnimatedValue::new(0.34, transition::policy(Transition::PanelWidth).duration);
        chat_slot.order_distance_fraction = 0.34;
        self.slots = vec![pane_slot, chat_slot];
        self.active = 0;
        self.focus_pending = true;
        self.retarget_camera();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn prototype_review_patch_is_positioned_and_has_reference_file_totals() {
        let patch = prototype_patch();
        let input = serde_json::json!({"patch_text": patch}).to_string();
        let files = crate::diff::tool_diffs("apply_patch", &input);
        assert_eq!(files.iter().map(|file| (file.path.as_str(), file.added(), file.removed())).collect::<Vec<_>>(), [
            ("src/scene/korope.rs", 48, 12),
            ("src/scene/danfo_roof.rs", 21, 9),
            ("assets/provenance.toml", 6, 0),
        ]);
        let rich = crate::diff_model::from_tool_result("apply_patch", &input, "").expect("rich diff");
        assert_eq!(rich.files.len(), 3);
        assert_eq!(rich.counts(), (75, 21));
        assert_eq!(rich.files[0].hunks[0].lines[0].new_line, Some(1));
        assert!(rich.files[0].hunks[0].lines.iter().any(|line| line.emphasis.is_some()));
    }
}
