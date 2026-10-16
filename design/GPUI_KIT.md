# GPUI Kit compatibility and workspace preset decision

Investigated October 16, 2026. **Decision: do not add `gpui-component`, `gpui-base`, or `gpui-kit` to Desktop now.** They can coexist in Cargo's graph but cannot render in our GPUI application without a port. Do not replace the native workspace with DockArea during this redesign.

## Compatibility, reproduced on the build VM

| Dependency | GPUI identity |
| --- | --- |
| Desktop `Cargo.toml` and `Cargo.lock` | Jcode's `gpui` fork, revision `be875c56343dcbd45127a9805781a9e128057dd7`, package version `0.2.2`. The `[patch.crates-io]` entry replaces packages named `gpui`. |
| GPUI Kit `0.7.3` (`gpui-component` and `gpui-base`) | Exact `gpui-pre =0.3.9` snapshot of Zed commit `93d7456`, with corresponding `gpui-pre-platform`, macros, and sum-tree. Its optional `gpui-fast` feature selects a *separate* published `gpui-fast 0.1.7` on that snapshot, not our git `gpui` package. |

In `scripts/build-vm/build.sh run '...'`, I copied the synced project into `~/gpui-kit-compat-worker/` on the VM, added `gpui-component = "=0.7.3"` **only to that copy**, and ran Cargo there. `cargo tree -p jcode-desktop-ui -i gpui-pre` and `-i gpui` showed two separate GPUI packages. A plain `cargo check -p jcode-desktop-ui` succeeded because the added crate was a dev dependency and the library did not call across the two GPUI boundaries. This is **not** proof of interoperability. An isolated integration test calling `gpui_component::init(cx)` with `cx: &mut gpui::App` then failed with `E0308`, explicitly reporting that `gpui-pre-0.3.9::App` and our fork's `gpui::App` are distinct types. No shared-tree `Cargo.toml` or `Cargo.lock` was changed.

The root `[patch.crates-io] gpui = ...` does not rewrite dependencies on package `gpui-pre` or `gpui-fast`. Enabling the kit's `gpui-fast` feature likewise leaves its normal `gpui-pre` dependency in place. Both `gpui-base` and the styled layer depend on this distinct GPUI identity. `DockArea` entities, views, windows, contexts, focus handles, and render elements cannot be passed into the existing `Workspace` as-is. Making the fork satisfy the entire kit's GPUI dependency graph means a deliberate fork/rebase or a maintained port, not a Cargo feature switch.

