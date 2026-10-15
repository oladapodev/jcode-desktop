# Jcode Desktop redesign: design plan (v2)

## Subject, audience, job
A personal agent workspace. One person drives many coding agents across a laptop,
an always-on cloud VM and disposable sandboxes, often live on stream. The primary
job of the interface is **to make the agent's work legible at a glance**: what is
running, where, on which model, and what it changed.

## Signature element (spend boldness here only)
**The run thread.** Every agent turn renders as a single vertical thread: a thin
rail with nodes for thinking, each tool call, edits and checks. The rail fills with
brass as work progresses, the live node breathes, finished nodes settle. The same
thread compresses into the sidebar status orb and the canvas overview. Everything
around it stays quiet.

## Color (warm graphite, kept from the theme the user likes)
| token | hex | role |
|---|---|---|
| ink | `#12100e` | window canvas |
| soot | `#181613` | sidebar, inspector |
| slab | `#1f1c18` | raised surfaces, composer |
| seam | `#2d2924` | hairlines |
| bone | `#efe7db` | primary text |
| brass | `#e0b46c` | the only accent: live work, focus, primary action |

Supporting: dust `#a2978a` (secondary text), ash `#6d655b` (tertiary), sage
`#9cc49a` (done), ember `#ef9f5f` (needs you), rose `#ec8579` (failed).
Machine kinds get a quiet hue so location is readable without words: local =
brass, cloud VM = sky `#8db4dc`, sandbox = lilac `#b7a1ee`, SSH = dust.

## Type
- **Instrument Sans Variable** for all interface text. Slightly condensed,
  warmer than Inter, reads well at 13px and holds character at 28px headings.
- **JetBrains Mono Variable** only where text is literally code: paths,
  commands, diffs, terminal. Never for labels.
- Scale (px): 11.5 meta, 12.5 secondary, 13.5 body UI, 15 chat prose, 17 panel
  titles, 26 page titles. Sentence case everywhere. No all-caps eyebrows.

## Layout
```
┌ sidebar 268 ─┬──────────── main ─────────────┬─ inspector 380 (resizable) ┐
│ space · sync │ title · machine · model · ⋯   │ Plan Changes Term Files …  │
│ + New  ⌘K    │                               │                            │
│ Home         │   transcript (680 max, left   │                            │
│ Agents  ●2   │   aligned inside centered col) │                            │
│ Machines     │                               │                            │
│ ── projects  │   ┌ composer ───────────────┐ │                            │
│ ▾ tasued     │   │ text                    │ │                            │
│   ● Korope   │   │ +  Agent  Model  Effort │ │                            │
│ ── footer    │   └ route: This computer ───┘ │                            │
│ machine/acct │                               │                            │
└──────────────┴───────────────────────────────┴────────────────────────────┘
```
- The title bar is merged into the sidebar and main header (no separate strip).
- Chat column is left-aligned text in a centered 680px measure (< 80 chars).
- Controls live where their effect is: model/effort/mode in the composer,
  machine on the session header, layout and inspector toggles top-right.

## Motion
- Answers to the user only: popovers scale from their trigger, the active nav
  pill slides between items (shared layout), the inspector slides and resizes,
  tool steps unfold.
- One ambient motion: the live node on the run thread breathes. Nothing else
  loops.
- `prefers-reduced-motion` turns all of it into fades.

## Review against the brief
- First draft used Inter + a generic dark UI + identical cards. Revised: swapped
  Inter for Instrument Sans, removed all-caps section labels, gave machines a hue
  system instead of icons-only, replaced card grids on Machines with a route-style
  list that shows where work runs, and concentrated decoration in the run thread.
- Middle-dot meta strings are a template tell, so meta uses spacing and weight
  instead.
