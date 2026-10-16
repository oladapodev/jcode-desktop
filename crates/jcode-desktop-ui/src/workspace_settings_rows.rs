//! Shared presentation for the sidebar Settings and Theme pages.
//!
//! Settings read as grouped lists: a small section label, then flat 36px rows
//! with the label on the left and a quiet control on the right. Rows carry no
//! description lines. Any detail lives in a tooltip.
use super::*;

pub(super) const ROW_HEIGHT: f32 = 44.0;
pub(super) const ROW_RADIUS: f32 = 10.0;

/// Page title at the top of a settings page.
pub(super) fn page_title(label: &'static str) -> gpui::Div {
    div()
        .flex_none()
        .px(px(10.0))
        .pt(px(8.0))
        .pb(px(8.0))
        .text_size(px(18.0))
        .font_weight(gpui::FontWeight::SEMIBOLD)
        .text_color(Theme::global().TEXT)
        .child(label)
}

/// Small medium-weight label that opens a group of rows.
pub(super) fn section_label(label: impl Into<gpui::SharedString>) -> gpui::Div {
    div()
        .flex_none()
        .px(px(10.0))
        .pt(px(18.0))
        .pb(px(6.0))
        .text_size(px(12.0))
        .font_weight(gpui::FontWeight::MEDIUM)
        .text_color(Theme::global().TEXT_FAINT)
        .child(label.into())
}

/// A flat clickable settings row. Callers add the trailing control.
pub(super) fn row(
    id: &'static str,
    label: impl Into<gpui::SharedString>,
) -> gpui::Stateful<gpui::Div> {
    let theme = Theme::global();
    div()
        .id(id)
        .debug_selector(move || id.into())
        .flex_none()
        .h(px(ROW_HEIGHT))
        .px(px(10.0))
        .rounded(px(ROW_RADIUS))
        .flex()
        .items_center()
        .justify_between()
        .gap_3()
        .cursor_pointer()
        .bg(theme.PANEL_BG)
        .text_size(px(13.0))
        .text_color(theme.TEXT)
        .hover(|el| el.bg(theme.HEADER_BG))
        .child(div().flex_1().min_w_0().truncate().child(label.into()))
}

/// Attach a plain-text tooltip, used for detail that used to sit under rows.
pub(super) fn with_tooltip(
    row: gpui::Stateful<gpui::Div>,
    text: &'static str,
) -> gpui::Stateful<gpui::Div> {
    row.tooltip(move |_, cx| cx.new(|_| remotes::HeaderTooltip(text.into())).into())
}

/// A flat on/off switch. Accent fill only when on.
pub(super) fn switch(on: bool) -> gpui::Div {
    let theme = Theme::global();
    div()
        .flex_none()
        .w(px(28.0))
        .h(px(16.0))
        .p(px(2.0))
        .rounded_full()
        .flex()
        .items_center()
        .when(on, |el| el.justify_end())
        .bg(if on {
            theme.ACCENT
        } else {
            theme.TEXT_FAINT.opacity(0.4)
        })
        .child(div().size(px(12.0)).rounded_full().bg(if on {
            theme.BG
        } else {
            theme.PANEL_BG
        }))
}

/// Current value of a multi-state row, in quiet text.
pub(super) fn value(text: impl Into<gpui::SharedString>) -> gpui::Div {
    div()
        .flex_none()
        .text_size(px(12.5))
        .text_color(Theme::global().TEXT_DIM)
        .child(text.into())
}

/// Trailing chevron for rows that open another surface.
pub(super) fn chevron() -> gpui::Div {
    div()
        .flex_none()
        .text_size(px(14.0))
        .text_color(Theme::global().TEXT_FAINT)
        .child("›")
}
