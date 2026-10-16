//! Compact chrome is a presentation of the same workspace, not a saved layout.
use super::*;

const COMPACT_BREAKPOINT: f32 = 1100.0;
pub(super) const SINGLE_PANEL_BREAKPOINT: f32 = 1100.0;
/// A hidden sidebar on a wide window collapses to this icon rail.
pub(super) const RAIL_WIDTH: f32 = 52.0;
/// Compact icon buttons inside the 52px rail.
const RAIL_BUTTON_SIZE: f32 = 36.0;
/// Flat sidebar navigation buttons (Normal layout).
pub(super) const NAV_ITEM_HEIGHT: f32 = 26.0;

const SHOW_SIDEBAR_ICON: &[u8] = br#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g fill="none" stroke="black" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"><rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M9 4v16M13.5 9.5 16 12l-2.5 2.5"/></g></svg>"#;
const WORKSPACE_ICON: &[u8] = br#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M9 10h12"/></svg>"#;
const SETTINGS_ICON: &[u8] = br#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><g fill="none" stroke="black" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></g></svg>"#;

pub(super) fn is_compact(width: f32) -> bool {
    width < COMPACT_BREAKPOINT
}

/// Compact windows reserve no sidebar column at all. Sessions get the full
/// width, and the sidebar opens as an overlay from the tab row's menu button.
/// A hidden sidebar on a wide window keeps a narrow icon rail.
pub(super) fn sidebar_width(visible: bool, compact: bool) -> f32 {
    match (visible, compact) {
        (_, true) => 0.0,
        (true, false) => SIDEBAR_WIDTH,
        (false, false) => RAIL_WIDTH,
    }
}

/// Whether the collapsed icon rail replaces the sidebar column.
pub(super) fn shows_rail(visible: bool, compact: bool) -> bool {
    !visible && !compact
}

/// One flat sidebar navigation button: the selected view gets a quiet fill,
/// the rest stay text until hovered. No outlines, no browser-style tabs.
pub(super) fn sidebar_nav_item(
    id: impl Into<gpui::SharedString>,
    label: &'static str,
    selected: bool,
) -> gpui::Stateful<gpui::Div> {
    let id: gpui::SharedString = id.into();
    let selector = id.clone();
    let theme = Theme::global();
    div()
        .id(id)
        .debug_selector(move || selector.to_string())
        .flex_none()
        .h(px(NAV_ITEM_HEIGHT))
        .px(px(9.0))
        .flex()
        .items_center()
        .rounded(px(8.0))
        .cursor_pointer()
        .font_family(theme.FONT_UI)
        .text_size(px(12.5))
        .font_weight(gpui::FontWeight::MEDIUM)
        .text_color(if selected { theme.TEXT } else { theme.TEXT_DIM })
        .when(selected, |el| el.bg(theme.PANEL_BG))
        .hover(|el| {
            el.bg(Theme::global().PANEL_BG)
                .text_color(Theme::global().TEXT)
        })
        .child(label)
}

fn rail_button(
    id: &'static str,
    tooltip: &'static str,
    content: gpui::AnyElement,
) -> gpui::Stateful<gpui::Div> {
    div()
        .id(id)
        .debug_selector(move || id.into())
        .group(id)
        .flex_none()
        .size(px(RAIL_BUTTON_SIZE))
        .flex()
        .items_center()
        .justify_center()
        .rounded(px(9.0))
        .cursor_pointer()
        .occlude()
        .hover(|el| el.bg(Theme::global().PANEL_BG))
        .tooltip(move |_, cx| cx.new(|_| super::remotes::HeaderTooltip(tooltip.into())).into())
        .child(content)
}

fn rail_icon(id: &'static str, data: &'static [u8], size: f32) -> gpui::AnyElement {
    gpui::svg()
        .data(data)
        .size(px(size))
        .flex_none()
        .text_color(if id == "sidebar-rail-new-session" {
            Theme::global().ACCENT
        } else {
            Theme::global().TEXT_DIM
        })
        .group_hover(id, |el| el.text_color(Theme::global().TEXT))
        .into_any_element()
}

/// Drawer dismissal is immediate: retaining sidebar controls would intercept
/// input, while dropping only the children would flash an empty closing shell.
/// GPUI has no inert subtree API, so this live navigation surface deliberately
/// uses entrance-only motion. Every reopen starts a fresh bounded entrance.
pub(super) type VisibilityMotion = jcode_desktop_motion::MenuEntrance;

