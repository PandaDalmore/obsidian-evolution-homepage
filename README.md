# Evolution

Evolution is a configurable Obsidian dashboard. It keeps notes as the source of truth and provides a configurable banner, daily-note calendar, shortcuts, task list, and active-note list.

## First version

- Banner with an image, title, and description; title and description each have their own alignment (left / center / right) and colour
- Separate text slogan
- Module layout: every module can sit in the left or right column and be reordered with ↑ / ↓; when a column ends up empty the other one spans the full row
- Every module is either full-row or half-width — two half-width modules in the same column sit side by side, a lone one fills the row; the right column ships with two half-width modules by default
- Click-to-open or click-to-create daily-note calendar with a configurable year subfolder, filename format, status field, and month switcher (the card carries no title — the calendar is the module)
- Daily notes fall back to the core Daily notes plugin folder, filename format, and template when a field is left blank
- Configurable note, file, and web shortcuts — the dashboard shows only the label; the path or URL stays in the tooltip and can be reordered by dragging
- Open-task list across configured notes and folders; completing, editing, or adding a task rewrites the source Markdown
- Add tasks in place from the dashboard: type one line and press Enter — it is appended to the first configured task note (created if missing), or to today's daily note (created if missing) when no task note is configured
- Active-note list filtered by configurable folders and tags
- Theme presets applied to the dashboard's text, borders, and per-module accents, with automatic light/dark adaptation

### Where new tasks go（新任务写到哪里）

The composer at the top of the Open tasks card writes plain `- [ ] …` lines:

1. **A task note is configured** (`Task notes` first entry) → appended to the end of that note. If the path does not exist yet and ends in `.md`, it is created.
2. **No task note configured** → appended to today's daily note. If that note does not exist, it is created from the daily-note template first.
3. When the daily-note fallback is in use, the dashboard also scans today's daily note for `- [ ]` so a just-added task shows up immediately.

### Due dates and priority（截止时间与优先级）

The composer has three fields: the task text (required), a due date, and a priority — both optional. They are written in the Tasks plugin's emoji format so other plugins keep working:

```
- [ ] 交周报 ⏫ 📅 2026-09-20
```

Priority maps to `🔺 最高 / ⏫ 高 / 🔼 中 / 🔽 低`. On the dashboard, due dates and priorities render as small badges instead of raw emoji; a due date in the past is marked red, one due today uses the module accent. `[due:: …]` and `[priority:: …]` inline fields are also stripped from the displayed text.

### Module layout（模块放哪一列）

Four things are adjustable straight on the dashboard:

- **Card height** — hover a card and drag the small bar on its bottom edge. Content taller than the card scrolls inside it. Double-click the bar to go back to auto height.
- **Column width** — drag the thin vertical bar between the two columns. The `Left column width` setting follows along; it ranges from 20 to 80, so the left column can be narrowed a long way.
- **Module order** — press on a card's empty area and drag it up or down. A blue horizontal line marks where it will land. Reordering stays inside the same column; moving a module to the other column, or switching it between 整行 / 半宽, is done in the layout editor in settings.
- **Font size** — 小 / 标准 / 大 in `Font size`. It scales every piece of text on the dashboard, including lists and tasks that would otherwise inherit Obsidian's default size.

Each column scrolls on its own: scrolling one side leaves the other exactly where it was. Below 760px the columns stack and the whole page scrolls instead.

`Settings → Layout` is the manual version of the same thing: 左列 / 右列 per module, ↑ / ↓ for order, and a height chip showing `自适应` or the current pixel height (click it to reset). Modules switched off in their own section are greyed out and skipped. If every visible module lands in one column, the other column collapses and the remaining one takes the full width.

Heights, widths, and order live in the `layout` array of the plugin settings; old settings without those fields are migrated automatically. A `full` flag from earlier builds is dropped on load.

Every task row has a pencil button that switches it into the same inline editor; Enter rewrites that exact line in the original note, so the change lands in the source file, not just on the dashboard.

