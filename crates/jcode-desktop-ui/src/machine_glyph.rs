//! The prototype's local-machine mark: a laptop outline with a small status
//! dot at its lower right. Shared by the home chip, the header machine chip
//! and the sidebar machine card so "This laptop" reads the same everywhere.

use crate::theme::Theme;
use gpui::{Div, Rgba, div, prelude::*, px};

pub(crate) const LAPTOP_ICON: &[u8] = include_bytes!("../../../assets/icons/laptop.svg");

/// Laptop glyph in a `box_size` square. `dot` is the status colour (OK when
/// connected); `ring` is the surface behind it so the dot reads as cut out.
pub(crate) fn laptop(box_size: f32, color: Rgba, dot: Option<Rgba>, ring: Rgba) -> Div {
    let glyph = (box_size * 0.78).round();
    let dot_size = (box_size * 0.36).round().clamp(5., 9.);
    div()
        .debug_selector(|| "laptop-glyph".into())
        .relative()
        .flex_none()
        .size(px(box_size))
        .flex()
        .items_center()
        .justify_center()
        .child(gpui::svg().data(LAPTOP_ICON).size(px(glyph)).text_color(color))
        .children(dot.map(|dot| {
            div()
                .debug_selector(|| "laptop-glyph-dot".into())
                .absolute()
                .right(px(-1.))
                .bottom(px(-1.))
                .size(px(dot_size))
                .rounded_full()
                .border_1()
                .border_color(ring)
                .bg(dot)
        }))
}

/// OK while connected, WARN otherwise.
pub(crate) fn status_color(connected: bool) -> Rgba {
    let theme = Theme::global();
    if connected { theme.OK } else { theme.WARN }
}