impl Workspace {
    /// Toggle the visible sidebar surface, not the hidden column preference.
    /// Narrow windows use a drawer and keep sessions at full width. Wide
    /// windows toggle the persistent column without changing panel slots.
    pub(super) fn toggle_sidebar(
        &mut self,
        _: &ToggleSidebar,
        window: &mut Window,
        cx: &mut Context<Self>,
    ) {
        if is_compact(f32::from(window.viewport_size().width)) {
            self.compact_sidebar_open = !self.compact_sidebar_open;
            if self.compact_sidebar_open {
                self.show_sidebar = true;
            }
        } else {
            self.compact_sidebar_open = false;
            self.show_sidebar = !self.show_sidebar;
        }
        cx.notify();
    }

    /// Reveal the full sidebar on a chosen view, from the collapsed rail.
    fn expand_sidebar_to(&mut self, view: Option<SidebarView>, cx: &mut Context<Self>) {
        self.show_sidebar = true;
        self.compact_sidebar_open = false;
        if let Some(view) = view {
            self.sidebar_view = view;
        }
        cx.notify();
    }

    /// The collapsed sidebar: a quiet column of icon buttons. Everything the
    /// full sidebar offers stays one click away, each with a tooltip.
    pub(super) fn render_sidebar_rail(
        &self,
        fullscreen: bool,
        cx: &mut Context<Self>,
    ) -> gpui::AnyElement {
        let theme = Theme::global();
        let folders = self.layout_mode == crate::config::LayoutMode::FolderTabs;
        let account = super::sidebar_account::JcodeAccount::current();
        let signed_in = account.signed_in;
        let initial = account
            .email
            .as_deref()
            .filter(|_| signed_in && super::sidebar_account::show_email())
            .and_then(|email| email.chars().next())
            .map(|c| c.to_uppercase().to_string())
            .unwrap_or_else(|| "J".into());
        let shortcut = |mac: &'static str, other: &'static str| {
            if cfg!(target_os = "macos") { mac } else { other }
        };
        div()
            .id("sidebar-rail")
            .debug_selector(|| "sidebar-rail".into())
            .w(px(RAIL_WIDTH))
            .h_full()
            .flex_none()
            .flex()
            .flex_col()
            .items_center()
            .gap(px(4.0))
            // Clear the macOS traffic lights, which sit over this column.
            .pt(px(content_top_inset(false, fullscreen) + 12.0))
            .pb(px(10.0))
            // Its own surface in both layouts, so the icons never float on
            // the canvas. A hairline pane divider separates it from sheets
            // that share the same recessed tone in the folder layout.
            .bg(theme.HEADER_BG)
            .when(folders, |el| el.border_r_1().border_color(theme.PANEL_BORDER))
            .child(
                rail_button("sidebar-rail-brand", "Expand sidebar", div()
                    .size(px(22.0)).rounded(px(6.0)).bg(theme.ACCENT)
                    .font_family(theme.FONT_UI).font_weight(gpui::FontWeight::BOLD)
                    .text_size(px(13.0)).text_color(theme.CODE_BG)
                    .flex().items_center().justify_center().child("J").into_any_element())
                .on_mouse_down(gpui::MouseButton::Left, cx.listener(|this, _, _, cx| {
                    this.expand_sidebar_to(None, cx);
                })),
            )
            .child(div().h(px(10.0)))
            .child(
                rail_button(
                    "sidebar-rail-new-session",
                    shortcut("New session  ⌘N", "New session  Super N"),
                    rail_icon(
                        "sidebar-rail-new-session",
                        super::sidebar_worktrees::NEW_SESSION_ICON,
                        15.0,
                    ),
                )
                .bg(theme.PANEL_BG)
                .on_mouse_down(
                    gpui::MouseButton::Left,
                    cx.listener(|this, _, window, cx| {
                        window.prevent_default();
                        cx.stop_propagation();
                        this.missed("new_panel", cx);
                        this.open_new_session(cx);
                    }),
                ),
            )
            .child(
                rail_button("sidebar-rail-search", "Search sessions", rail_icon(
                    "sidebar-rail-search", br#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="1.8" stroke-linecap="round"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/></svg>"#, 16.0))
                .on_mouse_down(gpui::MouseButton::Left, cx.listener(|this, _, _, cx| {
                    this.expand_sidebar_to(Some(SidebarView::Sessions), cx);
                })),
            )
            .child(div().my(px(6.0)).h(px(1.0)).w(px(24.0)).bg(theme.PANEL_BORDER))
            .child(
                rail_button(
                    "sidebar-rail-sessions",
                    "Workspace",
                    rail_icon("sidebar-rail-sessions", WORKSPACE_ICON, 16.0),
                )
                .on_mouse_down(
                    gpui::MouseButton::Left,
                    cx.listener(|this, _, window, cx| {
                        window.prevent_default();
                        cx.stop_propagation();
                        this.expand_sidebar_to(Some(SidebarView::Sessions), cx);
                    }),
                ),
            )
            .child(
                rail_button("sidebar-rail-agents", "Agents overview", rail_icon(
                    "sidebar-rail-agents", br#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="2"/><circle cx="5" cy="18" r="2"/><circle cx="19" cy="18" r="2"/><path d="M12 7v4M5 16v-4h14v4"/></svg>"#, 16.0))
                .on_mouse_down(gpui::MouseButton::Left, cx.listener(|this, _, window, cx| {
                    this.toggle_overview(&ToggleOverview, window, cx);
                    cx.stop_propagation();
                })),
            )
            .child(
                rail_button("sidebar-rail-machines", "Machines", rail_icon(
                    "sidebar-rail-machines", br#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="14" width="18" height="7" rx="2"/><path d="M7 8h.01M7 18h.01"/></svg>"#, 16.0))
                .on_mouse_down(gpui::MouseButton::Left, cx.listener(|this, _, window, cx| {
                    this.open_machines(window, cx);
                    cx.stop_propagation();
                })),
            )
            .child(
                rail_button(
                    "sidebar-rail-files",
                    "Files and apps",
                    rail_icon("sidebar-rail-files", super::sidebar_worktrees::FOLDER_ICON, 16.0),
                )
                .on_mouse_down(
                    gpui::MouseButton::Left,
                    cx.listener(|this, _, window, cx| {
                        window.prevent_default();
                        cx.stop_propagation();
                        this.expand_sidebar_to(Some(SidebarView::Files), cx);
                    }),
                ),
            )
            .child(div().my(px(6.0)).h(px(1.0)).w(px(24.0)).bg(theme.PANEL_BORDER))
            .child(
                div().id("sidebar-rail-sessions-list").min_h_0().flex_1().flex().flex_col().items_center().gap(px(5.0))
                    .overflow_y_scroll()
                    .children(self.slots.iter().enumerate().filter(|(_, slot)| !slot.closing && !slot.panel.read(cx).session_id.starts_with("file://") && !slot.panel.read(cx).session_id.starts_with("side-panel://") && !slot.panel.read(cx).session_id.starts_with("terminal://")).take(8).map(|(index, slot)| {
                        let title = slot.panel.read(cx).title.to_string();
                        let initials = title.split_whitespace().take(2).filter_map(|word| word.chars().next()).collect::<String>();
                        let active = index == self.active;
                        div().id(("sidebar-rail-session", index))
                            .debug_selector(move || format!("sidebar-rail-session-{index}").into())
                            .size(px(RAIL_BUTTON_SIZE)).flex_none().flex().items_center().justify_center()
                            .rounded(px(9.0)).cursor_pointer().occlude()
                            .hover(|el| el.bg(Theme::global().PANEL_BG))
                            .tooltip(move |_, cx| cx.new(|_| super::remotes::HeaderTooltip(title.clone().into())).into())
                            .child(div()
                            .font_family(theme.FONT_UI).font_weight(gpui::FontWeight::MEDIUM)
                            .text_size(px(11.0)).text_color(if active { theme.TEXT } else { theme.TEXT_DIM })
                            .child(if initials.is_empty() { "J".to_string() } else { initials }))
                            .when(active, |el| el.bg(theme.PANEL_BG))
                            .on_mouse_down(gpui::MouseButton::Left, cx.listener(move |this, _, window, cx| {
                                this.set_active(index, cx);
                                this.focus_active(window, cx);
                            })).into_any_element()
                    })),
            )
            .child(
                rail_button("sidebar-rail-machine", "Current machine", rail_icon(
                    "sidebar-rail-machine", br#"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></svg>"#, 16.0))
                .on_mouse_down(gpui::MouseButton::Left, cx.listener(|this, _, window, cx| {
                    this.open_machines(window, cx);
                    cx.stop_propagation();
                })),
            )
            .child(
                rail_button(
                    "sidebar-rail-settings",
                    "Settings",
                    rail_icon("sidebar-rail-settings", SETTINGS_ICON, 16.0),
                )
                .on_mouse_down(
                    gpui::MouseButton::Left,
                    cx.listener(|this, _, window, cx| {
                        window.prevent_default();
                        cx.stop_propagation();
                        this.expand_sidebar_to(Some(SidebarView::Settings), cx);
                    }),
                ),
            )
            .child(
                rail_button(
                    "sidebar-rail-account",
                    if signed_in { "Jcode account" } else { "Sign in to Jcode" },
                    div()
                        .size(px(28.0))
                        .flex()
                        .items_center()
                        .justify_center()
                        .rounded_full()
                        .bg(if signed_in { theme.ACCENT_DIM } else { theme.PANEL_BG })
                        .font_family(theme.FONT_UI)
                        .text_size(px(12.0))
                        .font_weight(gpui::FontWeight::MEDIUM)
                        .text_color(if signed_in { theme.TEXT } else { theme.TEXT_DIM })
                        .child(initial)
                        .into_any_element(),
                )
                .on_mouse_down(
                    gpui::MouseButton::Left,
                    cx.listener(move |this, _, window, cx| {
                        window.prevent_default();
                        cx.stop_propagation();
                        if signed_in {
                            // The account menu lives in the sidebar footer.
                            this.expand_sidebar_to(None, cx);
                            if !this.account_menu.open {
                                this.toggle_account_menu(cx);
                            }
                            return;
                        }
                        // Same path as the sidebar footer's sign-in row.
                        let source = this
                            .slots
                            .get(this.active)
                            .filter(|slot| !slot.closing)
                            .map(|slot| slot.panel.entity_id());
                        match source {
                            Some(source) => this.open_accounts(
                                &OpenAccounts {
                                    source,
                                    login_command: Some("/login jcode".into()),
                                },
                                window,
                                cx,
                            ),
                            None => this.open_account_sign_in(window, cx),
                        }
                    }),
                ),
            )
            .child(
                rail_button("sidebar-rail-expand", "Expand sidebar", rail_icon(
                    "sidebar-rail-expand", SHOW_SIDEBAR_ICON, 16.0))
                .on_mouse_down(gpui::MouseButton::Left, cx.listener(|this, _, _, cx| {
                    this.expand_sidebar_to(None, cx);
                })),
            )
            .into_any_element()
    }

    /// The only compact sidebar affordance: a quiet button in the tab row
    /// where the connection status normally sits. Workspaces stay reachable
    /// through the numbered tab groups, so no extra column is spent on them.
    pub(super) fn render_compact_menu_button(
        &self,
        left: f32,
        cx: &mut Context<Self>,
    ) -> gpui::AnyElement {
        div()
            .id("compact-sidebar-toggle")
            .debug_selector(|| "compact-sidebar-toggle".into())
            .group("compact-sidebar-toggle")
            .absolute()
            .left(px(left + 4.0))
            .top_0()
            .size(px(28.0))
            .flex()
            .items_center()
            .justify_center()
            .rounded(px(8.0))
            .cursor_pointer()
            .occlude()
            .tooltip(|_, cx| {
                cx.new(|_| super::remotes::HeaderTooltip("Show sidebar (Ctrl+B)".into()))
                    .into()
            })
            .hover(|el| {
                el.bg(Theme::global().PANEL_BG)
                    .text_color(Theme::global().TEXT)
            })
            .on_mouse_down(
                gpui::MouseButton::Left,
                cx.listener(|this, _, window, cx| {
                    window.prevent_default();
                    cx.stop_propagation();
                    if this.show_sidebar {
                        this.compact_sidebar_open = !this.compact_sidebar_open;
                    } else {
                        // Restores a sidebar hidden with Ctrl+B or its hide
                        // button. Wide windows reset the drawer flag on render.
                        this.show_sidebar = true;
                        this.compact_sidebar_open = true;
                    }
                    window.focus(&this.focus_handle, cx);
                    cx.notify();
                }),
            )
            .child(rail_icon("compact-sidebar-toggle", SHOW_SIDEBAR_ICON, 16.0))
            .into_any_element()
    }

    pub(super) fn render_compact_sidebar_overlay(
        &mut self,
        fullscreen: bool,
        progress: f32,
        cx: &mut Context<Self>,
    ) -> gpui::AnyElement {
        let offset = -SIDEBAR_WIDTH * (1.0 - progress);
        div()
            .opacity(progress)
            .absolute()
            .top_0()
            .bottom_0()
            .left_0()
            .right_0()
            .debug_selector(|| "compact-sidebar-overlay".into())
            .child(
                div()
                    .id("compact-sidebar-backdrop")
                    .debug_selector(|| "compact-sidebar-backdrop".into())
                    .absolute()
                    .size_full()
                    .bg(gpui::rgba(0x00000066))
                    .on_mouse_down(
                        gpui::MouseButton::Left,
                        cx.listener(|this, _, window, cx| {
                            this.compact_sidebar_open = false;
                            this.focus_active(window, cx);
                            cx.stop_propagation();
                            cx.notify();
                        }),
                    ),
            )
            .child(
                div()
                    .absolute()
                    .left(px(offset))
                    .top_0()
                    .bottom_0()
                    .w(px(SIDEBAR_WIDTH))
                    .bg(Theme::global().HEADER_BG)
                    .border_r_1()
                    .border_color(Theme::global().PANEL_BORDER)
                    .occlude()
                    .child(self.render_sidebar(fullscreen, cx)),
            )
            .child(
                div()
                    .id("compact-sidebar-close")
                    .debug_selector(|| "compact-sidebar-close".into())
                    .absolute()
                    .left(px(SIDEBAR_WIDTH + 8.0 + offset))
                    .top(px(10.0))
                    .size(px(36.0))
                    .rounded_md()
                    .bg(Theme::global().PANEL_BG)
                    .flex()
                    .items_center()
                    .justify_center()
                    .cursor_pointer()
                    .child("×")
                    .on_mouse_down(
                        gpui::MouseButton::Left,
                        cx.listener(|this, _, window, cx| {
                            this.compact_sidebar_open = false;
                            this.focus_active(window, cx);
                            cx.stop_propagation();
                            cx.notify();
                        }),
                    ),
            )
            .into_any_element()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[gpui::test]
    fn super_b_opens_and_closes_compact_sidebar(cx: &mut gpui::TestAppContext) {
        cx.update(crate::bind_workspace_keys);
        let (workspace, vcx) = cx.add_window_view(|_, cx| {
            let mut w = Workspace::for_test(learning::Coach::new(), cx);
            w.push_test_panel("Draft", cx);
            w
        });
        vcx.update(|_, cx| cx.set_reduce_motion(true));
        let handle = vcx.update(|window, _| window.window_handle());
        vcx.simulate_window_resize(handle, gpui::size(px(800.), px(600.)));
        vcx.run_until_parked();

        // Reveal both a responsive-hidden sidebar and an explicitly hidden one.
        for preference in [true, false] {
            workspace.update(vcx, |w, cx| {
                w.show_sidebar = preference;
                w.compact_sidebar_open = false;
                cx.notify();
            });
            vcx.run_until_parked();
            assert!(vcx.debug_bounds("sidebar").is_none());
            vcx.update(|window, cx| {
                let w = workspace.read(cx);
                let focus = if preference {
                    w.focus_handle.clone()
                } else {
                    w.slots[0].panel.read(cx).input_focus_handle(cx)
                };
                window.focus(&focus, cx);
                assert!(focus.is_focused(window));
            });
            vcx.simulate_keystrokes("super-b");
            vcx.run_until_parked();
            assert!(vcx.debug_bounds("compact-sidebar-overlay").is_some());
            assert!(vcx.debug_bounds("sidebar").is_some());
            workspace.read_with(vcx, |w, _| {
                assert!(w.show_sidebar);
                assert!(w.compact_sidebar_open);
            });
            let canvas = vcx.debug_bounds("workspace-canvas").unwrap();
            assert_eq!(canvas.left(), px(0.0));
            assert_eq!(canvas.right(), px(800.0));

            vcx.simulate_keystrokes("super-b");
            vcx.run_until_parked();
            assert!(vcx.debug_bounds("compact-sidebar-overlay").is_none());
            assert!(vcx.debug_bounds("sidebar").is_none());
            workspace.read_with(vcx, |w, _| {
                assert!(
                    w.show_sidebar,
                    "closing the drawer keeps the column preference"
                );
                assert!(!w.compact_sidebar_open);
            });
        }

        // Growing while the drawer is open restores the column and clears
        // overlay state before the next shrink.
        vcx.simulate_keystrokes("super-b");
        vcx.run_until_parked();
        vcx.simulate_window_resize(handle, gpui::size(px(1600.), px(900.)));
        vcx.run_until_parked();
        assert!(vcx.debug_bounds("compact-sidebar-overlay").is_none());
        assert!(vcx.debug_bounds("sidebar").is_some());
        workspace.read_with(vcx, |w, _| assert!(!w.compact_sidebar_open));
        vcx.simulate_window_resize(handle, gpui::size(px(800.), px(600.)));
        vcx.run_until_parked();
        assert!(vcx.debug_bounds("sidebar").is_none());
    }

    #[gpui::test]
    fn super_b_toggles_wide_sidebar_column(cx: &mut gpui::TestAppContext) {
        cx.update(crate::bind_workspace_keys);
        let (workspace, vcx) = cx.add_window_view(|_, cx| {
            let mut w = Workspace::for_test(learning::Coach::new(), cx);
            w.push_test_panel("Draft", cx);
            w
        });
        let handle = vcx.update(|window, _| window.window_handle());
        vcx.simulate_window_resize(handle, gpui::size(px(1600.), px(900.)));
        vcx.run_until_parked();
        vcx.update(|window, cx| {
            let focus = workspace.read(cx).focus_handle.clone();
            window.focus(&focus, cx);
        });
        assert!(vcx.debug_bounds("sidebar").is_some());
        vcx.simulate_keystrokes("super-b");
        vcx.run_until_parked();
        assert!(vcx.debug_bounds("sidebar").is_none());
        workspace.read_with(vcx, |w, _| {
            assert!(!w.show_sidebar);
            assert!(!w.compact_sidebar_open);
        });
        // Wide windows keep the collapsed icon rail, and give the rest back.
        let rail = vcx.debug_bounds("sidebar-rail").unwrap();
        assert_eq!(rail.size.width, px(RAIL_WIDTH));
        assert_eq!(
            vcx.debug_bounds("workspace-canvas").unwrap().left(),
            rail.right()
        );
        vcx.simulate_keystrokes("super-b");
        vcx.run_until_parked();
        assert!(vcx.debug_bounds("sidebar").is_some());
        workspace.read_with(vcx, |w, _| assert!(w.show_sidebar));
    }

    #[test]
    fn drawer_entrance_has_intermediate_frames_and_bounded_idle() {
        let mut motion = VisibilityMotion::default();
        let now = Instant::now();
        let duration = std::time::Duration::from_millis(180);
        assert_eq!(motion.update(false, now, duration), 0.0);
        assert!(!motion.is_animating());
        assert_eq!(motion.update(true, now, duration), 0.0);
        let midway = motion.update(true, now + duration / 2, duration);
        assert!(midway > 0.0 && midway < 1.0);
        assert_eq!(motion.update(true, now + duration, duration), 1.0);
        assert!(!motion.is_animating());
        assert_eq!(motion.update(true, now + duration * 5, duration), 1.0);
        assert!(!motion.is_animating());
    }

    #[test]
    fn drawer_dismissal_is_immediate_and_reopen_starts_fresh() {
        let mut motion = VisibilityMotion::default();
        let now = Instant::now();
        let duration = std::time::Duration::from_millis(180);
        motion.update(true, now, duration);
        assert!(motion.update(true, now + duration / 2, duration) > 0.0);
        assert_eq!(motion.update(false, now + duration / 2, duration), 0.0);
        assert!(!motion.is_animating());
        assert_eq!(motion.update(true, now + duration / 2, duration), 0.0);
        assert!(motion.is_animating());
        assert_eq!(
            motion.update(true, now + duration / 2, std::time::Duration::ZERO),
            1.0
        );
        assert!(!motion.is_animating());
        assert_eq!(motion.update(false, now, std::time::Duration::ZERO), 0.0);
        assert!(!motion.is_animating());
    }

    #[gpui::test]
    fn resize_prioritizes_one_chat_and_restores_width_presets(cx: &mut gpui::TestAppContext) {
        cx.update(crate::bind_workspace_keys);
        let (workspace, vcx) = cx.add_window_view(|_, cx| {
            let mut w = Workspace::for_test(learning::Coach::new(), cx);
            for name in ["First", "Second"] {
                w.push_test_panel(name, cx);
            }
            for slot in &mut w.slots {
                slot.width_fraction = 0.5;
                slot.animated_width =
                    AnimatedValue::new(0.5, transition::policy(Transition::PanelWidth).duration);
            }
            w.active = 1;
            w
        });
        let handle = vcx.update(|window, _| window.window_handle());
        for (width, height) in [
            (1600., 900.),
            (960., 700.),
            (800., 600.),
            (640., 480.),
            (480., 640.),
            (1600., 600.),
        ] {
            vcx.simulate_window_resize(handle, gpui::size(px(width), px(height)));
            vcx.run_until_parked();
            vcx.update(|window, _| window.refresh());
            vcx.run_until_parked();
            let canvas = vcx.debug_bounds("workspace-canvas").unwrap();
            let panel = vcx.debug_bounds("panel-1").unwrap();
            assert!(
                panel.left() >= canvas.left() - px(1.0),
                "{width}: {panel:?} vs {canvas:?}"
            );
            assert!(
                panel.right() <= canvas.right() + px(1.0),
                "{width}: {panel:?} vs {canvas:?}"
            );
            assert!(panel.bottom() <= px(height));
            if is_compact(width) {
                assert!(vcx.debug_bounds("sidebar").is_none());
                assert!(vcx.debug_bounds("compact-sidebar-toggle").is_some());
                assert_eq!(canvas.left(), px(0.0));
                assert_eq!(canvas.right(), px(width));
                assert!((panel.size.width - canvas.size.width).abs() < px(2.0));
                if let Some(other) = vcx.debug_bounds("panel-0") {
                    assert!(other.right() <= canvas.left() + px(1.0));
                }
            } else {
                assert!(vcx.debug_bounds("compact-sidebar-toggle").is_none());
                assert_eq!(
                    vcx.debug_bounds("sidebar").unwrap().size.width,
                    px(SIDEBAR_WIDTH)
                );
                assert!((panel.size.width - canvas.size.width / 2.0).abs() < px(2.0));
            }
            workspace.read_with(vcx, |w, _| {
                assert!(w.show_sidebar);
                assert_eq!(w.active, 1);
                assert!(w.slots.iter().all(|s| s.width_fraction == 0.5));
            });
        }
    }

    #[gpui::test]
    fn reduced_motion_drawer_snaps_and_dismissal_restores_input(cx: &mut gpui::TestAppContext) {
        cx.update(crate::bind_workspace_keys);
        let (workspace, vcx) = cx.add_window_view(|_, cx| {
            let mut w = Workspace::for_test(learning::Coach::new(), cx);
            w.push_test_panel("Draft", cx);
            w
        });
        vcx.update(|_, cx| cx.set_reduce_motion(true));
        let handle = vcx.update(|window, _| window.window_handle());
        vcx.simulate_window_resize(handle, gpui::size(px(800.), px(600.)));
        vcx.run_until_parked();
        let toggle = vcx.debug_bounds("compact-sidebar-toggle").unwrap();
        vcx.simulate_click(toggle.center(), gpui::Modifiers::default());
        vcx.run_until_parked();
        assert_eq!(vcx.debug_bounds("sidebar").unwrap().left(), px(0.0));
        workspace.read_with(vcx, |w, _| {
            assert!(w.compact_sidebar_open);
            assert!(!w.compact_sidebar_motion.is_animating());
        });
        vcx.simulate_keystrokes("escape");
        vcx.run_until_parked();
        assert!(vcx.debug_bounds("compact-sidebar-overlay").is_none());
        vcx.simulate_input("Input restored");
        workspace.read_with(vcx, |w, cx| {
            assert!(!w.compact_sidebar_open);
            assert!(!w.compact_sidebar_motion.is_animating());
            assert_eq!(
                w.slots[0].panel.read(cx).input.read(cx).content.as_ref(),
                "Input restored"
            );
        });
    }

    #[gpui::test]
    fn sidebar_hide_and_show_buttons_round_trip(cx: &mut gpui::TestAppContext) {
        let (workspace, vcx) = cx.add_window_view(|_, cx| {
            let mut w = Workspace::for_test(learning::Coach::new(), cx);
            w.push_test_panel("Hide", cx);
            w
        });
        let handle = vcx.update(|window, _| window.window_handle());
        let click = |vcx: &mut gpui::VisualTestContext, selector: &'static str| {
            let bounds = vcx
                .debug_bounds(selector)
                .unwrap_or_else(|| panic!("missing {selector}"));
            vcx.simulate_click(bounds.center(), gpui::Modifiers::default());
            vcx.run_until_parked();
        };
        // Wide window: the sidebar button hides it, the tab-row pill restores it.
        vcx.simulate_window_resize(handle, gpui::size(px(1440.), px(800.)));
        vcx.run_until_parked();
        assert!(vcx.debug_bounds("sidebar").is_some());
        click(vcx, "sidebar-hide");
        assert!(vcx.debug_bounds("sidebar").is_none());
        assert!(!workspace.read_with(vcx, |w, _| w.show_sidebar));
        click(vcx, "compact-sidebar-toggle");
        assert!(vcx.debug_bounds("sidebar").is_some());
        assert!(vcx.debug_bounds("compact-sidebar-toggle").is_none());
        // Compact window: the same button only dismisses the drawer. Snap the
        // drawer so the click lands on its settled position.
        vcx.update(|_, cx| cx.set_reduce_motion(true));
        vcx.simulate_window_resize(handle, gpui::size(px(640.), px(600.)));
        vcx.run_until_parked();
        click(vcx, "compact-sidebar-toggle");
        assert!(workspace.read_with(vcx, |w, _| w.compact_sidebar_open));
        click(vcx, "sidebar-hide");
        workspace.read_with(vcx, |w, _| {
            assert!(!w.compact_sidebar_open);
            assert!(w.show_sidebar);
        });
    }

    #[gpui::test]
    fn compact_sidebar_opens_without_reflow_and_escape_preserves_draft(
        cx: &mut gpui::TestAppContext,
    ) {
        cx.update(crate::bind_workspace_keys);
        let (workspace, vcx) = cx.add_window_view(|_, cx| {
            let mut w = Workspace::for_test(learning::Coach::new(), cx);
            w.push_test_panel("Draft", cx);
            w
        });
        let handle = vcx.update(|window, _| window.window_handle());
        vcx.simulate_window_resize(handle, gpui::size(px(800.), px(600.)));
        vcx.run_until_parked();
        workspace.update(vcx, |w, cx| {
            w.focus_pending = true;
            cx.notify();
        });
        vcx.run_until_parked();
        vcx.simulate_input("Keep this draft");
        vcx.update(|window, _| window.refresh());
        vcx.run_until_parked();
        let before = vcx.debug_bounds("workspace-canvas").unwrap();
        for dismiss in ["escape", "close", "backdrop"] {
            vcx.update(|window, _| window.refresh());
            vcx.run_until_parked();
            let toggle = vcx.debug_bounds("compact-sidebar-toggle").unwrap();
            vcx.simulate_click(toggle.center(), gpui::Modifiers::default());
            vcx.run_until_parked();
            // Settle deterministically without a wall-clock sleep. The first
            // frame still exercises the real entrance geometry.
            workspace.update(vcx, |w, cx| {
                w.compact_sidebar_motion
                    .update(true, Instant::now(), std::time::Duration::ZERO);
                cx.notify();
            });
            vcx.run_until_parked();
            assert!(vcx.debug_bounds("sidebar").is_some());
            assert_eq!(vcx.debug_bounds("workspace-canvas").unwrap(), before);
            match dismiss {
                "escape" => vcx.simulate_keystrokes("escape"),
                "close" => {
                    let close = vcx.debug_bounds("compact-sidebar-close").unwrap();
                    vcx.simulate_click(close.center(), gpui::Modifiers::default());
                }
                _ => {
                    vcx.simulate_click(gpui::point(px(750.), px(300.)), gpui::Modifiers::default())
                }
            }
            vcx.run_until_parked();
            assert!(
                vcx.debug_bounds("compact-sidebar-overlay").is_none(),
                "{dismiss}"
            );
            workspace.read_with(vcx, |w, cx| {
                assert!(!w.compact_sidebar_open);
                assert!(!w.compact_sidebar_motion.is_animating());
                assert_eq!(
                    w.slots[0].panel.read(cx).input.read(cx).content.as_ref(),
                    "Keep this draft"
                );
            });
        }
        // Explicitly hiding the sidebar remains respected across resizing,
        // with the menu pill left as the mouse path to bring it back.
        workspace.update(vcx, |w, cx| {
            w.show_sidebar = false;
            cx.notify();
        });
        for width in [800., 1600., 640.] {
            vcx.simulate_window_resize(handle, gpui::size(px(width), px(600.)));
            vcx.run_until_parked();
            assert!(vcx.debug_bounds("sidebar").is_none());
            assert!(vcx.debug_bounds("compact-sidebar-overlay").is_none());
            assert!(vcx.debug_bounds("compact-sidebar-toggle").is_some());
        }
    }
}