Evolution stores only its layout and source selections in plugin settings. It does not send vault data anywhere and has no network or account requirement.

## Theme（主题）

The theme setting sits at the top of the settings tab. Five choices: follow Obsidian, four presets ported from the `obsidian-color-boost` skill (🌊 deep-sea, 🌅 sunlit, 🌸 blossom, 🌈 rainbow), and a custom palette. It affects this dashboard only — vault-wide snippets are left untouched.

**A theme never paints a background.** Card and tile fills stay on Obsidian's own neutral surfaces. The theme shows up in body text, headings, accents, the per-module colors, and one border color per preset. Two reasons:

- A tinted card fill reads as dirty rather than themed, and it fights the vault's own snippets.
- A fill mixed from the tint has to be re-mixed on every light/dark switch. Keep backgrounds neutral and only the text and border values need to adapt.

Colored roles are resolved with an order-preserving lightness mapping plus a WCAG relative-luminance fallback, so a single-hue palette such as deep-sea does not collapse into one flat shade. The border color is solved by bisection against a target contrast ratio, which keeps all four presets at the same visual weight — hue moves perceived lightness far more than the HSL number suggests.

## Dependencies（依赖说明）

**No third-party plugin is required.** Evolution talks to Obsidian directly: it reads notes with `vault.read`, filters tags through Obsidian's own `metadataCache`, and parses task checkboxes itself. It runs on a vault where this is the only community plugin installed.

### Required（必需）

| Item | Version | Why |
| --- | --- | --- |
| Obsidian | 1.8.0+ | `minAppVersion` in `manifest.json` |

### Optional（可选）

| Plugin | When it matters |
| --- | --- |
| Daily notes (core) | Fallback only. If a folder / filename format / template field is left blank in Evolution settings, the matching value is read from the core Daily notes plugin instead. |
| Templates (core) | Not needed. Templates are read as plain Markdown files; `{{date}}` and `{{date:FORMAT}}` are substituted at creation time. |

### Not required, but worth knowing（不需要，但要知道）

**Dataview** — not used, not needed. Evolution replaces what a `dataviewjs` calendar plus a `dataview TASK` query used to do; it exists partly so the dashboard no longer depends on Dataview. Tag filtering goes through Obsidian's native metadata cache, so Dataview inline fields (`key:: value`) are not read.

**Tasks** — not needed, and the two stay in step: the composer writes the same emoji metadata Tasks writes, and Evolution reads that text back itself.

1. Due date (📅), priority (🔺 ⏫ 🔼 🔽), start (🛫), scheduled (⏳), recurrence (🔁) and the `✅` completion date on a recurring task are all pulled out of the line and shown as small badges. The `🆔` id is dropped — on a dashboard it is just noise.
2. Ticking a task from the dashboard rewrites `- [ ]` to `- [x]` **and appends `✅ YYYY-MM-DD`**, so Tasks records when it was done. On a recurring task the existing `✅` date is updated rather than duplicated.
3. Editing a task rewrites the whole line, but the Tasks metadata the dashboard does not edit (🔁 🆔 ⏳ 🛫 ✅) is put back on the end — a recurring task stays recurring.
4. Tasks with a due date float to the top and are ordered by date; the rest keep the order of the source notes.
5. If a line used Dataview inline fields instead (`[due:: 2026-09-20]`), the value survives the edit but comes back as `📅 2026-09-20`.
6. Whether ticking a task appends `✅` is a setting: 总是写 / 装了 Tasks 才写 / 不写. The dashboard reads the symbol itself and shows it as a 上次完成 badge, so it stays useful even with Tasks uninstalled.

### 中文要点

