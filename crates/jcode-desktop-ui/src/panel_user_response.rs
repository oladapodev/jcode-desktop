//! Agent-authored responses are transcript content, not tool activity.
use crate::{markdown, text_selection::TextSelection, theme::Theme};
use gpui::{prelude::*, *};

#[derive(Debug, serde::Deserialize, PartialEq)]
pub(super) struct Response {
    pub content: String,
    pub title: Option<String>,
}

pub(super) fn parse(name: &str, input: &str) -> Option<Response> {
    (name == "user_response")
        .then(|| serde_json::from_str(input).ok())
        .flatten()
}

/// A max-height constraint preserves natural height for short responses. GPUI's
/// overflow scrolling only has a scroll range when the content exceeds the cap.
fn height_cap(viewport: Pixels) -> Pixels {
    px(f32::from(viewport).max(1.))
}

/// Called with the chosen option text (or `None` for "Something else").
pub(super) type AnswerHandler = std::rc::Rc<dyn Fn(Option<String>, &mut Window, &mut App)>;

/// A question with a trailing bullet list of short options is an ask card.
pub(super) fn ask(response: &Response) -> Option<(String, Vec<String>)> {
    let lines: Vec<&str> = response.content.lines().collect();
    let first_bullet = lines
        .iter()
        .position(|l| l.trim_start().starts_with("- ") || l.trim_start().starts_with("* "))?;
    let question = lines[..first_bullet].join("\n").trim().to_owned();
    let options: Vec<String> = lines[first_bullet..]
        .iter()
        .filter(|l| !l.trim().is_empty())
        .map(|l| {
            l.trim_start()
                .strip_prefix("- ")
                .or_else(|| l.trim_start().strip_prefix("* "))
                .map(|o| o.trim().to_owned())
        })
        .collect::<Option<_>>()?;
    let titled = response
        .title
        .as_deref()
        .is_some_and(|t| t.to_lowercase().contains("answer"));
    let plausible = question.ends_with('?')
        && (2..=6).contains(&options.len())
        && options.iter().all(|o| !o.is_empty() && o.chars().count() <= 60);
    ((titled || plausible) && !question.is_empty() && !options.is_empty()).then(|| {
        let options = options
            .into_iter()
            .filter(|o| !o.eq_ignore_ascii_case("something else"))
            .collect();
        (question, options)
    })
}

fn render_ask(
    question: &str,
    options: &[String],
    index: usize,
    on_answer: AnswerHandler,
) -> AnyElement {
    let theme = Theme::global();
    let mut row = div().flex().flex_wrap().gap_2();
    for (i, option) in options.iter().enumerate() {
        let handler = on_answer.clone();
        let text = option.clone();
        row = row.child(
            div()
                .id(("ask-option", index * 16 + i))
                .debug_selector(move || format!("ask-option-{i}").into())
                .px_3p5()
                .py_1p5()
                .rounded_full()
                .border_1()
                .border_color(theme.TEXT_FAINT.opacity(0.4))
                .text_size(px(13.))
                .font_weight(FontWeight::MEDIUM)
                .text_color(theme.TEXT)
                .cursor_pointer()
                .hover(|el| el.bg(theme.USER_BG))
                .child(option.clone())
                .on_click(move |_, window, cx| {
                    handler(Some(text.clone()), window, cx);
                    cx.stop_propagation();
                }),
        );
    }
    let handler = on_answer;
    row = row.child(
        div()
            .id(("ask-other", index))
            .debug_selector(|| "ask-something-else".into())
            .px_3p5()
            .py_1p5()
            .rounded_full()
            .text_size(px(13.))
            .font_weight(FontWeight::MEDIUM)
            .text_color(theme.TEXT_DIM)
            .cursor_pointer()
            .hover(|el| el.bg(theme.USER_BG).text_color(theme.TEXT))
            .child("Something else")
            .on_click(move |_, window, cx| {
                handler(None, window, cx);
                cx.stop_propagation();
            }),
    );
    div()
        .id(("user-response", index))
        .debug_selector(|| "user-response-card".into())
        .w_full()
        .min_w_0()
        .flex_shrink_0()
        .rounded(px(16.))
        .bg(theme.WARN.opacity(0.08))
        .p_4()
        .font_family(theme.FONT_UI)
        .child(
            div()
                .mb_1p5()
                .flex()
                .items_center()
                .gap_2()
                .text_size(px(13.))
                .font_weight(FontWeight::MEDIUM)
                .text_color(theme.WARN)
                .child("?")
                .child("Needs your answer"),
        )
        .child(
            div()
                .w_full()
                .mb(px(14.))
                .text_size(px(14.5))
                .line_height(px(23.))
                .text_color(theme.TEXT)
                .child(question.to_owned()),
        )
        .child(row)
        .into_any_element()
}

