# 拍照亭应用 Local API：简明参考

语言：[English](API.md) · [Bahasa Indonesia](API.id.md) · **中文**

App Kit 应用需要了解的拍照亭应用 Local API 知识（API 版本 1）。套件的
`core/qbooth.js` 封装了全部内容；你很少需要自己拼 URL。

## 开启

拍照亭应用 → **Settings → Advanced → Local API**（仅 Expert mode，专家模式）。默认关闭。设置项：
端口（默认 **8730**）、密码（留空则自动生成）、**Allow LAN**（关闭 = 仅限 127.0.0.1）。
拍照亭应用自身在 `http://<booth>:<port>/` 提供一个沙盒，在 `/docs` 提供文档，在 `/remote` 提供手机遥控器。
公开文档：https://www.lumaqube.com/docs/local-api

## 传输与认证

- 通过 HTTP 访问 `http://<host>:<port>/api/v1/<call>`。读取用 `GET`，操作用 `POST`（也接受 GET）。
  参数：JSON 请求体或查询字符串。
- 密码可以放在以下任一位置：`Authorization: Bearer <password>`、`X-QBooth-Key: <password>`、`?key=<password>`。
  错误 / 缺失 → 401 `unauthorized`；一分钟内失败 10 次 → 在接下来一分钟内返回 429 `too_many_attempts`。
- 每个连接一个请求，请求体上限 64 KB，超时 10 秒。CORS 是开放的。

## 响应

```json
{ "ok": true, "data": { ... } }                       // reads (200)
{ "ok": true, "accepted": "camera/capture" }           // actions (202): returns at once
{ "ok": false, "error": { "code": "wrong_page", "message": "..." } }
```

操作只是把命令交给应用：**效果会在下一次 `status` 中体现**。每 300-500 ms 轮询一次
`status`（套件就是这样做的：`core/watch.js`、`web/qbooth.js`）。

## 调用

| 调用 | 何时有效 | 作用 |
|---|---|---|
| `GET status` | 始终 | 应用、活动、页面、拍摄流程、相机、结果、忙碌状态、`available` |
| `GET commands` | 始终，**无需密码** | 命令列表 |
| `GET events` | 始终 | 所有活动：id、名称、是否归档、模板数量、是否运行中 |
| `POST event/start {id}` | 没有活动在运行、没有对话框、编辑器已关闭 | Launch 按钮 |
| `POST event/stop` | 有活动在运行、没有对话框、未在处理 | 结束拍照亭会话（无需退出 PIN） |
| `GET templates {eventId?}` | 有活动在运行（或带 eventId） | 宾客可选的模板：`id`、`name`、`studio`、`categoryId`，在 Template Picker 上还有 `onScreen` + `index` |
| `GET categories {eventId?}` | 同上 | 已启用的分类 |
| `POST session/start` | Welcome | Start 按钮（先经过 Start PIN / 支付关卡） |
| `POST session/end` | 除 Welcome 外的任意页面 | Home 按钮：回到 Welcome |
| `POST category/select {id \| index}` | Category Picker | 点击一张分类卡片 |
| `POST template/select {id \| index}` | Template Picker（卡片在屏幕上）**或 Welcome** | 点击一张卡片 + Next。从 Welcome 调用：先经过 Start 关卡，然后直接进入该模板（跳过选择页） |
| `POST camera/capture` | Camera，实时取景空闲时（或两次拍摄之间的手动等待） | Capture 按钮 |
| `POST camera/retake` | Camera，Review，还有重拍次数 | Retake 按钮 |
| `POST camera/process` | Camera，Review | Process 按钮 |
| `POST result/print` | Result，允许打印 | Print 按钮 |
| `POST result/qr {type: web \| local}` | Result，已配置该类型的二维码 | 二维码按钮（会打开一个对话框） |

`index` 从 1 开始，按宾客看到的卡片顺序计。同时提供 `id` 和 `index` 时，以 `id` 为准。

**拍照亭应用坚持的规则：** 命令按下的就是宾客会按的同一个按钮，带有所有相同的防护。
任何付费环节都不会被绕过（Start PIN、支付、打印限制照常生效）。状态不对就拒绝，绝不排队。
**屏幕上有对话框时，所有操作都会被阻止**（`dialog_open`）；正在处理时也一样（`processing`）。

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

- `event` 为 null → 没有活动在运行，`page` 为 `"none"`。
- **页面：** `welcome`、`survey`、`categoryPicker`、`templatePicker`、`input`、`camera`、`result`。
- **相机阶段：** `liveIdle`（实时取景，等待中）→ `counting`（倒计时）→ `capturing` →
  `reveal`（展示刚拍的照片）→ `shotDelay`（两次拍摄之间）… → `review`（重拍 / 处理）。
  视频模板为 `recording`。
- **`available`**：当前会被接受的操作，由与命令执行时相同的检查计算得出。
  只有当某个按钮的操作在其中时才显示该按钮（在套件中用 `booth.can('camera/capture')`）。

## 错误码

| HTTP | 错误码 | 含义 |
|---|---|---|
| 400 | `bad_request` | 参数缺失 / 无效 |
| 401 | `unauthorized` | 没有密码或密码错误 |
| 404 | `not_found` | 未知路径 |
| 404 | `unknown_event` / `unknown_template` / `unknown_category` | 找不到该 id 或 index |
| 405 | `method_not_allowed` | 对读取接口使用了 POST |
| 409 | `no_event` | 需要有活动在运行 |
| 409 | `event_running` | 已经有活动在运行 |
| 409 | `editor_open` | 活动编辑器处于打开状态 |
| 409 | `no_templates` | 该活动没有可用的模板 |
| 409 | `wrong_page` | 在当前页面无效 |
| 409 | `wrong_phase` | 在相机页面，但当前阶段不允许 |
| 409 | `dialog_open` | 屏幕上有对话框 |
| 409 | `processing` | 正在处理照片 |
| 409 | `busy` | 另一个操作仍在进行中 |
| 409 | `not_allowed` | 被规则阻止（重拍次数用完、打印限制、打印锁定） |
| 409 | `not_configured` | 该二维码类型未配置 |
| 429 | `too_many_attempts` | 密码错误次数过多 |

套件额外增加了一个：`offline`（拍照亭应用完全没有响应：未运行、Local API 未开启、端口错误）。

## API 不提供的内容（以及套件的解决办法）

| 缺少 | App Kit |
|---|---|
| 模板 / 分类 / 活动的**图片** | 从拍照亭电脑上的活动文件夹读取：`core/covers.js`、`/cover/<id>`、`tools/covers.mjs`（仅限同一台电脑） |
| **推送**通知 | 轮询 + 变化事件（`core/watch.js`、`web/qbooth.js`） |
| 结果**照片**及其二维码链接 | 无法获取；`result/qr` 会打开拍照亭应用自己的二维码对话框 |
| 已停止活动的模板 | `GET templates?eventId=`（API）或 `covers.savedTemplates()`（文件） |

已向拍照亭应用的开发者提议（API 中尚未提供）：`GET templates/{id}/cover`（通过局域网获取图片）、
出站触发（拍照亭应用在拍摄流程开始 / 拍照 / 打印 / 结束时调用一个 URL）。
