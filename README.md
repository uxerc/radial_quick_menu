# Radial file wheel

Radial menu for the top 20% of file actions. Spec: milestone 1 (overlay UI, hotkey trigger).

## Run (browser, any OS)

    npm install
    npm run dev        # http://localhost:1420, dev panel on the left
    npm test

Ctrl+Alt+Space or Alt+right-click opens the wheel at the cursor. Hotkeys are editable in the dev panel (stored in localStorage). Shift swaps to layer B, Space locks it, Esc / right-click / click outside / click center cancels.

## Run (Windows desktop overlay)

Prereqs: Node 20+, Rust (rustup, MSVC toolchain), WebView2 (ships with Windows 11).

    npm install
    npm run tauri dev

Ctrl+Alt+Space (global) opens the wheel at the cursor on the monitor under it. Every hotkey also gets a Shift twin (Ctrl+Alt+Shift+Space) that opens straight into layer B.
Extra or replacement hotkeys: `hotkeys.json` in the app config dir, e.g. `{"hotkeys": ["Ctrl+Alt+Space", "Ctrl+Shift+K"]}`. Alt+right-click in the overlay needs the milestone 2 mouse hook.
The Rust side is only type-checked (`cargo check --target x86_64-pc-windows-msvc`), not run.

## Layout

- `src/wheel/geometry.ts` angle-based hit-testing, constants from the spec
- `src/wheel/slots.ts` 6 fixed slots x 2 layers
- `src/wheel/controller.ts` state machine (layer, latch, hover, expansion)
- `src/wheel/render.ts` SVG renderer
- `src/platform/` adapters (browser clipboard now, native later)
- `src/dev/panel.ts` browser-only panel: selection and recent-save overrides, paste target, pins
- `src-tauri/` transparent always-on-top overlay, click-through while closed

## Milestone 1 scope

Real: clipboard history (copy/cut on the page), pinned snippets (localStorage), paste from history/pins/clipboard into the dev paste target, all geometry and layer behavior.
Not implemented (item reports "not implemented yet"): export, convert, edit, capture, send-to, fix-recent actions. Selection and recent saves have no native source until milestone 2/5; the dev panel supplies them.
