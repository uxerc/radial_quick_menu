# Radial file wheel

Radial menu for the top 20% of file actions. Browser build: every action a browser can do, on real files in a folder you open.

## Run

Hosted: https://uxerc.github.io/radial_quick_menu/ (rebuilt by `.github/workflows/pages.yml` on every push to `main`).

Offline: `npm run build:standalone`, then open `dist-standalone/radial-file-wheel.html` in Chrome or Edge. From disk, paste needs an extra Ctrl+V and the folder isn't remembered.

Dev server:

    npm install
    npm run dev        # http://localhost:1420
    npm test

## Use

- **Open folder…** (top right) and allow edit access. Its files are what the wheel acts on: click, Ctrl+click, Shift+click, Ctrl+A.
- Open the wheel with **Alt+right-click** or **Ctrl+Shift+Space** (hotkeys are editable; Ctrl+Alt+Space is taken by the Claude app).
- Over the file list the wheel acts on the folder and selection; over the paste box it inserts text.
- Pick by clicking, or keep the right button / hotkey held, move to an item and release (marking-menu style). Releasing without picking leaves the wheel open.
- Keys 1–6 pick a slot, 1–5 a child (shown on the wheel), Backspace goes back, Enter commits the hovered item.
- Shift swaps to layer B, Space locks it, Esc / right-click / click outside / click center cancels.
- The side panel logs usage locally (opens, picks per item, time to pick, cancels, method); Export JSON to share it.

| Slot | Layer A | Layer B |
|---|---|---|
| 0 | Clipboard history: paste text, links, images, copied files | Pinned snippets |
| 1 | Paste (text → .txt, link → .url, image → .png), Match style, As link | Paste as plain text, PNG, link, file |
| 2 | Save as, To folder, Share (Windows share sheet), Share link *(stub)* | Send to Desktop (picked once), Folder…, Slack *(stub)*, Email *(stub)* |
| 3 | Convert to PNG/JPG/WEBP (images, PDF pages), PDF (images, text), TXT (PDF text, text files) | Compress images; Crop, Annotate, Redact *(stubs)* |
| 4 | Recent saves (label = destination folder) | Undo save, Move to, Rename, Open folder |
| 5 | Capture Area, Window, Screen, Timer (10 s) | Delay 3 s, 5 s; Full page, Record *(stubs)* |

Converted, compressed and pasted files are written beside the original/into the current folder, never overwriting.

**Screenshot filing**: captures go to `Screenshots/Inbox` unless a rule matches (`title: Jira -> Screenshots/Jira`, `app: Google Chrome -> Screenshots/Browser`). Signals: the shared window's title and the app derived from it. Moving a screenshot to the same folder 3 times offers a rule.

## Browser limits (need the native build)

Explorer/desktop selection, Alt+right-click outside the page, watching the OS screenshots folder, OCR, password-manager clipboard flags, Desktop without picking it once. Chrome asks to re-allow the folder after a reload; opened from disk it may not remember the folder at all.

## Windows overlay (later)

`npm run tauri dev` with Rust (rustup, MSVC). Only type-checked (`cargo check --target x86_64-pc-windows-msvc`), never run. Hotkeys from `hotkeys.json` in the app config dir; each gets a Shift twin that opens layer B.

## Layout

- `src/wheel/` geometry, slots, controller, SVG renderer
- `src/actions/` convert, capture, export/send/edit, paste, recent + fix recent, filing rules
- `src/fs/` workspace folder (File System Access API), paths
- `src/explorer/` file list and selection
- `src/dev/panel.ts` side panel: hotkeys, paste box, rules, pins, history, log
- `src-tauri/` overlay window
