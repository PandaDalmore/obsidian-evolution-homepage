# Evolution

Evolution 是一个可配置的 Obsidian 主页插件。它以笔记本身作为唯一数据源，提供可配置的横幅、日记日历、快捷入口、待办清单和活跃笔记列表。

作者公众号：**达尔进化论**（PandaDalmore），写个人成长、Obsidian、AI 和系统。加我微信 **PandaDal2** 一起聊插件用法。

> English Version：[Evolution (English)](#evolution-english)

## V 1.0.5 功能

- **横幅**：图片 + 标题 + 描述；标题和描述各自单独设置对齐方式（左 / 中 / 右）和颜色
- **独立的文字标语**
- **模块布局**：每个模块可以放在左列或右列，用 ↑ / ↓ 调顺序；某一列被清空时另一列自动占满整行
- **整行 / 半宽**：同一列里两个半宽模块并排显示，落单的那个自动占满整行；右列默认就是两个半宽模块
- **日历**：点击打开或新建当天日记，可配置年份子目录、文件名格式、状态字段和月份切换（卡片不带标题——日历本身就是那个模块）
- **日记回落**：相关字段留空时，自动读取核心「日记」插件的目录、命名格式和模板
- **快捷入口**：可配置笔记、文件和网页链接；主页只显示名称，路径或网址放在悬浮提示里，拖动可排序
- **待办清单**：跨配置好的笔记和文件夹统计未完成任务；勾选、编辑、新增都会写回源 Markdown
- **就地加任务**：在待办卡片顶部输入一行按回车即写入，追加到第一个配置的任务笔记（不存在则创建）；没配任务笔记时写到今天的日记（不存在则先用模板创建）
- **活跃笔记**：按配置的文件夹和标签过滤
- **主题预设**：作用于主页的文字、描边和各模块强调色，自动适配明暗模式

### 新任务写到哪里

待办卡片顶部那行输入框写出的就是普通的 `- [ ] …`：

1. **配了任务笔记**（「任务笔记」的第一条）→ 追加到那篇笔记末尾。路径不存在且以 `.md` 结尾时自动创建。
2. **没配任务笔记** → 追加到今天的日记。日记不存在时先用日记模板创建。
3. 走日记回落这条路时，主页也会把今天的日记扫一遍 `- [ ]`，刚加的任务立刻就能看到。

### 截止时间与优先级

输入框有三个字段：任务正文（必填）、截止日期、优先级，后两个可选。它们按 Tasks 插件的 emoji 格式写入，别的插件照样认：

```
- [ ] 交周报 ⏫ 📅 2026-09-20
```

优先级对应 `🔺 最高 / ⏫ 高 / 🔼 中 / 🔽 低`。主页上截止日期和优先级渲染成小徽章，而不是裸露的 emoji：已过期的日期标红，今天到期的用模块强调色。`[due:: …]` 和 `[priority:: …]` 这类内联字段会从显示的正文里剥掉。

### 模块布局

四件事可以直接在主页上改：

- **卡片高度** — 悬停卡片，拖底部那条小横条；超出卡片高度的内容在卡片内部滚动。双击横条回到自适应高度。
- **列宽** — 拖两列之间那条细竖条。「左列宽度」设置跟着联动，范围 20 到 80，左列可以收得很窄。
- **模块顺序** — 按住卡片空白处上下拖，蓝色横线标出落点。拖拽只在同列内生效；跨列移动，或整行 / 半宽的切换，在设置的布局编辑器里做。
- **字号** — 「字号」提供 小 / 标准 / 大，等比缩放主页上所有文字，包括那些本来会继承 Obsidian 默认字号的任务和列表。

两列各自独立滚动：滚动一侧，另一侧纹丝不动。宽度低于 760px 时两列堆叠，整页统一滚动。

`设置 → 布局` 是同一件事的手工版：每个模块选左列 / 右列，↑ / ↓ 调顺序，还有一个高度标签显示「自适应」或当前像素高度（点一下重置）。在自己那节里被关掉的模块会灰显并跳过。如果所有可见模块都落在同一列，另一列自动折叠，剩下的这列占满整宽。

高度、宽度和顺序都存在插件设置的 `layout` 数组里；缺这些字段的旧设置会自动迁移。早期版本的 `full` 标记在载入时被丢弃。

每条待办都有一个铅笔按钮，切换成同样的行内编辑器；回车重写原笔记里那一行，改动落在源文件上，而不只是主页上。

Evolution 只在插件设置里保存布局和数据源选择。它不把库数据发到任何地方，不需要联网，也不需要账号。

## 主题

主题设置在设置面板顶部。五个选项：跟随 Obsidian、四套移植自 `obsidian-color-boost` skill 的预设（🌊 逐光之海 / 🌅 晴窗暖阳 / 🌸 柔和落樱 / 🌈 长虹），以及自定义色板。它只作用于本主页——库级 CSS 片段不受影响。

**主题永远不上底色。** 卡片和格子的填充沿用 Obsidian 自己的中性表面色。主题只体现在正文文字、标题、强调色、各模块颜色，以及每套预设的一条描边色上。两个原因：

- 带色的卡片底看起来像脏了，不像有意设计的主题，而且会和库里自己的 CSS 片段打架。
- 由色板混出来的填充色每次明暗切换都得重混。背景保持中性，只需要让文字和描边的值去适配。

彩色角色用保序亮度映射加 WCAG 相对亮度兜底来解算，所以像逐光之海这种单一色相的色板不会塌成一片平色。描边色用二分法逼近目标对比度求得，这让四套预设的视觉重量保持一致——HSL 数值远不能反映出色相对感知亮度的影响。

## 依赖说明

**不需要任何第三方插件。** Evolution 直接和 Obsidian 打交道：用 `vault.read` 读笔记，通过 Obsidian 自己的 `metadataCache` 过滤标签，自己解析任务复选框。在一个只装了这一个社区插件的库里它照样跑。

### 必需

| 项目 | 版本 | 原因 |
| --- | --- | --- |
| Obsidian | 1.8.0 以上 | `manifest.json` 中的 `minAppVersion` |

### 可选

| 插件 | 什么时候才用到 |
| --- | --- |
| 日记（核心插件） | 仅作回落。Evolution 设置里目录 / 命名格式 / 模板某项留空时，读取核心「日记」插件中对应的值。 |
| 模板（核心插件） | 不需要。模板按普通 Markdown 文件读取，`{{date}}` 和 `{{date:FORMAT}}` 在创建时替换。 |

### 不需要，但要知道

**Dataview** —— 没用到，也不需要。Evolution 取代了原先写 `dataviewjs` 月历、写 `dataview TASK` 查询的活儿；它存在的部分理由，就是让主页链路不再依赖 Dataview。标签过滤走 Obsidian 原生 metadata 缓存，所以 Dataview 内联字段（`key:: value`）读不到。

**Tasks** —— 不需要，而且两者互不干扰：输入框写的是 Tasks 写的同一套 emoji 元数据，Evolution 自己也读得回来。

1. 截止（📅）、优先级（🔺 ⏫ 🔼 🔽）、开始（🛫）、计划（⏳）、重复（🔁），以及重复任务上的 `✅` 完成日期，都会从行里抽出来显示成小徽章。`🆔` 那串 id 被丢掉——在主页上它只是噪音。
2. 从主页勾选任务会把 `- [ ]` 改写成 `- [x]`，**并追加 `✅ YYYY-MM-DD`**，这样 Tasks 能记录完成时间。重复任务则更新已有的 `✅` 日期，而不是再加一个。
3. 编辑任务会重写整行，但主页不编辑的那些 Tasks 元数据（🔁 🆔 ⏳ 🛫 ✅）会被原样挂回行尾——重复任务依然是重复任务。
4. 有截止日期的排在最前、按日期升序；其余按源笔记里的顺序。
5. 如果某行用的是 Dataview 内联字段（`[due:: 2026-09-20]`），这个值在编辑后保留，但会变回 `📅 2026-09-20` 的写法。
6. 勾选时是否追加 `✅` 是个设置：总是写 / 装了 Tasks 才写 / 不写。主页自己认识这个符号并显示成「上次完成」徽章，所以就算卸载了 Tasks，它照样有用。

## 对库外世界的触碰

Evolution 做的每件事都走 Obsidian 自己的 API，只有三处例外——而这三处都是**你**配置、**你**触发的。后台不发任何东西，启动时不跑任何东西，没有遥测、没有统计、没有自动更新检查。

**1. 用系统默认程序打开文件。** 快捷入口的目标如果是库外的绝对路径（比如另一个盘上的表格），会交给 Electron 的 `shell.openPath`，用它所属文件类型的程序打开。Obsidian 没有跨平台的「用默认程序打开非笔记文件」接口，这条只能借桌面端的宿主能力，因此本插件在 `manifest.json` 里声明了 `isDesktopOnly: true`——**手机上搜不到、也装不了它**。插件不会读回别的程序对那个文件做了什么。

**2. 外部链接。** 长得像 `https://` 或 `mailto:` 的快捷入口目标，通过 `shell.openExternal`（失败时回落 `window.open`）在浏览器里打开。这个 URL 永远只是你自己填进设置的那一个——插件不会自己拼 URL。

**3. 远程横幅图片。** 横幅图片既接受库内相对路径，也接受 `https://` 链接；远程链接以 CSS 背景图加载，这意味着**你的 IP 和 Obsidian 渲染器版本会到达你指向的那台主机**。只用在信得过的主机上，或者把图片放进库里用本地相对路径。还有几个更隐蔽的理由支持放本地：远程图片 404 之后，横幅会变透明，浅色背景下留下白色标题；主机哪天关掉，你的横幅就无声无息地消失了。

这三样都不是默认开启的——主页出厂是空的，在你配置了别的东西之前，它一直待在库里。

## 安装

> **需要桌面版 Obsidian**（Windows / macOS / Linux）。手机版装不了，原因见上面「用系统默认程序打开文件」那一条。

**方式一：手动安装（现在就能用）**

1. 到本仓库的 [Releases](https://github.com/PandaDalmore/obsidian-evolution-homepage/releases) 页面，下载最新版里的 `main.js`、`manifest.json`、`styles.css` 三个文件。
2. 在库目录下找到 `.obsidian/plugins/`，新建一个名为 `evolution-homepage` 的文件夹，把三个文件放进去。文件夹名必须和 manifest 里的插件 id 一致，写成别的名字 Obsidian 认不出来。
3. 重启 Obsidian（或者到 设置 → 第三方插件，点一下已安装插件旁边的刷新按钮）。
4. 设置 → 第三方插件 → 关掉「安全模式」，在「已安装插件」列表里找到 **Evolution homepage**，打开开关。

**方式二：用 BRAT 安装**

1. 先在社区插件市场里安装 BRAT。
2. 打开 BRAT 的设置，点 Add Beta Plugin，填入 `PandaDalmore/obsidian-evolution-homepage`。
3. 回到 设置 → 第三方插件，找到 Evolution homepage 启用。以后要更新，在 BRAT 里点 Update 就行。

**方式三：社区插件市场（等待上架）**

本插件已提交 Obsidian 社区插件市场审核。通过之后，在 设置 → 第三方插件 → 社区插件市场 里搜索 **Evolution homepage** 即可直接安装，之后跟随市场更新。审核期间请先用上面两种方式。

### 从源码构建

想改代码的话：`npm install` 装依赖，`npm run build` 产出同名的三个文件，覆盖掉上面插件目录里的即可。

本仓库刻意不含任何个人库路径或数据。所有数据源都在安装之后从插件设置里选择。

---

# Evolution (English)

Evolution is a configurable Obsidian dashboard. It keeps notes as the source of truth and provides a configurable banner, daily-note calendar, shortcuts, task list, and active-note list.

By PandaDal, author of the WeChat public account **达尔进化论** (PandaDalmore), writing about personal growth, Obsidian, AI, and systems. Reach me on WeChat at **PandaDal2**.

## Version 1.0.5

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

### Where new tasks go

The composer at the top of the Open tasks card writes plain `- [ ] …` lines:

1. **A task note is configured** (`Task notes` first entry) → appended to the end of that note. If the path does not exist yet and ends in `.md`, it is created.
2. **No task note configured** → appended to today's daily note. If that note does not exist, it is created from the daily-note template first.
3. When the daily-note fallback is in use, the dashboard also scans today's daily note for `- [ ]` so a just-added task shows up immediately.

### Due dates and priority

The composer has three fields: the task text (required), a due date, and a priority — both optional. They are written in the Tasks plugin's emoji format so other plugins keep working:

```
- [ ] 交周报 ⏫ 📅 2026-09-20
```

Priority maps to `🔺 最高 / ⏫ 高 / 🔼 中 / 🔽 低`. On the dashboard, due dates and priorities render as small badges instead of raw emoji; a due date in the past is marked red, one due today uses the module accent. `[due:: …]` and `[priority:: …]` inline fields are also stripped from the displayed text.

### Module layout

Four things are adjustable straight on the dashboard:

- **Card height** — hover a card and drag the small bar on its bottom edge. Content taller than the card scrolls inside it. Double-click the bar to go back to auto height.
- **Column width** — drag the thin vertical bar between the two columns. The `Left column width` setting follows along; it ranges from 20 to 80, so the left column can be narrowed a long way.
- **Module order** — press on a card's empty area and drag it up or down. A blue horizontal line marks where it will land. Reordering stays inside the same column; moving a module to the other column, or switching it between full-row / half-width, is done in the layout editor in settings.
- **Font size** — 小 / 标准 / 大 in `Font size`. It scales every piece of text on the dashboard, including lists and tasks that would otherwise inherit Obsidian's default size.

Each column scrolls on its own: scrolling one side leaves the other exactly where it was. Below 760px the columns stack and the whole page scrolls instead.

`Settings → Layout` is the manual version of the same thing: left / right column per module, ↑ / ↓ for order, and a height chip showing auto or the current pixel height (click it to reset). Modules switched off in their own section are greyed out and skipped. If every visible module lands in one column, the other column collapses and the remaining one takes the full width.

Heights, widths, and order live in the `layout` array of the plugin settings; old settings without those fields are migrated automatically. A `full` flag from earlier builds is dropped on load.

Every task row has a pencil button that switches it into the same inline editor; Enter rewrites that exact line in the original note, so the change lands in the source file, not just on the dashboard.

Evolution stores only its layout and source selections in plugin settings. It does not send vault data anywhere and has no network or account requirement.

## Theme

The theme setting sits at the top of the settings tab. Five choices: follow Obsidian, four presets ported from the `obsidian-color-boost` skill (🌊 deep-sea, 🌅 sunlit, 🌸 blossom, 🌈 rainbow), and a custom palette. It affects this dashboard only — vault-wide snippets are left untouched.

**A theme never paints a background.** Card and tile fills stay on Obsidian's own neutral surfaces. The theme shows up in body text, headings, accents, the per-module colors, and one border color per preset. Two reasons:

- A tinted card fill reads as dirty rather than themed, and it fights the vault's own snippets.
- A fill mixed from the tint has to be re-mixed on every light/dark switch. Keep backgrounds neutral and only the text and border values need to adapt.

Colored roles are resolved with an order-preserving lightness mapping plus a WCAG relative-luminance fallback, so a single-hue palette such as deep-sea does not collapse into one flat shade. The border color is solved by bisection against a target contrast ratio, which keeps all four presets at the same visual weight — hue moves perceived lightness far more than the HSL number suggests.

## Dependencies

**No third-party plugin is required.** Evolution talks to Obsidian directly: it reads notes with `vault.read`, filters tags through Obsidian's own `metadataCache`, and parses task checkboxes itself. It runs on a vault where this is the only community plugin installed.

### Required

| Item | Version | Why |
| --- | --- | --- |
| Obsidian | 1.8.0+ | `minAppVersion` in `manifest.json` |

### Optional

| Plugin | When it matters |
| --- | --- |
| Daily notes (core) | Fallback only. If a folder / filename format / template field is left blank in Evolution settings, the matching value is read from the core Daily notes plugin instead. |
| Templates (core) | Not needed. Templates are read as plain Markdown files; `{{date}}` and `{{date:FORMAT}}` are substituted at creation time. |

### Not required, but worth knowing

**Dataview** — not used, not needed. Evolution replaces what a `dataviewjs` calendar plus a `dataview TASK` query used to do; it exists partly so the dashboard no longer depends on Dataview. Tag filtering goes through Obsidian's native metadata cache, so Dataview inline fields (`key:: value`) are not read.

**Tasks** — not needed, and the two stay in step: the composer writes the same emoji metadata Tasks writes, and Evolution reads that text back itself.

1. Due date (📅), priority (🔺 ⏫ 🔼 🔽), start (🛫), scheduled (⏳), recurrence (🔁) and the `✅` completion date on a recurring task are all pulled out of the line and shown as small badges. The `🆔` id is dropped — on a dashboard it is just noise.
2. Ticking a task from the dashboard rewrites `- [ ]` to `- [x]` **and appends `✅ YYYY-MM-DD`**, so Tasks records when it was done. On a recurring task the existing `✅` date is updated rather than duplicated.
3. Editing a task rewrites the whole line, but the Tasks metadata the dashboard does not edit (🔁 🆔 ⏳ 🛫 ✅) is put back on the end — a recurring task stays recurring.
4. Tasks with a due date float to the top and are ordered by date; the rest keep the order of the source notes.
5. If a line used Dataview inline fields instead (`[due:: 2026-09-20]`), the value survives the edit but comes back as `📅 2026-09-20`.
6. Whether ticking a task appends `✅` is a setting: always / only when Tasks is installed / never. The dashboard reads the symbol itself and shows it as a last-completed badge, so it stays useful even with Tasks uninstalled.

## Outside the vault

Everything Evolution does goes through Obsidian's own APIs, with three exceptions — all three are things **you** configure and **you** trigger. Nothing happens in the background, nothing runs at startup, and there is no telemetry, analytics, or auto-update check.

**1. Opening files in their system app.** A shortcut whose target is an absolute path outside the vault (a spreadsheet on another drive, say) is handed to Electron's `shell.openPath` so it opens in whatever app owns that file type. Obsidian has no cross-platform "open with default app" for vault files that are not notes, so this borrows a host capability of the desktop app — which is why the plugin declares `isDesktopOnly: true` in its manifest: **it does not appear in the mobile plugin browser and cannot be installed there.** The plugin never reads back what the other app does with the file.

**2. External links.** Shortcut targets that look like `https://` or `mailto:` are opened in your browser via `shell.openExternal` (falling back to `window.open`). The URL is only ever the one you typed into the settings — the plugin composes no URLs of its own.

**3. Remote banner images.** The banner image accepts either a vault-relative path or an `https://` link, and a remote link is loaded as a CSS background image, which means **your IP and Obsidian's renderer version reach whichever host you point at.** Use it with hosts you trust, or add the image to your vault and reference it locally. There are other, subtler reasons to keep it local: a remote image that 404s leaves a transparent banner with white headings on a light note background, and a host that goes away silently deletes your banner.

None of the three is on by default — the dashboard ships empty, and it stays inside the vault until you configure something that says otherwise.

## Installation

**Option 1: manual install (works today)**

1. Go to the [Releases](https://github.com/PandaDalmore/obsidian-evolution-homepage/releases) page and download `main.js`, `manifest.json`, and `styles.css` from the latest release.
2. Create a folder named `evolution-homepage` under `.obsidian/plugins/` in your vault and drop the three files in. The folder name has to match the plugin id in `manifest.json` — anything else and Obsidian will not pick it up.
3. Restart Obsidian (or use the reload button next to Installed plugins in Settings → Community plugins).
4. In Settings → Community plugins, turn off Restricted mode, then find **Evolution homepage** under Installed plugins and enable it.

**Option 2: BRAT**

1. Install BRAT from the community plugin market first.
2. Open BRAT's settings, choose Add Beta Plugin, and enter `PandaDalmore/obsidian-evolution-homepage`.
3. Back in Settings → Community plugins, enable Evolution homepage. Future updates come from BRAT's Update button.

**Option 3: community plugin market (pending review)**

The plugin has been submitted to the official community plugin list. Once it lands, search **Evolution homepage** in Settings → Community plugins → Browse and install from there; updates then follow the market. Until then, use one of the two options above.

### Building from source

To hack on the code: `npm install` for dependencies, `npm run build` to produce the same three files — overwrite the ones in the plugin folder above.

The repository intentionally contains no personal vault paths or data. Every data source is selected from the plugin settings after installation.
