//! Cached suggestion metadata and viewport-only model/command row rendering.
use super::*;

pub(super) struct SuggestionsCache {
    content: SharedString,
    revision: u64,
    minute: u64,
    completion: bool,
    rows: Arc<Vec<CommandSuggestion>>,
}

impl PromptInput {
    pub(super) fn reveal_command(&self, index: usize) {
        if self.command_scroll.bounds_for_item(index).is_some() {
            self.command_scroll.scroll_to_reveal_item(index);
        } else {
            // A distant item's estimated height is not its measured height.
            // Anchor by identity instead of an estimated pixel bottom, which
            // can leave the selected row just outside the virtual viewport.
            self.command_scroll.scroll_to(gpui::ListOffset {
                item_ix: index,
                offset_in_item: px(0.),
            });
        }
    }

    /// Hover changes selection, not the catalog. Retain rows across repaints and
    /// refresh relative usage labels on the next interaction after a minute.
    pub(super) fn command_suggestions(&self) -> Arc<Vec<CommandSuggestion>> {
        let minute = model_menu::now_unix_secs() / 60;
        let mut cache = self.suggestions_cache.borrow_mut();
        if let Some(cached) = cache.as_ref()
            && cached.content == self.content
            && cached.revision == self.suggestions_revision
            && cached.minute == minute
            && cached.completion == self.command_completion
        {
            return cached.rows.clone();
        }
        let rows = Arc::new(self.build_command_suggestions());
        // Metadata updates must not reset an independently scrolled menu. Only
        // changed identities/order or row geometry require fresh measurements.
        let same_layout = cache.as_ref().is_some_and(|old| {
            old.rows.len() == rows.len()
                && old.rows.iter().zip(rows.iter()).all(|(a, b)| {
                    a.value == b.value
                        && a.header == b.header
                        && a.detail.is_some() == b.detail.is_some()
                })
        });
        if !same_layout {
            self.command_scroll
                .reset_with_uniform_height(rows.len(), px(popup::ROW_HEIGHT));
        }
        *cache = Some(SuggestionsCache {
            content: self.content.clone(),
            revision: self.suggestions_revision,
            minute,
            completion: self.command_completion,
            rows: rows.clone(),
        });
        rows
    }

