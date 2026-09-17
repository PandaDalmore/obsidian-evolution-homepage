/* ============================================================
 * Evolution homepage — 双语字典
 *
 * 约定：代码里一律写英文原文，t() 在中文模式下把它换成中文，英文模式下原样返回。
 * 这样任何一处漏翻译都会退化成英文，而不是显示空白或键名。
 * 占位符用 {name} 书写，第二个参数填值。
 * ============================================================ */

export type Lang = "zh" | "en";

export const LANG_IDS: Lang[] = ["zh", "en"];

/** 语言本身的名字，也走 t()，所以中文模式下不会冒出一个英文单词。 */
export const LANG_LABEL: Record<Lang, string> = { zh: "Chinese", en: "English" };

let current: Lang = "zh";

export function setLang(lang: Lang): void { current = lang; }
export function getLang(): Lang { return current; }

const ZH: Record<string, string> = {
  // ---- 通用控件 ----------------------------------------------------------
  Chinese: "中文",
  English: "英文",
  Language: "语言",
  "Switch the whole homepage between Chinese and English.": "整个主页在中文与英文之间整体切换。",
  Configure: "配置",
  module: "模块",
  Cancel: "取消",
  "Cancel (Esc)": "取消（Esc）",
  Priority: "优先级",
  "Move up": "上移",
  "Move down": "下移",
  Off: "已关闭",
  Auto: "自适应",
  "Left column": "左列",
  "Right column": "右列",

  // ---- 视图与入口 --------------------------------------------------------
  Homepage: "主页",
  "Open homepage": "打开主页",
  "Every path is vault-relative. Settings never include files from the dashboard author’s vault.":
    "所有路径都相对于库根目录；示例里不会包含作者本人的任何文件。",
  "Open homepage on startup": "启动时自动打开主页",
  "Turn on to open the Evolution homepage automatically whenever this vault loads. If the homepage view is already part of your layout (restored workspace, for example), it will not open a second one.":
    "开启后，每次打开这个库会自动打开 Evolution 主页；若主页视图已经在布局里（例如恢复上次工作区），则不会重复打开。",
  "← Back to all settings": "← 返回全部设置",
  "Showing only this module's settings. Click “Back to all settings” to see everything.":
    "只显示当前模块的配置。点「返回全部设置」可查看所有模块。",

  // ---- 模块名 ------------------------------------------------------------
  Diary: "日记",
  Shortcuts: "快捷入口",
  "Open tasks": "待办任务",
  "Active notes": "活跃笔记",

  // ---- 横幅 --------------------------------------------------------------
  Theme: "主题",
  "Edit banner": "编辑横幅",
  Left: "靠左",
  Center: "居中",
  Right: "靠右",

  // ---- 主页上的提示 ------------------------------------------------------
  "Drag left or right to change column width": "左右拖动调整列宽",
  "Resize columns": "调整列宽",
  "Drag to change height; double-click to restore auto height": "拖动调整高度，双击恢复自动高度",
  "Resize card height": "调整卡片高度",
  "Previous month": "上个月",
  "Next month": "下个月",
  "Daily status: {status}": "当日状态：{status}",
  "Pick a diary folder in settings, or enable Obsidian's core Daily notes plugin — this card reuses that configuration.":
    "在设置里填一个日记目录，或启用 Obsidian 核心的「日记」插件，本卡片会自动沿用它的配置。",
  "Add shortcuts in settings — as many as you like.": "在设置里添加快捷入口，想加几条就加几条。",
  "Drag to reorder": "拖动可调整顺序",
  "No task source configured yet; tasks you add above go into today's daily note.":
    "还没有配置任务来源，上面添加的任务会写进当日日记。",
  "No open tasks.": "暂无未完成任务。",
  "Choose active-note tags or folders in Evolution settings.": "到 Evolution 设置里填上标签或目录，这里才会显示活跃笔记。",
  "Sample diary text for today.": "这是今天的日记示例文字。",
  "Note / 2026.09.14": "记录 / 2026.09.14",

  // ---- 任务卡片 ----------------------------------------------------------
  Highest: "最高",
  High: "高",
  Medium: "中",
  Low: "低",
  "Add task": "添加任务",
  "Edit task": "修改任务",
  "Open task note": "打开任务所在笔记",
  "Write a task, press Enter to save": "写一条任务，回车保存",
  "Task text": "任务内容",
  "Due date (optional)": "截止时间（可选）",
  "Priority (optional)": "优先级（可选）",
  "Save task": "保存任务",
  "Save (Enter)": "保存（Enter）",
  "Overdue {due}": "{due} 已过期",
  "Start {date}": "开始 {date}",
  "Scheduled {date}": "计划 {date}",
  "Last done {date}": "上次完成 {date}",
  "New tasks are saved to: {path}": "新任务保存路径：{path}",
  "Always write": "总是写",
  "Only if Tasks is installed": "装了 Tasks 才写",
  Never: "不写",

  // ---- 提示条 ------------------------------------------------------------
  "Added to {path}": "已添加到 {path}",
  "Could not add: {message}": "添加失败：{message}",
  "Task not found in the note; it may have changed elsewhere": "笔记里找不到这条任务，可能被别处改动过",
  "Updated {path}": "已更新 {path}",
  "Could not update: {message}": "修改失败：{message}",
  "Could not complete: {message}": "勾选失败：{message}",
  "Could not create daily note: {message}": "创建日记失败：{message}",
  "Image saved to the vault root: {path}": "图片已保存到库根目录：{path}",
  "Could not upload: {message}": "上传失败：{message}",
  "Could not open the file: {file}": "打不开文件：{file}",
  "File not found in the vault: {file}": "库内找不到文件：{file}",
  "Could not open the local file: {file}": "打不开本地文件：{file}",
  "File not found: {target}": "找不到文件：{target}",

  // ---- 主题 --------------------------------------------------------------
  "A theme only touches the homepage's own text, borders, and per-module accent; card backgrounds stay neutral, and the rest of your vault is untouched.":
    "主题只改主页自己的文字、描边和模块强调色，底色保持中性不染色；库里其它笔记界面一概不动。",
  "Following your Obsidian theme: the homepage inherits the colors of your current theme and overrides nothing.":
    "跟随 Obsidian 主题：主页沿用你当前 Obsidian 主题自身的颜色，不做任何覆盖。",
  "Pick a preset and it applies to the homepage immediately; lightness lifts automatically in dark mode, so nothing needs adjusting by hand.":
    "选一套预设会立刻作用到主页；切到深色模式时亮度会自动提上来，不用手改。",
  "Follow Obsidian theme": "跟随 Obsidian 主题",
  "🎨 Custom": "🎨 自定义",
  "The homepage follows your Obsidian theme and overrides no colors.": "主页跟着 Obsidian 主题走，不覆盖任何颜色。",
  "Pick each color yourself; changes apply immediately.": "逐支指定颜色，改完立刻生效。",
  "🌊 Deep sea": "🌊 深蓝之海",
  "Deep currents, from the dark to the light at the surface": "深海暗流，从幽暗到海面微光",
  "🌅 Sunlit sea": "🌅 逐光之海",
  "Sunlight through water, warm orange into deep blue": "阳光穿透海水，暖橘到深蓝",
  "🌸 Soft blossom": "🌸 柔和粉色",
  "Pastels of rose and lotus — gentle and quiet, never harsh": "玫瑰与藕荷的粉彩，温润安静不刺眼",
  "🌈 Full rainbow": "🌈 全色彩虹",
  "High-saturation rainbow: red through violet": "高饱和彩虹，红橙黄绿蓝紫",
  "Body text": "正文",
  "List items and calendar numbers.": "清单项与日历数字的颜色。",
  Heading: "标题",
  "Fallback color for card headings, used when a module has no color of its own.":
    "各卡片标题的兜底颜色，模块色没设时用它。",
  Accent: "强调",
  "Hover borders, today's highlight, and fallback icon backgrounds.": "悬浮边框、今天高亮、图标兜底色。",
  Border: "边框",
  Tasks: "待办",
  "Diary module": "日记模块",
  "The calendar's month label and today's highlight.": "日历的月份标题与今天高亮。",
  "Shortcuts module": "快捷入口模块",
  "The icon color on the left of each shortcut.": "入口左侧的图标颜色。",
  "Tasks module": "待办模块",
  "The task checkbox color.": "任务复选框的颜色。",
  "Active notes module": "活跃笔记模块",
  "The heading color on active-note cards.": "活跃笔记卡片的标题颜色。",
  "Follow theme": "跟随主题",
  "Red #ff4d4d": "红 #ff4d4d",
  "Orange #f5a623": "橙 #f5a623",
  "Gold #d4af37": "金 #d4af37",
  "Green #2ecc71": "绿 #2ecc71",
  "Blue #4a90d9": "蓝 #4a90d9",
  "Purple #8e6bc9": "紫 #8e6bc9",
  "Black #1a1a1a": "黑 #1a1a1a",
  "White #ffffff": "白 #ffffff",

  // ---- 字号 --------------------------------------------------------------
  "Font size": "字号",
  "Overall font size": "整体字号",
  "Scales every piece of text on the homepage by one step. Defaults to Small, one notch below Obsidian's body size; switch back to Normal or Large if it feels cramped.":
    "主页所有文字统一缩放一档。默认「小」，比 Obsidian 正文字号小一号；觉得紧就调回「标准」或「大」。",
  Small: "小",
  Normal: "标准",
  Large: "大",

  // ---- 横幅与标语设置 ----------------------------------------------------
  "Banner and slogan": "横幅与标语",
  "Banner image": "横幅图片",
  "A vault-relative path or an https link. Prefer not to type paths? Use “Add image” below to upload one from your computer.":
    "库内相对路径或 https 链接。不想手写路径，用下面的「添加图片」直接从本地上传。",
  "Add image": "添加图片",
  "Choose an image from your computer; it is saved to the vault root.": "从本地选择一张图片，上传后保存在库根目录。",
  "Choose and upload": "选择并上传",
  "Banner title": "横幅标题",
  "Main heading shown over the banner.": "显示在横幅上的主标题。",
  "Title alignment": "标题位置",
  "Whether the title sits left, center, or right.": "标题靠左、居中还是靠右。",
  "Title color": "标题颜色",
  "Color for the banner title. Leave blank for white.": "横幅标题文字颜色，留空用白色。",
  "Banner description": "横幅描述",
  "Short introduction shown under the title.": "显示在标题下面的一句话简介。",
  "Description alignment": "描述位置",
  "Left, center, or right for the description — set separately from the title.":
    "描述文字靠左、居中还是靠右，和标题分开设置。",
  "Description color": "描述颜色",
  "Color for the description text. Leave blank for white.": "描述文字颜色，留空用白色。",
  Slogan: "标语",
  "A separate text-only line below the banner.": "横幅下面单独一行纯文字。",
  "Slogan color": "标语颜色",
  "Color for the slogan text. Leave blank to follow the theme's muted color.":
    "标语文字颜色，留空跟随主题灰。",

  // ---- 模块布局 ----------------------------------------------------------
  Layout: "模块布局",
  "Only two things can be done directly on the homepage: drag a card's blank area up or down to reorder (within its own column), and drag the small handle at a card's bottom edge to set its height (double-click the handle to go back to auto height). Switching columns or changing width is done here in settings.":
    "主页上能直接动手的只有两件事：按住卡片空白处上下拖动换顺序（只在同一列里挪），拖卡片底边的小横杠改高度（双击横杠恢复自动高度）。换列、改宽窄都在这一页做。",
  "Every module can sit in the left or right column; use ↑ / ↓ to change its order. The order is shared by the whole list: within a column, modules are stacked top to bottom following it.":
    "每个模块都能放左列或右列，用 ↑ / ↓ 调整上下顺序。顺序是整条列表通用的：同列内按这个顺序从上往下排。",
  "“Half width” modules pair up: two halves in the same column sit side by side, while a lone half takes the full row. To place two modules side by side in the right column, switch both of them to half width. Left/right placement changes only in settings; dragging on the homepage reorders vertically.":
    "「半宽」的模块两两并排：同一列里两条半宽就横着放一起，落单的那条自己占满整行。想在右列横放两个模块，把那两个都切成半宽就行。左右怎么摆只在设置里改，主页上的拖拽只管上下顺序。",
  "Modules turned off in their own sections below appear greyed out and stay off the homepage. When a column ends up with no modules, the other one takes the full width.":
    "关掉的模块（在下面各自的小节里关）会灰着显示，不会出现在主页。某一列一个模块都没分到时，另一列自动占满整行。",
  "Left column width": "左列宽度",
  "Width ratio of the two columns — how many percent the left column takes, {min} to {max}. You can also drag the divider between them on the homepage.":
    "左右两列的宽度比，左列占百分之多少，{min} 到 {max}。主页上拖两列中间那条竖条也能改。",
  "Full row": "整行",
  "Half width": "半宽",
  "Move {name} to {column}": "把{name}放到{column}",
  "Move to {column}": "放到{column}",
  "Module width": "模块宽度",
  "Currently half width: two halves in the same column sit side by side; click to take the full row again.":
    "当前半宽：同一列里两条半宽会并排，点一下改回整行",
  "Currently full row: click to switch to half width; two halves in the same column will sit side by side.":
    "当前整行：点一下改半宽，同列两条半宽会并排",
  "Card height": "卡片高度",
  "Click to restore auto height.": "点一下恢复自动高度",
  "Follows its content right now; drag the card's bottom edge on the homepage to change it.":
    "当前跟着内容走，可以在主页拖卡片底边改",

  // ---- 日记 --------------------------------------------------------------
  "Diary folder": "日记根目录",
  "The level above year folders. Supports {YYYY} {MM} {DD}. Leave blank to reuse the core Daily notes plugin's folder.":
    "年份目录之上的那一层，可用 {YYYY} {MM} {DD}。留空则沿用核心「日记」插件的目录。",
  "Year subfolder": "年份子目录",
  "One level appended after the root folder; defaults to {YYYY}. Leave blank for no per-year folders.":
    "追加在根目录之后的一层，默认 {YYYY}年。留空表示不分年份。",
  "Diary template": "日记模板",
  "Leave blank to reuse the core Daily notes plugin's template. Supports variables such as {{date:YYYY.MM.DD}}.":
    "留空则沿用核心「日记」插件的模板，支持 {{date:YYYY.MM.DD}} 等变量。",
  "File name format": "文件名格式",
  "Supports YYYY, MM, and DD. Leave blank to reuse the core Daily notes plugin's format.":
    "支持 YYYY、MM、DD。留空沿用核心「日记」插件的格式。",
  "Status field": "当日状态字段",
  "Frontmatter field read for calendar colors: write red, amber, or green (🔴 🟡 🟢, or the Chinese 红/黄/绿) to get that color, or put in a raw #rrggbb value.":
    "日历取颜色读的 frontmatter 字段：填 red / amber / green（或 🟡 🔴 🟢、红 / 黄 / 绿）会得到对应颜色，也可以直接填 #rrggbb 色值。",

  // ---- 待办 --------------------------------------------------------------
  "You can add tasks right from the tasks card: type a line and press Enter, no need to open a note first. Due date and priority are optional, and follow the Tasks plugin format on the same line — for example “- [ ] Weekly report ⏫ 📅 2026-09-20”.":
    "主页待办卡片顶部可以直接添加任务：写一行字回车即可，不用先打开笔记。截止时间和优先级是可选输入，填了会按 Tasks 插件的格式写进同一行，例如「- [ ] 交周报 ⏫ 📅 2026-09-20」。",
  "Each task has a pencil button on the right. It opens inline to edit the text, due date, and priority; pressing Enter rewrites that very line in the source note. Overdue dates are shown in red.":
    "每条任务右侧有铅笔按钮，点开就地改内容、截止时间、优先级，回车后直接改写原笔记里那一行；已过期的截止日期会标红。",
  "Completion date (✅)": "完成日期（✅）",
  "When you tick a task on the homepage, whether to append ✅ YYYY-MM-DD to the line. The homepage understands this marker on its own (it shows as a “Last done” badge), so it is useful without the Tasks plugin — and Tasks counts it too if you use it.":
    "在主页勾选完成时，要不要在行尾补一条 ✅ YYYY-MM-DD。主页自己认这个符号（会显示成「上次完成」徽章），所以不装 Tasks 插件也照样有意义；装了 Tasks 的话它那边也统计得到。",
  "Task folders": "任务目录",
  "Comma-separated folders. Tasks in every descendant note are included.":
    "用英文逗号分隔的目录，目录下所有层级的笔记都会被扫进来。",
  "Task notes": "任务笔记",
  "Comma-separated paths of individual task notes. New tasks go into the first note listed here (created if missing). Leave the whole field empty and new tasks land in today's daily note, creating it if needed.":
    "用英文逗号分隔的单篇任务笔记路径。新任务会保存到这里的第一条笔记（文件不存在时自动新建）；整栏留空时，新任务改写到当日日记，日记不存在就新建当天日记。",

  // ---- 活跃笔记 ----------------------------------------------------------
  "Note folders": "笔记目录",
  "Comma-separated folders; leave blank to search the whole vault.":
    "用英文逗号分隔的目录；留空则扫描整个库。",
  "Required tags": "必需标签",
  "Separate tags with commas, for example “project,watch,daily” — any single tag matches (OR, not all required). Leading # is optional and surrounding spaces are trimmed. Nested tags use a slash, as in “project/watch”. Tags must match the note exactly: if the note says #AI, write AI — ai will not match.":
    "多个标签用英文逗号「,」分隔，例如“项目,关注,daily”——任一标签命中即匹配（OR 关系，不需要全中）。带不带前导 # 都行，前后空格自动忽略。嵌套子标签直接写「项目/关注」。标签需与笔记里实际写的完全一致，比如笔记里写 #AI，这里也写 AI，写 ai 不会命中。",
  "Maximum notes": "最多显示几条",
  "How many recently updated notes to display.": "最多显示几条最近更新的笔记。",

  // ---- 快捷入口 ----------------------------------------------------------
  "Each shortcut has exactly two fields: Name is what shows on the homepage, Link is what opens. Add as many as you like; the homepage lists them in order.":
    "每条入口只填两项：「名称」是主页上显示的字，「链接」是要打开的东西。加几条就有几条，主页会按顺序往下排。",
  "The link can be a web address (https://…), a vault note path (for example work/projects/weekly-review.md), or a file:/// link or absolute path to a local file. There is no type to pick — the target decides how it opens.":
    "链接可以填网页地址（https://…）、库内笔记路径（例如 工作/项目/周复盘.md）、或本地文件的 file:/// 链接与绝对路径。不用选类型，点开时自动判断。",
  "Drag any shortcut up or down to change its order on the homepage. Each row also has ↑ / ↓ buttons at the top right when dragging is awkward.":
    "按住任意一条入口上下拖动，可以调整主页上从上到下的顺序。每条右上角有 ↑ / ↓ 按钮，做不到拖动时也能用。",
  "No shortcuts yet — use the button below to add one.": "还没有入口，点下面的按钮加一条。",
  "+ Add shortcut": "+ 添加快捷入口",
  "Shortcut {index}": "入口 {index}",
  "Test open": "测试打开",
  "Delete this": "删除这条",
  Name: "名称",
  "For example: weekly running report": "例如：运动周报",
  Link: "链接",
  "https://… , a vault note path, or file:///…/x.html": "https://… 或 库内笔记路径 或 file:///…/x.html"
};

/** 查不到就退回英文原文，宁可漏翻译也不要空白。 */
export function t(text: string, vars?: Record<string, string | number>): string {
  const out = current === "zh" ? (ZH[text] ?? text) : text;
  if (!vars) return out;
  return out.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match));
}

const MONTHS_ZH = ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"];
const MONTHS_EN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** 日历月份标签：中文「2026年 三月」，英文「March 2026」。 */
export function monthLabel(year: number, monthIndex: number): string {
  return current === "zh"
    ? `📅 ${year}年 ${MONTHS_ZH[monthIndex]}`
    : `📅 ${MONTHS_EN[monthIndex]} ${year}`;
}

/** 日历表头的星期缩写。 */
export function weekdays(): string[] {
  return current === "zh" ? ["日", "一", "二", "三", "四", "五", "六"] : ["S", "M", "T", "W", "T", "F", "S"];
}
