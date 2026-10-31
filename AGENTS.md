# QBoothKit: rules for AI agents

Read [docs/GUIDE.md](docs/GUIDE.md) first (the whole kit), [docs/API.md](docs/API.md) (Q-Booth's
Local API) and [docs/RECIPES.md](docs/RECIPES.md) (copyable answers). This file is the short list
of what must never go wrong.

## Making an app

1. `node tools/new-app.mjs <id> "<Name>"` → `apps/<id>`. Never edit `templates/hello` for one app.
2. Put app code only in `apps/<id>/`. Change `core/`, `shell/`, `web/` only when every app needs it,
   and then update docs/GUIDE.md (all three languages: GUIDE.md, GUIDE.id.md, GUIDE.zh.md).
3. `window.showOn` = only the Q-Booth pages the app covers. Keep `hideOnDialog: true`.
4. Every action through `booth.can(...)` / `available`; start sessions with
   `booth.startWithTemplate(id)` (it handles Welcome vs the pickers).
5. Texts in en / id / zh. Layout from `kit.fit()` (sizes in `u`, `W`, `H`), never fixed pixels.
6. Covers: `booth.coverUrl(id)` with a placeholder on error (an app on another PC gets none).

## Never

- **Never write into Q-Booth's folder** (`C:\QBoothPro`, `qboothDir`): read only.
- **Never put a secret anywhere but config.json**: the Local API password and `secret` fields never
  go to the page, a log line, a screenshot, a commit or a package. `config.json` is git-ignored;
  check a package for it before sharing.
- **Never bypass Q-Booth's gates** (Start PIN, payment, print limits) or skip its screens.
- **Never open a test window on the owner's working screen.** Test pages headless
  (`node tools/serve.mjs <app> --mock` + headless Chrome screenshots). To test the desktop app,
  point it at a Local API with no event running (the window stays hidden) and quit it with
  `POST /app/quit`. Stop every server and process you started.
- **Never name the AI engine behind Q-Booth's "AI Offline"** in anything public (UI, docs, captions).
- Don't commit or push unless asked; end commit messages with the attribution line your harness gives.

## Machine quirks (this workspace)

- Some shells set `ELECTRON_RUN_AS_NODE=1`: Electron (and the built exe) then runs as plain Node and
  hangs. `tools/run.mjs` removes it; when starting an exe yourself use `env -u ELECTRON_RUN_AS_NODE`.
- `python` is a Store stub: use Node.
- In Git Bash, `node -e` mangles backslashes in strings: write scripts to files instead.

## Verify before you say done

- `node --check` every changed file.
- The page at 1920×1080, 1080×1920, 1080×1350, 2560×1080 with the mock (borrow a real event:
  `mockEvent`) and no page errors.
- The whole flow on the mock (`node tools/qb.mjs watch --mock` style checks or the app's own
  hand-over), then the build (`node tools/build.mjs <id>`) starting hidden with no event.