pub(super) fn render(
    response: &Response,
    index: usize,
    viewport_height: Pixels,
    selection: &Entity<TextSelection>,
    on_preview: markdown::MediaPreviewHandler,
    on_answer: AnswerHandler,
    window: &mut Window,
    cx: &mut App,
) -> AnyElement {
    if let Some((question, options)) = ask(response) {
        return render_ask(&question, &options, index, on_answer);
    }
    div()
        .id(("user-response", index))
        .debug_selector(|| "user-response-card".into())
        .w_full()
        .min_w_0()
        .flex_shrink_0()
        .max_h(height_cap(viewport_height))
        .overflow_y_scroll()
        .rounded_xl()
        .bg(Theme::global().TOOL_BG)
        .p_4()
        .font_family(Theme::global().FONT_AI)
        .text_color(Theme::global().TEXT)
        .when_some(
            response.title.as_ref().filter(|s| !s.trim().is_empty()),
            |el, title| {
                el.child(
                    div()
                        .mb_3()
                        .font_weight(FontWeight::SEMIBOLD)
                        .child(title.clone()),
                )
            },
        )
        .child(markdown::render_interactive(
            &response.content,
            index,
            selection,
            window,
            cx,
            false,
            on_preview,
        ))
        .into_any_element()
}

pub(super) fn fixture_items_for(fixture: &str) -> Vec<super::Item> {
    let mut items = fixture_items();
    match fixture {
        "user-response-short" => {
            items.truncate(1);
        }
        "user-response-long" => {
            items.remove(0);
        }
        _ => {}
    }
    items
}

pub(super) fn fixture_items() -> Vec<super::Item> {
    let short = "## Ready to review\n\nA short **Markdown response** with a [link](https://example.com), a list, and inline `code`.\n\n- Natural content height\n- No tool chrome";
    let long = (1..=45).map(|i| format!("### Section {i}\n\nThis oversized response remains accessible by scrolling inside the card. **Markdown** stays interactive.\n\n")).collect::<String>();
    [
        ("Short response", short.to_owned()),
        ("Oversized response", long),
    ]
    .into_iter()
    .enumerate()
    .map(|(i, (title, content))| super::Item::Tool {
        call_id: format!("user-response-fixture-{i}"),
        name: "user_response".into(),
        input: serde_json::json!({"title": title, "content": content}).to_string(),
        output: String::new(),
        done: true,
        error: None,
    })
    .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use core::prelude::v1::test;

    #[core::prelude::v1::test]
    fn accepts_content_and_optional_title_only_for_response_tool() {
        assert_eq!(
            parse("user_response", r#"{"content":"**hello**"}"#),
            Some(Response {
                content: "**hello**".into(),
                title: None
            })
        );
        assert!(parse("bash", r#"{"content":"hello"}"#).is_none());
        assert!(parse("user_response", r#"{"title":"missing content"}"#).is_none());
        assert!(parse("user_response", r#"{"content":42}"#).is_none());
    }

    #[core::prelude::v1::test]
    fn sizing_caps_at_viewport_without_imposing_minimum_content_height() {
        assert_eq!(height_cap(px(600.)), px(600.));
        assert_eq!(height_cap(px(240.)), px(240.));
        assert_eq!(height_cap(px(0.)), px(1.));
    }

    #[gpui::test]
    fn rendered_short_and_long_cards_use_natural_and_capped_height(cx: &mut gpui::TestAppContext) {
        cx.update(|cx| crate::bind_workspace_keys(cx));
        let (workspace, vcx) = cx.add_window_view(|_, cx| {
            let mut workspace =
                crate::workspace::Workspace::for_test(crate::learning::Coach::new(), cx);
            workspace.push_test_panel("response-test", cx);
            workspace
        });
        vcx.run_until_parked();
        let panel = workspace
            .read_with(vcx, |workspace, _| workspace.test_panel(0))
            .unwrap();
        let fixtures = fixture_items();
        let mut heights = Vec::new();
        for item in fixtures {
            panel.update(vcx, |panel, cx| {
                *panel.items = vec![item];
                cx.notify();
            });
            vcx.run_until_parked();
            let card = vcx
                .debug_bounds("user-response-card")
                .expect("response card painted");
            let transcript = vcx.debug_bounds("transcript").expect("transcript painted");
            assert!(
                card.size.width >= transcript.size.width.min(px(super::super::READING_COLUMN_WIDTH)) * 0.85,
                "card should fill transcript: {card:?} {transcript:?}"
            );
            assert!(
                card.size.height <= transcript.size.height + px(1.),
                "card should not exceed viewport: {card:?} {transcript:?}"
            );
            assert!(
                card.origin.y >= transcript.origin.y - px(1.),
                "tail-follow must keep card title visible: {card:?} {transcript:?}"
            );
            assert!(
                card.bottom() <= transcript.bottom(),
                "card must remain inside usable transcript: {card:?} {transcript:?}"
            );
            heights.push(card.size.height);
        }
        assert!(heights[0] > px(0.));
        assert!(
            heights[1] > heights[0] + px(50.),
            "short content should remain natural height: {heights:?}"
        );
    }

    #[core::prelude::v1::test]
    fn fixture_covers_short_and_oversized_markdown() {
        let items = fixture_items();
        let lengths: Vec<_> = items
            .iter()
            .map(|item| match item {
                super::super::Item::Tool { name, input, .. } => {
                    parse(name, input).unwrap().content.len()
                }
                _ => panic!("expected response tool"),
            })
            .collect();
        assert!(lengths[0] < 250);
        assert!(lengths[1] > 5000);
    }
}