Upstream sources: [workspace GPUI pins](https://github.com/longbridge/gpui-kit/blob/main/Cargo.toml), [v0.7.3 release and Zed revision](https://github.com/longbridge/gpui-kit/releases/tag/v0.7.3), [base crate dependency](https://github.com/longbridge/gpui-kit/blob/main/crates/base/Cargo.toml), [dock architecture](https://github.com/longbridge/gpui-kit/blob/main/docs/ARCHITECTURE.md), [styled Dock API](https://gpui-kit.com/component/dock/).

## What is worth borrowing

1. **DockArea: highest value but highest integration cost.** Split/tab trees, draggable panels, resize, serialization, panel registry, and drag/drop are a strong match for the prototype. Base owns the behavior and geometry, component supplies the skin. To use it, first unify GPUI identity, adapt each real Desktop pane to `BasePanel`/`Panel` and `Render`, provide a native theme skin, migrate `WorkspaceSnapshot` without losing existing strip state, and keep session/composer/terminal entities and server subscriptions alive across docking. The base/component dock folders contain roughly **23 Rust files, 14,000 lines** in `0.7.3`. This is a separate architecture project, not a safe quick import.
2. **Editor and Table: useful later.** The base editor offers editing, search, diagnostics, syntax and folding, while our `Panel` currently renders side documents and diff review in its own presentation. Table behavior could serve changes, sessions, or machine lists if those actually need virtualization/sort/resizing. Base plus component table folders total roughly **7 Rust files, 4,175 lines**. Neither package is currently link-compatible. Preserve native diff and terminal behavior until a real use case and a single-GPUI port are tested.
3. **Popover: feasible to study, little reason to vendor now.** Base `popover.rs` is 589 lines, `popup.rs` 325, and styled `popover.rs` 1,004, plus shared overlay/geometry and theme dependencies. Desktop already has `input_popup.rs`, provider picker, and account-menu overlays. Borrow collision/dismissal ideas, not a forked component with a second GPUI type. Any extraction needs Apache-2.0 attribution and focused pointer, keyboard, and overlay tests.

Vendoring individual components is **not a drop-in workaround**. Dock imports base's panel tree, drag/resize, persistence and renderer machinery. Even Popover's relatively compact source uses base infrastructure. The lower-risk path is to implement only the required behavior against our existing GPUI fork, or plan a separately tested GPUI convergence before adopting Kit.

## Workspace presets: current native shape and recommended plan

The approved web prototype uses Dockview in `design/prototype-v2/src/app/Workspace.tsx` (`applyPreset`, lines 107-146). `App.tsx` maps Ctrl/Cmd+1..5 to Chat, Code, Review, Browser, Terminal. Its layouts are:

| Preset | Pane graph |
| --- | --- |
| Chat | chat beside 360px plan, with changes and terminal tabbed alongside plan |
| Code | 230px files, editor with a second file tab, terminal **below** editor, 400px chat at right |
| Review | changes beside 400px chat |
| Browser | browser with terminal **below**, 380px chat at right |
| Terminal | terminal beside 420px chat |

Desktop is **not** that dock tree. `Workspace` owns `Vec<Slot>` of whole `Entity<Panel>` objects, each with a row and viewport-width fraction, per-row camera/focus state, and four strips. `render` paints the active row only except during animation/overview. `Panel` is a session-oriented composite that renders chat, a terminal, a code side-document, or diff review, not a generic pane registry. Some chat side content (for example a pinned plan) is composited *inside* that panel. `super-1..4` are already width presets and have navigation/shortcut tests, so those must remain intact. Merely binding Ctrl+1..5 to reorder slots would hide the below-editor terminal or displace unrelated live sessions. It would falsely claim to reproduce the prototype and risks focus and snapshot regressions. **No preset shortcut or native layout mutation was added in this investigation.**

Recommended staged native implementation if Kit remains incompatible:

1. Introduce a per-session `PaneLayout` data model separate from the current strip/slot navigation. Keep current `WorkspaceSnapshot` and its migration intact. Define stable pane IDs and tabs/splits so chat, files, editor, changes, browser, plan, terminal can coexist. Start by adapting the already-existing `Panel` views and `TerminalPanel`, not recreating them or PTYs. Keep non-session workspace panels in the current strips.
2. Render the selected session's pane tree within its existing slot, with horizontal/vertical splits, tab headers, focus routing and resize constraints. Do not repurpose four strips as a two-dimensional dock. Preserve composer, streaming subscriptions, terminal entity, selection, and browser state when changing layout. Match native colors/spacing to the approved prototype in both studio themes.
3. Implement *non-destructive* preset reconciliation: reuse entities by stable pane ID, add missing panes, arrange and activate them, and leave user-created/editor contents recoverable. Persist and restore the tree, with backward compatibility for previous snapshots. Test five layouts and switch sequences, narrow windows, close/restore, reload, focus traversal, and existing width keys and navigation tests before exposing Ctrl+1..5.
4. Only after this core works, add pane drag/drop and cross-session docking if desired. Reevaluate Kit after unifying GPUI upstream and the Jcode fork. The base `DockArea` could replace the native tree behind this model if an isolated prototype compiles against **the same** GPUI instance, preserves session entities, and passes the same tests.

Visual context inspected: `design/compare/panes/final-dark/code-body.png`, `design/compare/panes/final-light/code-body.png`, and `design/compare/panes/final-light/pane-tabs.png`. These compare existing native pane presentation against the prototype, not a new DockArea implementation. This worker made no UI changes and therefore did not create new screenshots.

Validation on the shared build VM: `scripts/build-vm/build.sh check` reported no compiler errors and `scripts/build-vm/build.sh test closing_navigation_tests` passed all 9 navigation tests. The isolated negative compatibility test intentionally fails with `E0308` as described above. No commits or pushes were made by this worker.
