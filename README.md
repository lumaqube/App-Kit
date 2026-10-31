# App Kit

The base for apps that work with a running Q-Booth event through Q-Booth's **Local API**: a theme
roulette, a game before the photo, a host on a second screen, anything. The kit does the plumbing
(Q-Booth connection, covers, an overlay window that appears only on the pages you choose, operator
settings with PIN, layout for any screen, sound by code, a fake Q-Booth, tools, the exe); an app
is only its idea.

Works with every brand build of the booth app: **QBooth.exe**, **BleepShare.exe**, **XBooth.exe**.
Apps never show a brand of their own: the name comes from the connected booth app (GUIDE §2 "Brands").

| | English | Bahasa Indonesia | 中文 |
|---|---|---|---|
| Guide (start here) | [GUIDE.md](docs/GUIDE.md) | [GUIDE.id.md](docs/GUIDE.id.md) | [GUIDE.zh.md](docs/GUIDE.zh.md) |
| Local API reference | [API.md](docs/API.md) | [API.id.md](docs/API.id.md) | [API.zh.md](docs/API.zh.md) |
| Recipes | [RECIPES.md](docs/RECIPES.md) | [RECIPES.id.md](docs/RECIPES.id.md) | [RECIPES.zh.md](docs/RECIPES.zh.md) |
| AI agents | [AGENTS.md](AGENTS.md) | | |

```bash
npm install                                  # once
node tools/new-app.mjs quiz "Photo Quiz"     # a new app in apps/quiz
node tools/serve.mjs quiz --mock             # in a browser, with a fake Q-Booth
node tools/run.mjs quiz --mock               # as the desktop app
node tools/build.mjs quiz                    # the exe in dist/
node tools/covers.mjs                        # Q-Booth events on this PC; --out exports covers
node tools/qb.mjs watch --mock               # follow Q-Booth's changes in the terminal
```

Example app: `apps/hello` (the event's templates as cards with covers; a tap starts the session).

Requirements: Windows 10/11, Node.js 22, Q-Booth with the Local API on (Settings → Advanced, Expert
mode). No npm dependencies at run time (Electron and the packager are for the desktop app and build).

`config.json` (per app) holds the Local API password: git-ignored, never in a package.
