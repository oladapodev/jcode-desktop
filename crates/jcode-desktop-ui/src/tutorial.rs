//! A quiet, opt-in shortcut reference with every lesson in one scrollable list.
use super::*;

type TutorialAction = fn(&mut Workspace, &mut Window, &mut Context<Workspace>);
type Lesson = (
    &'static str,
    &'static str,
    &'static str,
    &'static str,
    Option<TutorialAction>,
);

impl Workspace {
    pub(super) fn render_tutorial_tab(&self, cx: &mut Context<Self>) -> gpui::AnyElement {
        let selected = self.sidebar_view == SidebarView::Learn;
        responsive::sidebar_nav_item("sidebar-learn-tab", "Learn", selected)
            .on_mouse_down(
                gpui::MouseButton::Left,
                cx.listener(|this, _, _, cx| {
                    this.sidebar_view = SidebarView::Learn;
                    cx.notify();
                }),
            )
            .into_any_element()
    }

    pub(super) fn render_tutorial_guides(&self, cx: &mut Context<Self>) -> gpui::AnyElement {
        let heading = if self.onboarding_complete() {
            "Shortcut reference"
        } else {
            "Getting started"
        };
        let modifier = if cfg!(target_os = "macos") {
            "⌘"
        } else {
            "Super"
        };
        let lessons: Vec<Lesson> = vec![
            (
                "tutorial-nav-left",
                "←  Focus left",
                "H",
                "focus_left_right",
                Some(|this, w, cx| this.focus_left(&FocusLeft, w, cx)),
            ),
            (
                "tutorial-nav-down",
                "↓  Strip below",
                "J",
                "focus_up_down",
                Some(|this, w, cx| this.focus_down(&FocusDown, w, cx)),
            ),
            (
                "tutorial-nav-up",
                "↑  Strip above",
                "K",
                "focus_up_down",
                Some(|this, w, cx| this.focus_up(&FocusUp, w, cx)),
            ),
            (
                "tutorial-nav-right",
                "→  Focus right",
                "L",
                "focus_left_right",
                Some(|this, w, cx| this.focus_right(&FocusRight, w, cx)),
            ),
            (
                "tutorial-new",
                "New session",
                "Enter",
                "new_panel",
                Some(|this, w, cx| this.new_panel(&NewPanel, w, cx)),
            ),
            (
                "tutorial-close",
                "Close panel",
                "Q",
                "close_panel",
                Some(|this, w, cx| this.close_panel(&ClosePanel, w, cx)),
            ),
            (
                "tutorial-move-left",
                "←  Move left",
                "Shift H",
                "move_panel",
                Some(|this, w, cx| this.move_panel_left(&MovePanelLeft, w, cx)),
            ),
            (
                "tutorial-move-down",
                "↓  Move down",
                "Shift J",
                "move_panel_strip",
                Some(|this, w, cx| this.move_panel_down(&MovePanelDown, w, cx)),
            ),
            (
                "tutorial-move-up",
                "↑  Move up",
                "Shift K",
                "move_panel_strip",
                Some(|this, w, cx| this.move_panel_up(&MovePanelUp, w, cx)),
            ),
            (
                "tutorial-move-right",
                "→  Move right",
                "Shift L",
                "move_panel",
                Some(|this, w, cx| this.move_panel_right(&MovePanelRight, w, cx)),
            ),
            (
                "tutorial-width-presets",
                "Panel width",
                "1 2 3 4",
                "width_presets",
                None,
            ),
            (
                "tutorial-resize",
                "Cycle width",
                "R",
                "cycle_width",
                Some(|this, w, cx| this.cycle_width(&CycleWidth, w, cx)),
            ),
            (
                "tutorial-maximize",
                "Full width / restore",
                "F",
                "maximize",
                Some(|this, w, cx| this.maximize_width(&MaximizeWidth, w, cx)),
            ),
            (
                "tutorial-overview",
                "Overview",
                "O",
                "overview",
                Some(|this, w, cx| this.toggle_overview(&ToggleOverview, w, cx)),
            ),
        ];
        let rows = lessons.into_iter().map(|(id, label, key, skill, action)| {
            let practiced = self.coach.trace(skill).practiced();
            let keycap = |text: String| {
                div()
                    .flex_none()
                    .min_w(px(20.0))
                    .h(px(20.0))
                    .px(px(6.0))
                    .flex()
                    .items_center()
                    .justify_center()
                    .rounded(px(6.0))
                    .bg(Theme::global().TOOL_BG)
                    .font_family(Theme::global().FONT_UI)
                    .text_size(px(11.0))
                    .text_color(Theme::global().TEXT_DIM)
                    .child(text)
            };
            div()
                .id(id)
                .debug_selector(move || id.into())
                .w_full()
                .min_h(px(32.0))
                .flex_none()
                .flex()
                .items_center()
                .justify_between()
                .gap_2()
                .px(px(8.0))
                .rounded(px(8.0))
                .text_size(px(13.0))
                .text_color(Theme::global().TEXT)
                .when_some(action, |el, action| {
                    el.cursor_pointer()
                        .hover(|el| el.bg(Theme::global().TOOL_BG))
                        .on_mouse_down(
                            gpui::MouseButton::Left,
                            cx.listener(move |this, _, w, cx| {
                                action(this, w, cx);
                                cx.stop_propagation();
                            }),
                        )
                })
                .child(
                    div()
                        .min_w_0()
                        .flex_1()
                        .overflow_hidden()
                        .whitespace_nowrap()
                        .text_ellipsis()
                        .child(label),
                )
                .when(practiced, |el| {
                    el.child(
                        div()
                            .debug_selector(move || format!("tutorial-learned-{skill}").into())
                            .flex_none()
                            .text_size(px(11.0))
                            .text_color(Theme::global().OK)
                            .child("✓"),
                    )
                })
                .child(if action.is_some() {
                    keycap(key.to_string()).into_any_element()
                } else {
                    div()
                        .flex()
                        .flex_none()
                        .gap(px(4.0))
                        .children((1..=4).map(|preset| {
                            keycap(preset.to_string())
                                .id(format!("tutorial-width-{preset}"))
                                .debug_selector(move || format!("tutorial-width-{preset}").into())
                                .cursor_pointer()
                                .hover(|el| {
                                    el.bg(Theme::global().USER_BG)
                                        .text_color(Theme::global().TEXT)
                                })
                                .on_mouse_down(
                                    gpui::MouseButton::Left,
                                    cx.listener(move |this, _, _, cx| {
                                        this.set_width(preset as f32 / 4.0, cx);
                                        cx.stop_propagation();
                                    }),
                                )
                        }))
                        .into_any_element()
                })
        });
        div()
            .id("tutorial-guides")
            .debug_selector(|| "tutorial-guides".into())
            .size_full()
            .min_h_0()
            .flex()
            .flex_col()
            .px_3()
            .py_4()
            .child(
                div()
                    .id("tutorial-content")
                    .debug_selector(|| "tutorial-content".into())
                    .flex_1()
                    .min_h_0()
                    .overflow_y_scroll()
                    .child(
                        div()
                            .debug_selector(|| "tutorial-heading".into())
                            .px(px(8.0))
                            .text_size(px(11.0))
                            .font_weight(gpui::FontWeight::MEDIUM)
                            .text_color(Theme::global().TEXT_FAINT)
                            .child(heading),
                    )
                    .child(
                        div()
                            .mt_1()
                            .px(px(8.0))
                            .text_size(px(15.0))
                            .font_weight(gpui::FontWeight::SEMIBOLD)
                            .text_color(Theme::global().TEXT)
                            .child("Workspace shortcuts"),
                    )
                    .child(
                        div()
                            .mt_1()
                            .mb_3()
                            .px(px(8.0))
                            .text_size(px(11.0))
                            .text_color(Theme::global().TEXT_FAINT)
                            .child(format!("Hold {modifier} with a key, or click a row")),
                    )
                    .child(div().flex().flex_col().gap(px(1.0)).children(rows)),
            )
            .into_any_element()
    }
}