    pub(super) fn render_command_row(
        &self,
        index: usize,
        suggestion: CommandSuggestion,
        cx: &mut Context<Self>,
    ) -> gpui::AnyElement {
        let theme = Theme::global();
        let is_toggle = suggestion.toggle.is_some();
        let selected = index == self.command_selection;
        let model = suggestion.value.strip_prefix("/model ");
        // "Current" marks the active model or effort with a check, not words.
        let current = suggestion.help == "Current";
        let logo_svg = |provider: &str, fallback: &str, size: f32, color: gpui::Rgba| {
            match crate::accounts::logo(provider) {
                Some(bytes) => gpui::svg()
                    .data(bytes)
                    .size(px(size))
                    .flex_none()
                    .text_color(color)
                    .into_any_element(),
                None => div()
                    .size(px(size))
                    .flex_none()
                    .flex()
                    .items_center()
                    .justify_center()
                    .text_size(px(size * 0.7))
                    .font_weight(gpui::FontWeight::MEDIUM)
                    .text_color(color)
                    .child(crate::accounts::lettermark(fallback))
                    .into_any_element(),
            }
        };
        let glyph_ink = if selected { theme.TEXT } else { theme.TEXT_DIM };
        // A small filled tile holds the row's glyph: the model maker's logo
        // (never the routing service, which the group header names) or the
        // command's icon.
        let tile = |child: gpui::AnyElement| {
            div()
                .size(px(24.0))
                .flex_none()
                .flex()
                .items_center()
                .justify_center()
                .rounded(px(7.0))
                .bg(gpui::Rgba {
                    a: if selected { 0.09 } else { 0.06 },
                    ..theme.TEXT
                })
                .child(child)
        };
        let glyph = if is_toggle {
            div().w(px(24.0)).flex_none().into_any_element()
        } else if let Some(model) = model {
            let title = model_menu::pretty_title(model, &self.model_details);
            tile(
                div()
                    .debug_selector(move || format!("model-picker-logo-{index}"))
                    .child(logo_svg(
                        model_menu::model_logo(model, &self.model_details),
                        &title,
                        14.0,
                        glyph_ink,
                    ))
                    .into_any_element(),
            )
            .into_any_element()
        } else {
            tile(
                gpui::svg()
                    .data(command_glyph(&suggestion.value))
                    .size(px(14.0))
                    .flex_none()
                    .text_color(glyph_ink)
                    .into_any_element(),
            )
            .into_any_element()
        };
        let header = suggestion.header.clone().map(|header| {
            let faint = theme.TEXT_FAINT;
            let base = div()
                .debug_selector(move || format!("model-picker-group-{index}"))
                .flex()
                .items_center()
                .gap(px(6.0))
                .px(px(10.0))
                .pt(px(if index == 0 { 4.0 } else { 10.0 }))
                .pb(px(4.0))
                .text_size(px(11.0))
                .font_weight(gpui::FontWeight::MEDIUM)
                .text_color(faint);
            let Some(model) = model else {
                return base.child(header);
            };
            let parts = model_menu::header_parts(model, &self.model_details);
            base.child(logo_svg(parts.logo, &parts.provider, 12.0, faint))
                .child(div().child(parts.provider))
                .child(
                    div()
                        .debug_selector(move || format!("model-picker-auth-{index}"))
                        .ml_auto()
                        .flex()
                        .items_center()
                        .gap(px(4.0))
                        .font_weight(gpui::FontWeight::NORMAL)
                        .child(
                            gpui::svg()
                                .data(parts.auth.icon())
                                .size(px(11.0))
                                .flex_none()
                                .text_color(faint),
                        )
                        .child(parts.auth.label()),
                )
        });
        let label = model
            .map(|model| model_menu::pretty_title(model, &self.model_details))
            .unwrap_or_else(|| suggestion.value.clone());
        // Model rows carry no sub-line. Usage history lives in the tooltip.
        let usage = model.and(suggestion.detail.clone());
        let description = (!current && model.is_none() && !suggestion.help.is_empty())
            .then(|| suggestion.help.clone());
        div()
            .w_full()
            .flex_none()
            .flex()
            .flex_col()
            .children(header)
            .child(
                div()
                    .id(("slash-command", index))
                    .debug_selector(move || {
                        if is_toggle {
                            format!("model-picker-toggle-{index}")
                        } else {
                            format!("slash-command-row-{index}")
                        }
                    })
                    .flex_none()
                    .h(px(popup::ROW_HEIGHT))
                    .flex()
                    .items_center()
                    .gap(px(10.0))
                    .pl(px(5.0))
                    .pr(px(10.0))
                    .rounded(px(8.0))
                    .when(selected, |row| row.bg(popup::highlight()))
                    .when(!selected, |row| {
                        row.hover(|style| style.bg(popup::highlight()))
                    })
                    .font_family(theme.FONT_UI)
                    .text_size(px(13.0))
                    .text_color(theme.TEXT)
                    .cursor_pointer()
                    .when_some(usage, |row, usage| {
                        let usage: SharedString = usage.into();
                        row.tooltip(move |_, cx| cx.new(|_| popup::Tooltip(usage.clone())).into())
                    })
                    .on_mouse_move(cx.listener(move |this, _, _, cx| {
                        if this.command_selection != index {
                            this.command_selection = index;
                            cx.notify();
                        }
                    }))
                    .child(glyph)
                    .child(
                        div()
                            .flex()
                            .flex_1()
                            .min_w_0()
                            .overflow_hidden()
                            .items_center()
                            .gap(px(10.0))
                            .child(
                                div()
                                    .flex_none()
                                    .max_w(relative(if description.is_some() { 0.6 } else { 1.0 }))
                                    .min_w_0()
                                    .truncate()
                                    .when(is_toggle, |label| {
                                        label.text_size(px(12.5)).text_color(theme.TEXT_DIM)
                                    })
                                    .when(!is_toggle, |label| {
                                        label.font_weight(gpui::FontWeight::MEDIUM)
                                    })
                                    .child(label),
                            )
                            .children(description.map(|description| {
                                div()
                                    .flex_1()
                                    .min_w_0()
                                    .truncate()
                                    .text_size(px(12.5))
                                    .text_color(theme.TEXT_FAINT)
                                    .child(description)
                            })),
                    )
                    .children(current.then(|| {
                        div()
                            .debug_selector(move || format!("model-picker-current-{index}"))
                            .flex_none()
                            .child(
                                gpui::svg()
                                    .data(include_bytes!("../../../assets/icons/check.svg") as &[u8])
                                    .size(px(15.0))
                                    .text_color(theme.ACCENT),
                            )
                    }))
                    .child(
                        div()
                            .w(px(14.0))
                            .flex_none()
                            .text_size(px(12.0))
                            .text_color(theme.TEXT_FAINT)
                            .when(selected, |marker| {
                                marker
                                    .debug_selector(|| "slash-command-selected".into())
                                    .child("↵")
                            }),
                    )
                    .on_mouse_down(
                        MouseButton::Left,
                        cx.listener(move |this, _, window, cx| {
                            cx.stop_propagation();
                            window.focus(&this.focus_handle, cx);
                            if let Some(key) = suggestion.toggle.clone() {
                                this.toggle_model_group(key, cx);
                                return;
                            }
                            if matches!(suggestion.value.as_str(), "/model" | "/models") {
                                this.set_content("/model ".into(), cx);
                                if let Some(on_change) = &this.on_change {
                                    on_change(&this.content, cx);
                                }
                            } else {
                                this.set_content(suggestion.value.clone(), cx);
                                // Search may also match a longer model name. Click must
                                // submit this exact route, not the first substring match.
                                this.command_selection = this
                                    .command_suggestions()
                                    .iter()
                                    .position(|row| row.value == suggestion.value)
                                    .unwrap_or(0);
                                this.submit(&Submit, window, cx);
                            }
                        }),
                    ),
            )
            .into_any_element()
    }