- 这个插件**不依赖任何第三方插件**，只需要 Obsidian 本体 1.8.0 以上。它自己读文件、走原生 metadataCache 筛标签、自己解析 `- [ ]`，所以裸库也能直接用。
- 原来靠 `dataviewjs` 写的月历、靠 `dataview TASK` 查的待办，现在都由插件原生实现 —— 它本身就是用来把 Dataview 从主页链路上摘掉的。
- 唯一会用到的核心插件是**核心「日记」插件**，而且只在设置里对应字段留空时作为回落读取（目录 / 命名格式 / 模板）。核心「模板」插件不需要。
- **Tasks 插件不装能用，装了也不冲突**：添加任务写的是 Tasks 那套 emoji（📅 截止、⏫🔼🔽 优先级），主页自己读得懂。截止日、优先级、开始（🛫）、计划（⏳）、重复（🔁）、重复任务行尾的完成日期（✅）全部挑出来做成小徽章，不留在标题里；`🆔` 那串 id 直接丢掉，主页上没意义。
- **和 Tasks 对得上**：① 主页勾选完成会写成 `- [x] … ✅ 2026-09-15`，Tasks 那边统计得到完成日期，重复任务则更新原有的 ✅ 而不是再加一个；② 编辑任务虽然整行重写，但主页不编辑的那些元数据（🔁 🆔 ⏳ 🛫 ✅）会原样挂回行尾，重复任务不会因此变成一次性任务；③ 有到期日的排在最前、按日期升序，没有到期日的按来源笔记顺序跟在后面。
- **一点差异**：如果某行原来用的是 Dataview 内联字段（`[due:: 2026-09-20]`），编辑保存后会变成 Tasks 的 `📅 2026-09-20` 写法。
- **勾选时写不写 ✅ 由你定**：设置里「完成日期（✅）」三档——总是写（默认）/ 装了 Tasks 才写 / 不写。主页自己认这个符号，所以**卸载 Tasks 之后它照样有意义**（显示成「上次完成」徽章）；嫌行尾啰嗦就选「不写」。

## Outside the vault（对库外世界的触碰）

Everything Evolution does goes through Obsidian's own APIs, with three exceptions — all three are things **you** configure and **you** trigger. Nothing happens in the background, nothing runs at startup, and there is no telemetry, analytics, or auto-update check.

**1. Opening files in their system app.** A shortcut whose target is an absolute path outside the vault (a spreadsheet on another drive, say) is handed to `shell.openPath` so it opens in whatever app owns that file type. Obsidian has no cross-platform "open with default app" for vault files that are not notes, so this is Electron-only: **on mobile that step is skipped and a notice is shown instead of failing silently.** The plugin never reads back what the other app does with the file.

**2. External links.** Shortcut targets that look like `https://` or `mailto:` are opened in your browser via `shell.openExternal` (falling back to `window.open`). The URL is only ever the one you typed into the settings — the plugin composes no URLs of its own.

**3. Remote banner images.** The banner image accepts either a vault-relative path or an `https://` link, and a remote link is loaded as a CSS background image, which means **your IP and Obsidian's renderer version reach whichever host you point at.** Use it with hosts you trust, or add the image to your vault and reference it locally. There are other, subtler reasons to keep it local: a remote image that 404s leaves a transparent banner with white headings on a light note background, and a host that goes away silently deletes your banner.

None of the three is on by default — the dashboard ships empty, and it stays inside the vault until you configure something that says otherwise.

### 中文要点

- 除了你自己在设置里配的东西，插件不碰库外的任何资源；没有联网上报、没有统计、没有启动时偷偷拉数据的行为。
- 唯一的三处例外：**库外文件用系统默认程序打开**（仅桌面端，手机端会提示打不开而不是静默失败）、**外链跳浏览器**、**横幅支持远程图片**。
- 远程图片等于把你访问该主机的请求头暴露给对方；不建议用来路不明的图床，最好把图片放进库里、填相对路径。除此之外，图床挂掉也会让你的横幅直接变空白。

## Development

Install dependencies with `npm install`, then run `npm run dev`. Copy `main.js`, `manifest.json`, and `styles.css` to your vault's `.obsidian/plugins/evolution-dashboard/` directory for local testing.

The repository intentionally contains no personal vault paths or data. Every data source is selected from the plugin settings.
