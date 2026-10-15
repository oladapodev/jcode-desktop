# Jcode Desktop redesign prototype (v2)

An interactive, fully clickable design prototype of the redesigned desktop app.
It is the visual and interaction spec for porting the UI into the Rust/GPUI app.
All data is mock data. Nothing talks to a real jcode server.

## Open it

`dist/index.html` is a single self-contained file. Open it in any browser.

Deep links jump to a screen: `#home`, `#agents`, `#machines`, `#add-machine`,
`#apps`, `#canvas`, `#palette`, `#stream`, `#inspector/changes`,
`#settings/models`, `#theme/paper`.

## Work on it

```sh
npm install
npm run dev        # live reload at http://localhost:5173
npm run build      # writes dist/index.html
node scripts/shots.mjs /tmp/shots      # screenshot every screen + console errors
node scripts/interact.mjs /tmp/ix      # scripted interaction checks
```

## Stack

React 19, Tailwind v4, Radix primitives (popover, dialog, tooltip, switch,
dropdown), Motion for animation, cmdk for the command palette, Sonner for
toasts, Lucide icons, Lobe icons + Simple Icons for provider and app logos,
Instrument Sans + JetBrains Mono.

## Map to the Rust app

| Prototype | Current desktop code |
|---|---|
| Sidebar projects/sessions | `sidebar_projects.rs`, `sidebar_collections.rs` |
| Machine switcher, Machines page | `workspace_remotes.rs`, `jcode-desktop-harness/remote.rs` |
| Run thread | `panel_tool_streaming.rs`, `panel_activity.rs` |
| Composer chips | `input_model_menu.rs`, `panel_effort.rs`, `input_popup.rs` |
| Inspector tabs | `panel_diff.rs`, `terminal.rs`, `panel_preview.rs`, `panel_usage.rs` |
| Canvas | `workspace.rs`, `workspace_map_motion.rs` |
| Palette | `commands.rs`, `workspace_commands.rs` |
| Settings | `jcode-desktop-ui-core/config.rs`, `theme.rs` |

See `DESIGN.md` for tokens, type, layout and motion rules.
