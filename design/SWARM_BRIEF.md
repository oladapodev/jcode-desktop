# Native redesign: shared brief for swarm workers

Repo: `~/Desktop/jcode-desktop` (Rust + GPUI desktop client for the jcode agent server).
Crate you edit: `crates/jcode-desktop-ui/src/`. Theme tokens: `crates/jcode-desktop-ui-core/src/theme.rs`
and palettes in `crates/jcode-desktop-ui-core/src/theme/palettes.rs` (studio_dark / studio_light are the defaults).

## Target design (already approved by the user)
The reference prototype is `design/prototype-v2/` (React). Read `design/prototype-v2/DESIGN.md` and the
relevant `src/app/*.tsx` for your area. Screenshots of rounds already ported: `design/native-r2-*.png`,
`design/native-r3-*.png`.

Rules the user insists on:
- Native, calm, flat. No gloss, glow, gradients, drop-shadow theatrics. Short calm motion only.
- Inter for UI text (`theme.FONT_UI`), JetBrains Mono only for code/paths/terminal (`theme.FONT_MONO`).
- Colour only carries status (OK/WARN/ERROR/ACCENT for live work). Everything else is TEXT / TEXT_DIM / TEXT_FAINT.
- NO helper/explanation lines under items. Short labels. Tooltips may hold detail. No clutter.
- Fewer outlines and borders. Prefer fills (PANEL_BG, TOOL_BG, USER_BG) and spacing.
- Readable sizes: body 13 to 13.5px, labels 12 to 12.5px, captions 10.5 to 11px. Avoid 9px text.
- Rounded radii around 8 to 10px for rows/buttons, 14 to 18px for cards. Pills only where they are real chips.
- It must keep working against the real jcode server. Never break behaviour. Keep every existing
  `debug_selector` id unless you also update the tests that use it.
- Both themes must look good: check studio-dark and studio-light.

## How to build, test and screenshot (shared GCP VM, do NOT build locally)
Run from the repo root:
- `scripts/build-vm/build.sh check` : sync + cargo check (about 1 min)
- `scripts/build-vm/build.sh test [FILTER]` : run jcode-desktop-ui lib tests (filter optional)
- `scripts/build-vm/build.sh shot NAME [screenshot.py args]` : release build + screenshot to
  `target/vm/shots/NAME.png`. Use a NAME prefixed with your label so you never collide with others.
  See `python3 scripts/screenshot.py --help` for args (e.g. `--size 1440x900 --theme studio-light`,
  `--transcript tool-icons`, `--panels 2`, `--swarm`, `--worktrees`, `--accounts`, `--layout-mode normal`).
  Read the PNG with the Read tool to look at it.
Several workers share the VM. Cargo serialises builds with its own lock, so just wait. Use long timeouts
(build commands can take up to 10 minutes when queued). If ssh times out, the spot VM may have been
preempted: rerun, the script restarts it.

## Rules for this swarm
- Only edit the files you own (listed in your task). If you truly need a change elsewhere, keep it tiny and
  say so in your report.
- Do NOT git commit, push, stash, checkout or reset. The coordinator integrates and commits.
- Edit with the Edit/apply_patch tools, not sed/python.
- Everyone works in the SAME working tree and every VM sync ships everyone's edits. Keep the tree
  compiling: make each edit compile-safe, run `build.sh check` soon after edits, and fix your breakage
  immediately. If a compile error is in a file you do not own, wait a minute and retry (another worker is
  mid-edit) rather than touching it.
- Other workers may edit other regions of shared files like `workspace.rs` and `panel.rs`. Always re-read
  the region right before you edit it.
- Before reporting: `build.sh check` must pass, the tests touching your area must pass
  (`build.sh test <module filter>`), and you must have looked at dark and light screenshots of your area.
- Report: files changed, what changed, screenshot paths, tests run.
