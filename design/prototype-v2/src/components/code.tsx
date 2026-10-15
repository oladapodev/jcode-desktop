import { useEffect, useRef } from 'react'
import { EditorState, type Extension } from '@codemirror/state'
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, highlightSpecialChars } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { HighlightStyle, syntaxHighlighting, foldGutter, bracketMatching, indentOnInput, StreamLanguage } from '@codemirror/language'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'
import { rust } from '@codemirror/lang-rust'
import { markdown } from '@codemirror/lang-markdown'
import { javascript } from '@codemirror/lang-javascript'
import { toml } from '@codemirror/legacy-modes/mode/toml'
import { MergeView, unifiedMergeView } from '@codemirror/merge'
import { tags as t } from '@lezer/highlight'

/* Theme is built from CSS variables, so every app theme (incl. Paper) just works. */
const chrome = EditorView.theme({
  '&': { height: '100%', fontSize: '13px', backgroundColor: 'transparent', color: 'var(--bone)' },
  '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.7' },
  '.cm-content': { padding: '14px 0', caretColor: 'var(--brass)' },
  '.cm-gutters': { backgroundColor: 'transparent', border: 'none', color: 'var(--ash)', paddingLeft: '8px' },
  '.cm-lineNumbers .cm-gutterElement': { padding: '0 14px 0 8px', minWidth: '36px' },
  '.cm-activeLine': { backgroundColor: 'color-mix(in srgb, var(--bone) 3.5%, transparent)' },
  '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--dust)' },
  '.cm-cursor': { borderLeft: '2px solid var(--brass)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': { backgroundColor: 'rgb(var(--glow) / .22) !important' },
  '.cm-selectionMatch': { backgroundColor: 'rgb(var(--glow) / .12)' },
  '.cm-matchingBracket': { backgroundColor: 'rgb(var(--glow) / .18)', outline: 'none' },
  '.cm-foldGutter span': { color: 'var(--ash)' },
  '&.cm-focused': { outline: 'none' },
  // merge view: quiet tints, only the exact changed text gets a stronger mark
  '.cm-changedLine, .cm-insertedLine': { backgroundColor: 'color-mix(in srgb, var(--sage) 7%, transparent) !important' },
  '.cm-deletedChunk': { backgroundColor: 'color-mix(in srgb, var(--rose) 7%, transparent) !important', paddingLeft: '0' },
  '.cm-changedText, ins.cm-insertedLine': { background: 'color-mix(in srgb, var(--sage) 13%, transparent) !important', textDecoration: 'none', borderRadius: '3px' },
  'del, .cm-deletedText, .cm-deletedChunk .cm-deletedText': { background: 'color-mix(in srgb, var(--rose) 14%, transparent) !important', textDecoration: 'none', borderRadius: '3px' },
  '.cm-deletedChunk .cm-deletedLine': { opacity: '.75' },
  '.cm-changeGutter': { width: '2px', paddingLeft: '0' },
  '.cm-changedLineGutter, &.cm-merge-b .cm-changedLineGutter': { background: 'var(--sage) !important' },
  '.cm-deletedLineGutter, &.cm-merge-a .cm-changedLineGutter': { background: 'var(--rose) !important' },
  '.cm-inlineChangedLineGutter': { background: 'var(--ember) !important' },
  '.cm-collapsedLines': { background: 'var(--slab-2)', color: 'var(--ash)', fontFamily: 'var(--font-sans)', fontSize: '12px', padding: '4px 12px' },
})

export const syntax = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.moduleKeyword, t.definitionKeyword, t.modifier], color: 'var(--syn-keyword)' },
  { tag: [t.function(t.variableName), t.function(t.propertyName), t.macroName], color: 'var(--syn-fn)' },
  { tag: [t.typeName, t.className, t.namespace, t.self], color: 'var(--syn-type)' },
  { tag: [t.string, t.special(t.string), t.character], color: 'var(--syn-string)' },
  { tag: [t.number, t.bool, t.atom, t.constant(t.variableName)], color: 'var(--syn-number)' },
  { tag: [t.comment, t.lineComment, t.blockComment, t.docComment], color: 'var(--syn-comment)', fontStyle: 'italic' },
  { tag: [t.propertyName, t.attributeName], color: 'var(--syn-prop)' },
  { tag: [t.operator, t.punctuation, t.bracket, t.separator], color: 'var(--syn-punct)' },
  { tag: [t.meta, t.annotation, t.processingInstruction], color: 'var(--syn-meta)' },
  { tag: t.heading, color: 'var(--bone)', fontWeight: '600' },
  { tag: t.variableName, color: 'var(--bone)' },
])

export function langFor(lang: string): Extension {
  if (lang === 'rust') return rust()
  if (lang === 'md') return markdown()
  if (lang === 'ts') return javascript({ typescript: true })
  if (lang === 'toml') return StreamLanguage.define(toml)
  return []
}

const base = (lang: string, readOnly: boolean): Extension[] => [
  lineNumbers(), highlightActiveLineGutter(), highlightSpecialChars(), history(), foldGutter(), drawSelection(),
  indentOnInput(), bracketMatching(), highlightActiveLine(), highlightSelectionMatches(),
  syntaxHighlighting(syntax), chrome, langFor(lang),
  keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
  EditorState.readOnly.of(readOnly), EditorView.editable.of(!readOnly),
]

/** Full editor. */
export function CodeEditor({ doc, lang, readOnly = false }: { doc: string; lang: string; readOnly?: boolean }) {
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const view = new EditorView({ parent: host.current!, state: EditorState.create({ doc, extensions: base(lang, readOnly) }) })
    return () => view.destroy()
  }, [doc, lang, readOnly])
  return <div ref={host} className="h-full min-h-0 overflow-hidden" />
}

/** Unified diff with real syntax highlighting (inline, like a PR). */
export function DiffEditor({ before, after, lang }: { before: string; after: string; lang: string }) {
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const view = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: after,
        extensions: [...base(lang, true), unifiedMergeView({ original: before, mergeControls: false, highlightChanges: true, gutter: true, collapseUnchanged: { margin: 3, minSize: 4 } })],
      }),
    })
    return () => view.destroy()
  }, [before, after, lang])
  return <div ref={host} className="h-full min-h-0 overflow-auto" />
}

/** Side-by-side diff. */
export function SplitDiff({ before, after, lang }: { before: string; after: string; lang: string }) {
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const mv = new MergeView({ parent: host.current!, a: { doc: before, extensions: base(lang, true) }, b: { doc: after, extensions: base(lang, true) }, highlightChanges: true, gutter: true })
    return () => mv.destroy()
  }, [before, after, lang])
  return <div ref={host} className="h-full min-h-0 overflow-auto [&_.cm-mergeView]:h-full" />
}

/** Static highlighted snippet for chat code blocks (no editor chrome). */
export function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const view = new EditorView({
      parent: host.current!,
      state: EditorState.create({ doc: code, extensions: [syntaxHighlighting(syntax), chrome, langFor(lang), EditorState.readOnly.of(true), EditorView.editable.of(false),
        EditorView.theme({ '.cm-content': { padding: '12px 16px' }, '.cm-scroller': { lineHeight: '1.65' } })] }),
    })
    return () => view.destroy()
  }, [code, lang])
  return <div ref={host} />
}
