# Q-Booth Local API: the short reference

Languages: **English** · [Bahasa Indonesia](API.id.md) · [中文](API.zh.md)

What a QBoothKit app needs to know about Q-Booth's Local API (API version 1). The kit's
`core/qbooth.js` wraps all of it; you rarely build a URL yourself.

## Switching it on

Q-Booth → **Settings → Advanced → Local API** (Expert mode only). Off by default. Settings:
port (default **8730**), password (generated if empty), **Allow LAN** (off = 127.0.0.1 only).
Q-Booth itself serves a sandbox at `http://<booth>:<port>/`, docs at `/docs` and a phone remote
control at `/remote`. Public docs: https://www.lumaqube.com/docs/local-api

## Transport and authentication

- HTTP on `http://<host>:<port>/api/v1/<call>`. Reads are `GET`, actions are `POST` (GET also
  accepted). Parameters: JSON body or query string.
- Password in any of: `Authorization: Bearer <password>`, `X-QBooth-Key: <password>`, `?key=<password>`.
  Wrong / missing → 401 `unauthorized`; 10 failures in a minute → 429 `too_many_attempts` for a minute.
- One request per connection, 64 KB body cap, 10 s timeout. CORS is open.

## Replies

```json
{ "ok": true, "data": { ... } }                       // reads (200)
{ "ok": true, "accepted": "camera/capture" }           // actions (202): returns at once
{ "ok": false, "error": { "code": "wrong_page", "message": "..." } }
```

An action only hands the command to the app: **the effect shows in the next `status`**. Poll
`status` every 300-500 ms (the kit does: `core/watch.js`, `web/qbooth.js`).

## Calls

| Call | Valid when | Does |
|---|---|---|
| `GET status` | always | app, event, page, session, camera, result, busy, `available` |
| `GET commands` | always, **no password** | the command list |
| `GET events` | always | every event: id, name, archived, template count, running |
| `POST event/start {id}` | no event running, no dialog, editor closed | the Launch button |
| `POST event/stop` | event running, no dialog, not processing | ends the booth session (no exit PIN) |
| `GET templates {eventId?}` | event running (or with eventId) | guest-pickable templates: `id`, `name`, `studio`, `categoryId`, and on the Template Picker `onScreen` + `index` |
| `GET categories {eventId?}` | same | enabled categories |
| `POST session/start` | Welcome | the Start button (Start PIN / payment gate first) |
| `POST session/end` | any page but Welcome | the Home button: back to Welcome |
| `POST category/select {id \| index}` | Category Picker | a category card tap |
| `POST template/select {id \| index}` | Template Picker (card on screen) **or Welcome** | a card tap + Next. From Welcome: the Start gate, then straight to that template (pickers skipped) |
| `POST camera/capture` | Camera, live view idle (or the manual wait between shots) | the Capture button |
| `POST camera/retake` | Camera, Review, retakes left | the Retake button |
| `POST camera/process` | Camera, Review | the Process button |
| `POST result/print` | Result, print allowed | the Print button |
| `POST result/qr {type: web \| local}` | Result, that QR set up | the QR button (opens a dialog) |

`index` is 1-based, in the order the guest sees the cards. When both `id` and `index` come, `id` wins.

**Rules Q-Booth keeps:** a command presses the same button the guest would, with all its guards.
Nothing paid is bypassed (Start PIN, payment, print limits apply). A wrong state is refused, never
queued. **A dialog on screen blocks every action** (`dialog_open`); so does processing (`processing`).

## `status`

```json
{
  "app":     { "name": "QBooth", "version": "5.9.3.0", "apiVersion": "1" },
  "event":   { "id": "1781706869_H5A4", "name": "Wedding" },
  "page":    "camera",
  "session": { "active": true, "templateId": "t_123", "templateName": "Strip 3" },
  "camera":  { "phase": "review", "shot": 3, "shots": 3, "captured": 3, "feed": "live", "retakesLeft": 1 },
  "result":  null,
  "busy":    { "dialog": false, "processing": false },
  "available": ["camera/retake", "camera/process", "session/end", "event/stop"]
}
```

- `event` null → no event runs, `page` is `"none"`.
- **Pages:** `welcome`, `survey`, `categoryPicker`, `templatePicker`, `input`, `camera`, `result`.
- **Camera phases:** `liveIdle` (live view, waiting) → `counting` (countdown) → `capturing` →
  `reveal` (the shot shown) → `shotDelay` (between shots) … → `review` (retake / process).
  `recording` for video templates.
- **`available`**: the actions accepted right now, computed by the same checks the commands run.
  Show a button only when its action is in it (`booth.can('camera/capture')` in the kit).

## Error codes

| HTTP | Code | Meaning |
|---|---|---|
| 400 | `bad_request` | missing / invalid parameter |
| 401 | `unauthorized` | no or wrong password |
| 404 | `not_found` | unknown path |
| 404 | `unknown_event` / `unknown_template` / `unknown_category` | id or index not found |
| 405 | `method_not_allowed` | POST to a read |
| 409 | `no_event` | needs a running event |
| 409 | `event_running` | an event is already running |
| 409 | `editor_open` | the event editor is open |
| 409 | `no_templates` | the event has no usable template |
| 409 | `wrong_page` | not valid on the current page |
| 409 | `wrong_phase` | camera page, but not in a phase that allows it |
| 409 | `dialog_open` | a dialog is on screen |
| 409 | `processing` | a photo is being processed |
| 409 | `busy` | another action is still settling |
| 409 | `not_allowed` | blocked by a rule (retakes used up, print limit, print lock) |
| 409 | `not_configured` | QR type not set up |
| 429 | `too_many_attempts` | too many wrong passwords |

The kit adds one of its own: `offline` (Q-Booth did not answer at all: off, Local API off, wrong port).

## What the API does not give (and the kit's answers)

| Missing | QBoothKit |
|---|---|
| Template / category / event **images** | read from the event folder on the booth PC: `core/covers.js`, `/cover/<id>`, `tools/covers.mjs` (same PC only) |
| **Push** notifications | polling + change events (`core/watch.js`, `web/qbooth.js`) |
| The result **photo** and its QR link | not available; `result/qr` opens Q-Booth's own QR dialog |
| Templates of a stopped event | `GET templates?eventId=` (API) or `covers.savedTemplates()` (files) |

Proposed to the Q-Booth developer (not in the API yet): `GET templates/{id}/cover` (images over the
LAN), outbound triggers (Q-Booth calls a URL on session start / photo / print / end).
