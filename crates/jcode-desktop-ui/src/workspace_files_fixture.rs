//! Offline screenshot fixture: the Files sidebar beside a file preview,
//! a terminal and a side document (`JCODE_DESKTOP_SCREENSHOT_FILES=1`).
use super::*;

impl Workspace {
    pub(super) fn open_files_fixture(&mut self, cx: &mut Context<Self>) {
        let checkout = Path::new(env!("CARGO_MANIFEST_DIR"))
            .ancestors()
            .nth(2)
            .map(Path::to_path_buf)
            .unwrap_or_else(|| PathBuf::from("/"));
        let bridge = self.bridge.clone();
        let file = checkout.join("Cargo.toml");
        let page = jcode_sdk::SidePanelPage {
            id: "notes".into(),
            title: "Release notes".into(),
            file_path: checkout.join("design/notes.md").display().to_string(),
            content: "# Round 4\n\nCalm rows for the **Files** view, a quiet header for the \
                      terminal, and roomier documents.\n\n- File tree rows are 28px\n- Code uses \
                      `JetBrains Mono` at 12.5px\n- Line numbers sit in the gutter colour"
                .into(),
            ..Default::default()
        };
        let panels = [
            cx.new(|cx| Panel::new_code_file(file, bridge.clone(), cx)),
            cx.new(|cx| {
                Panel::new_terminal(
                    Some(checkout.display().to_string()),
                    bridge.clone(),
                    self.host,
                    None,
                    None,
                    cx,
                )
            }),
            cx.new(|cx| Panel::new_side_document("screenshot-fixture", &page, bridge.clone(), cx)),
        ];
        let fraction = 1.0 / panels.len() as f32;
        self.slots.clear();
        for panel in panels {
            self.slots.push(Slot {
                panel,
                row: self.active_row,
                width_fraction: fraction,
                animated_width: AnimatedValue::new(
                    fraction,
                    transition::policy(Transition::PanelWidth).duration,
                ),
                order_offset: AnimatedValue::new(
                    0.0,
                    transition::policy(Transition::PanelOrder).duration,
                ),
                order_distance_fraction: fraction,
                close_progress: AnimatedValue::new(
                    1.0,
                    transition::policy(Transition::PanelClose).duration,
                ),
                closing: false,
                restore_fraction: None,
            });
        }
        self.active = 0;
        self.sidebar_view = SidebarView::Files;
        for directory in ["crates", "design"] {
            self.expanded_directories.insert(checkout.join(directory));
        }
    }
}