    /// The model picker's search row. The query is typed in the composer after
    /// `/model`, so this row mirrors it rather than holding its own editor.
    pub(super) fn render_model_search_row(&self) -> Option<gpui::AnyElement> {
        let trimmed = self.content.trim_start();
        if trimmed.contains('\n') || !(trimmed == "/model" || trimmed.starts_with("/model ")) {
            return None;
        }
        let theme = Theme::global();
        let query = trimmed.strip_prefix("/model").unwrap_or_default().trim();
        Some(
            div()
                .debug_selector(|| "model-picker-search".into())
                .flex_none()
                .h(px(38.0))
                .flex()
                .items_center()
                .gap(px(8.0))
                .px(px(14.0))
                .border_b_1()
                .border_color(theme.PANEL_BORDER)
                .font_family(theme.FONT_UI)
                .text_size(px(13.0))
                .child(
                    gpui::svg()
                        .data(include_bytes!("../../../assets/icons/search.svg") as &[u8])
                        .size(px(14.0))
                        .flex_none()
                        .text_color(theme.TEXT_FAINT),
                )
                .child(if query.is_empty() {
                    div()
                        .text_color(theme.TEXT_FAINT)
                        .child("Search models")
                } else {
                    div()
                        .min_w_0()
                        .truncate()
                        .text_color(theme.TEXT)
                        .child(query.to_owned())
                })
                .into_any_element(),
        )
    }
}

/// A monochrome glyph for a slash command, reusing the embedded tool icons.
fn command_glyph(command: &str) -> &'static [u8] {
    macro_rules! tool {
        ($name:literal) => {
            include_bytes!(concat!("../../../assets/icons/tools/", $name, ".svg")) as &'static [u8]
        };
    }
    macro_rules! icon {
        ($name:literal) => {
            include_bytes!(concat!("../../../assets/icons/", $name, ".svg")) as &'static [u8]
        };
    }
    let name = command.split_whitespace().next().unwrap_or(command);
    match name {
        "/help" | "/?" | "/commands" | "/hotkeys" | "/keybindings" | "/info" | "/version"
        | "/changelog" => tool!("jcode_docs"),
        "/subagent" | "/swarm" | "/swarm-prompt" | "/overnight" | "/agents" => tool!("swarm"),
        "/observe" | "/splitview" | "/split-view" | "/btw" | "/transcript" | "/applets"
        | "/workspace" => tool!("panel"),
        "/todos" | "/todo" | "/goals" | "/plan" => tool!("todo"),
        "/ssh" | "/remote" | "/transport" => icon!("ssh"),
        "/git" | "/commit" | "/commit-and-push" | "/cut-release" | "/commit-push-release"
        | "/review" | "/autoreview" | "/judge" | "/autojudge" | "/fork" | "/split" => {
            icon!("worktree")
        }
        "/colors" | "/color" | "/config" | "/terminal-setup" | "/telemetry" | "/log"
        | "/cache" | "/debug-visual" | "/selfdev" => tool!("selfdev"),
        "/fast" | "/thinking" | "/reasoning" | "/effort" | "/alignment" => tool!("initiative"),
        "/cancel" | "/quit" => icon!("skip"),
        "/clear" | "/cls" | "/clear-view" | "/rewind" | "/reload" | "/restart" | "/rebuild"
        | "/update" | "/client-reload" | "/server-reload" | "/refresh-model-list" => {
            tool!("end_ambient_cycle")
        }
        "/poke" | "/improve" | "/refactor" | "/fix" | "/test" => tool!("edit"),
        "/compact" | "/context" | "/usage" | "/wrapped" | "/memory" => tool!("memory"),
        "/dictate" | "/dictation" => icon!("microphone"),
        "/feedback" | "/support" => tool!("send_message"),
        "/subscription" | "/subscribe" | "/account" | "/accounts" => icon!("account"),
        "/auth" | "/login" | "/logout" => icon!("key"),
        "/resume" | "/sessions" | "/session" | "/active" | "/catchup" | "/back"
        | "/resumeall" | "/resume-all" => tool!("session_search"),
        "/save" | "/unsave" => icon!("pin"),
        "/rename" => icon!("pencil"),
        "/transfer" => tool!("open"),
        "/screenshot-mode" | "/screenshot" | "/record" => icon!("image"),
        "/z" | "/zz" | "/zzz" | "/zstatus" => tool!("schedule"),
        "/provider-test-coverage" | "/model-status" => tool!("invalid"),
        _ => tool!("generic"),
    }
}
