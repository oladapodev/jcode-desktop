//! App-wide opt-in sound controls. The setting is persisted, not a window snapshot.
use super::*;
use crate::sounds::{self, Cue};

impl Workspace {
    pub(super) fn render_sound_settings(&self, cx: &mut Context<Self>) -> gpui::AnyElement {
        let enabled = sounds::enabled(cx);
        let rows = super::settings_rows::with_tooltip(
            super::settings_rows::row("settings-sounds", "Sound effects"),
            "Soft cues for messages, attention, errors, finished tasks, and opening or closing panels. Applies to all windows. Off by default.",
        )
        .on_mouse_down(gpui::MouseButton::Left, cx.listener(|this, _, _, cx| {
            let enabled = !sounds::enabled(cx);
            if let Err(error) = crate::config::persist_sounds_enabled(enabled) {
                this.status = format!("Could not save sound setting: {error}");
                cx.notify();
                return;
            }
            sounds::set_enabled(enabled, cx);
            if enabled {
                sounds::play(Cue::Complete, cx);
            }
            cx.notify();
        }))
        .child(super::settings_rows::switch(enabled));
        div()
            .flex()
            .flex_col()
            .gap(px(2.0))
            .child(super::settings_rows::section_label("Sounds"))
            .child(rows)
            .when(enabled, |el| el.child(
                super::settings_rows::row("settings-sounds-preview", "Play preview")
                    .on_mouse_down(gpui::MouseButton::Left, cx.listener(|_, _, _, cx| {
                        sounds::play(Cue::Complete, cx);
                    }))
                    .child(super::settings_rows::chevron()),
            ))
            .into_any_element()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[gpui::test]
    fn settings_sounds_toggle_is_global_and_preview_is_only_available_when_enabled(
        cx: &mut gpui::TestAppContext,
    ) {
        let (workspace, vcx) = cx.add_window_view(|_, cx| {
            sounds::set_enabled(false, cx);
            let mut workspace = Workspace::for_test(learning::Coach::new(), cx);
            workspace.sidebar_view = SidebarView::Settings;
            workspace
        });
        vcx.run_until_parked();
        assert!(vcx.debug_bounds("settings-sounds-preview").is_none());
        let button = vcx.debug_bounds("settings-sounds").unwrap();
        vcx.simulate_click(button.center(), gpui::Modifiers::default());
        vcx.run_until_parked();
        assert!(workspace.read_with(vcx, |_, cx| sounds::enabled(cx)));
        let button = vcx.debug_bounds("settings-sounds-preview").unwrap();
        vcx.simulate_click(button.center(), gpui::Modifiers::default());
        vcx.run_until_parked();
        workspace.update(vcx, |_, cx| {
            assert_eq!(sounds::drain_requested(cx), [Cue::Complete, Cue::Complete]);
        });
        let button = vcx.debug_bounds("settings-sounds").unwrap();
        vcx.simulate_click(button.center(), gpui::Modifiers::default());
        vcx.run_until_parked();
        assert!(!workspace.read_with(vcx, |_, cx| sounds::enabled(cx)));
        assert!(vcx.debug_bounds("settings-sounds-preview").is_none());
    }
}
