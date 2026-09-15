import {
  App,
  ItemView,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
  WorkspaceLeaf,
  normalizePath,
  setIcon
} from "obsidian";

const VIEW_TYPE_EVOLUTION = "evolution-dashboard-view";

type SettingsFocus = "theme" | "banner" | "diary" | "tasks" | "projects" | "shortcuts" | null;

/** 四个可以上色的模块，和主页上的卡片一一对应 */
type ModuleKey = "diary" | "shortcuts" | "tasks" | "projects";

/** 主题来源：跟随 Obsidian / skill 里的四套预设 / 逐项自定义 */
type ThemeId = "auto" | "deep-sea" | "sunlit" | "blossom" | "rainbow" | "custom";

const THEME_IDS: ThemeId[] = ["auto", "deep-sea", "sunlit", "blossom", "rainbow", "custom"];
/**
 * 存档里的 theme 必须过一遍白名单：拿不到预设就去读 THEME_PRESETS[主题].palette，
 * 一个不认识的值会让整块主页渲染抛错白屏。不认识的一律退回"跟随 Obsidian"。
 */
function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && (THEME_IDS as string[]).includes(value);
}

/**
 * 一套主题只负责文字与模块强调色。
 * 卡片底色、边框、次要文字不去单独配，交给 CSS 用主色跟当前背景混出来，
 * 这样明暗模式切换时不用逐色重算。
 */
interface ThemePalette {
  /** 正文文字 */
  text: string;
  /** 卡片标题 */
  heading: string;
  /** 强调色：悬浮边框、今天高亮、图标兜底色 */
  accent: string;
  /** 卡片底色与边框的取色基准 */
  tint: string;
  /** 每个模块各自的强调色 */
  modules: Record<ModuleKey, string>;
  /** 饱和度上限，彩虹放高、粉彩压低；不写则按明暗给默认值 */
  saturation?: number;
}

interface CustomTheme {
  text: string;
  heading: string;
  accent: string;
  modules: Record<ModuleKey, string>;
}

/** 横幅文字的横向位置：靠左、居中、靠右。 */
type BannerAlign = "left" | "center" | "right";

const BANNER_ALIGNS: BannerAlign[] = ["left", "center", "right"];
const ALIGN_LABEL: Record<BannerAlign, string> = { left: "靠左", center: "居中", right: "靠右" };

interface BannerSettings {
  image: string;
  title: string;
  titleColor: string;
  titleAlign: BannerAlign;
  description: string;
  descriptionColor: string;
  descriptionAlign: BannerAlign;
  dim: number;
  height: number;
}

/** 存档里如果混进别的值，一律退回靠左，免得样式失效。 */
function normalizeAlign(value: unknown): BannerAlign {
  return BANNER_ALIGNS.includes(value as BannerAlign) ? (value as BannerAlign) : "left";
}

/** 老版本没有位置和描述颜色，合并时补默认值。 */
function normalizeBanner(value: Partial<BannerSettings> | null | undefined): BannerSettings {
  const merged = { ...DEFAULT_SETTINGS.banner, ...value };
  return {
    ...merged,
    titleAlign: normalizeAlign(merged.titleAlign),
    descriptionAlign: normalizeAlign(merged.descriptionAlign),
    dim: clampNumber(String(merged.dim ?? DEFAULT_SETTINGS.banner.dim), 0, 100, DEFAULT_SETTINGS.banner.dim),
    height: clampNumber(String(merged.height ?? DEFAULT_SETTINGS.banner.height), 120, 800, DEFAULT_SETTINGS.banner.height)
  };
}

interface DiarySettings {
  enabled: boolean;
  folder: string;
  yearPattern: string;
  template: string;
  dateFormat: string;
  statusField: string;
}

interface TaskSettings {
  enabled: boolean;
  folders: string[];
  files: string[];
  /** 勾选完成时要不要补一条 ✅ 完成日期：总是写 / 只在装了 Tasks 时写 / 不写。 */
  doneDate: DoneDateMode;
}

/** 完成日期的写法。主页自己认 ✅，所以不装 Tasks 也照样有意义。 */
type DoneDateMode = "always" | "with-tasks" | "never";
const DONE_DATE_LABEL: Record<DoneDateMode, string> = { always: "总是写", "with-tasks": "装了 Tasks 才写", never: "不写" };
const DONE_DATE_MODES = Object.keys(DONE_DATE_LABEL) as DoneDateMode[];

interface ProjectSettings {
  enabled: boolean;
  folders: string[];
  tags: string[];
  limit: number;
}

/** 模块放在哪一列：左列或右列。 */
type ColumnSide = "left" | "right";

/** 一条布局记录：哪个模块 + 放哪一列。数组顺序就是主页从上到下的顺序。 */
interface LayoutEntry {
  key: ModuleKey;
  column: ColumnSide;
  /** 卡片高度（px）。0 表示跟着内容走，不固定。拖底边改的就是它。 */
  height: number;
  /** 占整行还是半行。同一列里两条半宽会并排。 */
  span: ModuleSpan;
}

const MODULE_LABEL: Record<ModuleKey, string> = {
  diary: "Diary（日记）",
  shortcuts: "Shortcuts（快捷入口）",
  tasks: "Open tasks（待办任务）",
  projects: "Active notes（活跃笔记）"
};

/** 一个模块在列里占多宽：整行，还是半行（同一列两条半宽自动并排）。 */
type ModuleSpan = "full" | "half";

const SPAN_LABEL: Record<ModuleSpan, string> = { full: "整行", half: "半宽" };

const DEFAULT_LAYOUT: LayoutEntry[] = [
  { key: "diary", column: "left", height: 0, span: "full" },
  { key: "shortcuts", column: "left", height: 0, span: "full" },
  { key: "tasks", column: "right", height: 0, span: "half" },
  { key: "projects", column: "right", height: 0, span: "half" }
];

/** 卡片能拖到的最小高度，再矮就没法用了。 */
const MIN_CARD_HEIGHT = 120;
/** 左列宽度占比的上下限：越小左列越窄，右列相应变宽。 */
const MIN_LEFT_WIDTH = 20;
const MAX_LEFT_WIDTH = 80;

/** 老版本的设置里没有 layout，补一份默认的；缺哪个模块补哪个，多的丢掉。 */
function normalizeLayout(value: unknown): LayoutEntry[] {
  const saved = Array.isArray(value) ? value : [];
  const entries: LayoutEntry[] = [];
  const seen = new Set<ModuleKey>();
  for (const item of saved) {
    const entry = item as Partial<LayoutEntry> | null | undefined;
    if (!entry || !entry.key) continue;
    if (!MODULE_KEYS.includes(entry.key)) continue;
    // 同一个模块出现两次就只认第一条：两条记录的 data-index 会打架，拖拽排序会乱。
    if (seen.has(entry.key)) continue;
    seen.add(entry.key);
    const height = typeof entry.height === "number" && Number.isFinite(entry.height)
      ? Math.max(0, Math.round(entry.height))
      : 0;
    entries.push({
      key: entry.key,
      column: entry.column === "right" ? "right" : "left",
      height: height > 0 ? Math.max(MIN_CARD_HEIGHT, height) : 0,
      span: entry.span === "half" ? "half" : "full"
    });
  }
  for (const key of MODULE_KEYS) {
    if (!entries.some((entry) => entry.key === key)) {
      const fallback = DEFAULT_LAYOUT.find((entry) => entry.key === key);
      entries.push(fallback ? { ...fallback } : { key, column: "left", height: 0, span: "full" });
    }
  }
  return entries;
}

/** 升级前存的布局里没有 span 字段，据此判断要不要把右列自动切成半宽。 */
function layoutHasSpan(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  return value.some((item) => !!item && typeof item === "object" && "span" in (item as Record<string, unknown>));
}

/** 一条快捷入口只有两项内容：显示的名字 + 要打开的链接。类型与图标都按链接自动判断。 */
interface Shortcut {
  id: string;
  label: string;
  target: string;
}

/** 优先级四档，对应 Tasks 插件的表情符号；留空表示不设优先级。 */
type TaskPriority = "highest" | "high" | "medium" | "low";

/** 输入框里的三项内容：正文必填，截止时间和优先级可选。 */
interface TaskDraft {
  text: string;
  due: string;
  priority: TaskPriority | "";
}

/** 从笔记里扫出来的一条任务，raw 是原始行文本，text 是去掉表情符号后的正文。 */
interface TaskItem {
  file: TFile;
  line: number;
  raw: string;
  text: string;
  due: string;
  priority: TaskPriority | "";
  /** 上一次完成的日期（Tasks 的重复任务会把 ✅ 日期留在新生成的那一行上）。 */
  done: string;
  /** 🔁 重复规则、⏳ 计划日期、🛫 开始日期，Tasks 写的就顺手显示出来。 */
  repeat: string;
  scheduled: string;
  start: string;
}

const PRIORITY_ORDER: TaskPriority[] = ["highest", "high", "medium", "low"];
const PRIORITY_EMOJI: Record<TaskPriority, string> = { highest: "🔺", high: "⏫", medium: "🔼", low: "🔽" };
const PRIORITY_LABEL: Record<TaskPriority, string> = { highest: "最高", high: "高", medium: "中", low: "低" };
const EMPTY_DRAFT: TaskDraft = { text: "", due: "", priority: "" };

interface EvolutionSettings {
  theme: ThemeId;
  customTheme: CustomTheme;
  /** 主页整体字号的档位，具体倍数看 FONT_SCALES。 */
  fontScale: FontScaleId;
  banner: BannerSettings;
  slogan: string;
  sloganColor: string;
  leftWidth: number;
  layout: LayoutEntry[];
  diary: DiarySettings;
  shortcuts: Shortcut[];
  tasks: TaskSettings;
  projects: ProjectSettings;
}

/** 字号档位。默认给"小"，主页信息密度高，Obsidian 默认字号看着偏大。 */
type FontScaleId = "small" | "normal" | "large";
const FONT_SCALES: Record<FontScaleId, number> = { small: 0.9, normal: 1, large: 1.1 };
const FONT_SCALE_LABEL: Record<FontScaleId, string> = { small: "小", normal: "标准", large: "大" };
const FONT_SCALE_IDS = Object.keys(FONT_SCALES) as FontScaleId[];

const MODULE_KEYS: ModuleKey[] = ["diary", "shortcuts", "tasks", "projects"];

const DEFAULT_SETTINGS: EvolutionSettings = {
  theme: "auto",
  fontScale: "small",
  customTheme: {
    text: "#2f2f37",
    heading: "#8e6bc9",
    accent: "#b295e4",
    modules: { diary: "#0a9396", shortcuts: "#ca6702", tasks: "#9b2226", projects: "#005f73" }
  },
  banner: {
    image: "",
    title: "Evolution",
    titleColor: "",
    titleAlign: "left",
    description: "Build a dashboard around the way you think and work.",
    descriptionColor: "",
    descriptionAlign: "left",
    dim: 42,
    height: 190
  },
  slogan: "Evolve with intention.",
  sloganColor: "",
  leftWidth: 42,
  layout: DEFAULT_LAYOUT.map((entry) => ({ ...entry })),
  diary: { enabled: true, folder: "", yearPattern: "{YYYY}年", template: "", dateFormat: "YYYY.MM.DD", statusField: "当日状态" },
  shortcuts: [],
  tasks: { enabled: true, folders: [], files: [], doneDate: "always" },
  projects: { enabled: true, folders: [], tags: [], limit: 12 }
};

export default class EvolutionPlugin extends Plugin {
  settings: EvolutionSettings = DEFAULT_SETTINGS;
  pendingFocus: SettingsFocus = null;
  private settingTab: EvolutionSettingTab | null = null;
  /** 节流用的定时器：连续触发的刷新只跑最后一次。 */
  private refreshTimer: number | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.registerView(VIEW_TYPE_EVOLUTION, (leaf) => new EvolutionView(leaf, this));
    this.addRibbonIcon("home", "打开主页", () => void this.openDashboard());
    this.addCommand({ id: "open-dashboard", name: "打开主页", callback: () => void this.openDashboard() });
    this.settingTab = new EvolutionSettingTab(this.app, this);
    this.addSettingTab(this.settingTab);
    this.registerEvent(this.app.vault.on("modify", () => this.scheduleRefresh()));
    this.registerEvent(this.app.vault.on("create", () => this.scheduleRefresh()));
    this.registerEvent(this.app.vault.on("delete", () => this.scheduleRefresh()));
    this.registerEvent(this.app.vault.on("rename", () => this.scheduleRefresh()));
    this.registerEvent(this.app.metadataCache.on("changed", () => this.scheduleRefresh()));
    // 明暗模式切换、换主题、改强调色都会触发 css-change，重新算一遍主题色
    this.registerEvent(this.app.workspace.on("css-change", () => this.scheduleRefresh()));
    // 切回主页标签时补刷：后台那一次本来是要跳过的。
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.scheduleRefresh()));
  }

  onunload(): void {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_EVOLUTION);
  }

  async loadSettings(): Promise<void> {
    const saved = (await this.loadData()) as Partial<EvolutionSettings> | null;
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...saved,
      theme: isThemeId(saved?.theme) ? saved.theme : DEFAULT_SETTINGS.theme,
      customTheme: {
        ...DEFAULT_SETTINGS.customTheme,
        ...saved?.customTheme,
        modules: { ...DEFAULT_SETTINGS.customTheme.modules, ...saved?.customTheme?.modules }
      },
      banner: normalizeBanner(saved?.banner),
      fontScale: FONT_SCALE_IDS.includes(saved?.fontScale as FontScaleId) ? (saved?.fontScale as FontScaleId) : DEFAULT_SETTINGS.fontScale,
      // 存档是手写在磁盘上的，越界的脏值原样用会把布局搞塌，这里统一收一次范围。
      leftWidth: clampNumber(String(saved?.leftWidth ?? DEFAULT_SETTINGS.leftWidth), MIN_LEFT_WIDTH, MAX_LEFT_WIDTH, DEFAULT_SETTINGS.leftWidth),
      diary: { ...DEFAULT_SETTINGS.diary, ...saved?.diary },
      tasks: {
        ...DEFAULT_SETTINGS.tasks,
        ...saved?.tasks,
        doneDate: DONE_DATE_MODES.includes(saved?.tasks?.doneDate as DoneDateMode)
          ? (saved?.tasks?.doneDate as DoneDateMode)
          : DEFAULT_SETTINGS.tasks.doneDate
      },
      projects: {
        ...DEFAULT_SETTINGS.projects,
        ...saved?.projects,
        limit: clampNumber(String(saved?.projects?.limit ?? DEFAULT_SETTINGS.projects.limit), 1, 50, DEFAULT_SETTINGS.projects.limit)
      },
      layout: this.migrateLayout(saved?.layout),
      shortcuts: (saved?.shortcuts ?? []).map(normalizeShortcut).filter((item): item is Shortcut => item !== null)
    };
  }

  /** 勾选完成时写不写 ✅ 完成日期。主页自己也认这个符号，所以不装 Tasks 一样有意义。 */
  shouldWriteDoneDate(): boolean {
    const mode = this.settings.tasks.doneDate;
    if (mode === "never") return false;
    if (mode === "always") return true;
    return tasksPluginEnabled(this.app);
  }

  /** 快捷入口没有开关，其余模块按各自设置里的 enabled 决定显不显示。 */
  isModuleEnabled(key: ModuleKey): boolean {
    if (key === "diary") return this.settings.diary.enabled;
    if (key === "tasks") return this.settings.tasks.enabled;
    if (key === "projects") return this.settings.projects.enabled;
    return true;
  }

  /** 上下移动：跨列也照移，落到哪一列由这条记录自己的 column 决定。 */
  async moveLayoutEntry(index: number, delta: number): Promise<void> {
    const list = this.settings.layout.slice();
    const target = index + delta;
    if (index < 0 || index >= list.length || target < 0 || target >= list.length) return;
    const [moved] = list.splice(index, 1);
    list.splice(target, 0, moved);
    this.settings.layout = list;
    await this.saveSettings();
  }

  async setLayoutColumn(index: number, column: ColumnSide): Promise<void> {
    const entry = this.settings.layout[index];
    if (!entry || entry.column === column) return;
    this.settings.layout = this.settings.layout.map((item, i) => (i === index ? { ...item, column } : item));
    await this.saveSettings();
  }

  /** 主页上直接拖卡片排序：从 from 挪到 to。只调上下顺序，列归属和宽窄不动（那两个在设置里改）。 */
  async reorderLayout(from: number, to: number): Promise<void> {
    const list = this.settings.layout.slice();
    if (from < 0 || from >= list.length) return;
    const [moved] = list.splice(from, 1);
    const target = Math.max(0, Math.min(list.length, to > from ? to - 1 : to));
    list.splice(target, 0, moved);
    this.settings.layout = list;
    await this.saveSettings();
  }

  /** 拖底边调高度：0 表示恢复自适应。 */
  async setLayoutHeight(key: ModuleKey, height: number): Promise<void> {
    const clean = height > 0 ? Math.max(MIN_CARD_HEIGHT, Math.round(height)) : 0;
    this.settings.layout = this.settings.layout.map((item) => (item.key === key ? { ...item, height: clean } : item));
    await this.saveSettings();
  }

  /** 整行 / 半宽切换。同一列里两条半宽会并排，只留一条半宽时它自己占满整行。 */
  async setLayoutSpan(key: ModuleKey, span: ModuleSpan): Promise<void> {
    this.settings.layout = this.settings.layout.map((item) => (item.key === key ? { ...item, span } : item));
    await this.saveSettings();
  }

  /** 老存档升级：原来没有 span 字段，把右列的模块切成半宽，右列就自动两两并排。 */
  private migrateLayout(value: unknown): LayoutEntry[] {
    const layout = normalizeLayout(value);
    if (Array.isArray(value) && value.length && !layoutHasSpan(value)) {
      for (const entry of layout) if (entry.column === "right") entry.span = "half";
    }
    return layout;
  }

  /** 左列宽度占比，允许 20–80；右列就是剩下的部分。 */
  async setLeftWidth(width: number): Promise<void> {
    this.settings.leftWidth = clampNumber(String(width), MIN_LEFT_WIDTH, MAX_LEFT_WIDTH, 42);
    await this.saveSettings();
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    this.scheduleRefresh();
  }

  async addShortcut(): Promise<void> {
    this.settings.shortcuts = [...this.settings.shortcuts, { id: `shortcut-${Date.now().toString(36)}`, label: "", target: "" }];
    await this.saveSettings();
  }

  async removeShortcut(index: number): Promise<void> {
    if (index < 0 || index >= this.settings.shortcuts.length) return;
    const list = this.settings.shortcuts.slice();
    list.splice(index, 1);
    this.settings.shortcuts = list;
    await this.saveSettings();
  }

  /**
   * 调整顺序。from 是当前下标，insertBefore 表示「插到哪个缝隙里」，
   * 用移动之前的数组下标表示：0 表示最前面，length 表示最后面。
   */
  async reorderShortcut(from: number, insertBefore: number): Promise<void> {
    const list = this.settings.shortcuts.slice();
    if (from < 0 || from >= list.length) return;
    const gap = Math.max(0, Math.min(list.length, insertBefore));
    const destination = from < gap ? gap - 1 : gap;
    if (destination === from) return;
    const [moved] = list.splice(from, 1);
    list.splice(destination, 0, moved);
    this.settings.shortcuts = list;
    await this.saveSettings();
  }

  async openDashboard(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_EVOLUTION)[0];
    if (existing) {
      this.app.workspace.setActiveLeaf(existing, { focus: true });
      return;
    }
    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.setViewState({ type: VIEW_TYPE_EVOLUTION, active: true });
    this.app.workspace.setActiveLeaf(leaf, { focus: true });
  }

  openSettings(focus: SettingsFocus = null): void {
    // Settings is intentionally not part of Obsidian's public TypeScript surface,
    // but is the stable desktop/mobile host used by community plugins.
    const settingsHost = this.app as App & { setting?: { open: () => void; openTabById: (id: string) => void } };
    settingsHost.setting?.open();
    settingsHost.setting?.openTabById(this.manifest.id);
    if (!focus) return;
    // Set the flag after the pane is on screen, then force one render so the
    // scroll always happens against a visible container.
    window.setTimeout(() => {
      this.pendingFocus = focus;
      this.settingTab?.display();
    }, 80);
  }

  clearPendingFocus(): void {
    this.pendingFocus = null;
  }

  /**
   * 刷新要节流。编辑笔记时 vault 的 modify 和 metadataCache 的 changed 会连着来好几轮，
   * 每轮都整块重绘（还要扫任务文件）就会卡顿；攒 200ms 只刷最后一次，肉眼看不出延迟。
   */
  scheduleRefresh(): void {
    if (this.refreshTimer !== null) window.clearTimeout(this.refreshTimer);
    this.refreshTimer = window.setTimeout(() => {
      this.refreshTimer = null;
      this.refreshOpenViews();
    }, 200);
  }

  refreshOpenViews(): void {
    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_EVOLUTION)) {
      if (leaf.view instanceof EvolutionView) leaf.view.refreshIfVisible();
    }
  }

  /** 当前该用哪一套颜色。返回 null 表示跟随 Obsidian，不做任何覆盖。 */
  themeStyle(): ResolvedTheme | null {
    return resolveTheme(this.settings.theme, this.settings.customTheme, currentThemeMode());
  }

  /** 把主题色挂成 CSS 变量，样式表那边只认变量，不认主题 */
  applyTheme(el: HTMLElement): void {
    applyThemeVars(el, this.themeStyle());
  }
}

class EvolutionView extends ItemView {
  /** 日记卡片当前显示的月份；默认本月，可用左右箭头切换。 */
  private diaryMonth = new Date();
  /** 待办卡片顶部的输入框是否展开；重绘后要按这个状态恢复并重新聚焦。 */
  private taskComposerOpen = false;
  /** 输入框里没保存的内容，重绘时原样放回去，避免被外部刷新打断。 */
  private draft: TaskDraft = { ...EMPTY_DRAFT };
  /** 正在编辑的那条任务（文件路径 + 行号）；null 表示没有在编辑。 */
  private editing: { path: string; line: number } | null = null;
  /** 正在拖动的模块在 layout 里的下标；null 表示当前没在拖。 */
  private dragIndex: number | null = null;
  /** 拖动时算出来的落点：插到 layout 的哪个位置。只能在本列内上下挪，所以不用记列。 */
  private dropTarget: { index: number } | null = null;
  /** 拖动时显示的那条插入线。 */
  private dropLine: HTMLElement | null = null;
  /** 每次重绘领一个号，中途被新的重绘抢了就停手，避免两个 refresh 交错写同一个容器。 */
  private refreshToken = 0;

  constructor(leaf: WorkspaceLeaf, private readonly plugin: EvolutionPlugin) {
    super(leaf);
  }

  getViewType(): string { return VIEW_TYPE_EVOLUTION; }
  getDisplayText(): string { return "主页"; }
  getIcon(): string { return "home"; }

  async onOpen(): Promise<void> {
    this.contentEl.addClass("evolution-dashboard-view");
    await this.refresh();
  }

  /**
   * 看得见才刷。隐藏的标签页（display:none）刷了也看不见，却照样要扫一遍任务文件，
   * 等它重新露面时 active-leaf-change 会再叫一次刷新。
   */
  refreshIfVisible(): void {
    if (this.contentEl.offsetParent === null) return;
    void this.refresh();
  }

  async refresh(): Promise<void> {
    const token = ++this.refreshToken;
    const root = this.contentEl;
    root.empty();
    this.plugin.applyTheme(root);
    const dashboard = root.createDiv({ cls: "evolution-dashboard" });
    // 字号：整块主页的基准字号乘一个系数，卡片里没写死字号的地方都跟着变。
    dashboard.style.setProperty("--evolution-font-scale", String(FONT_SCALES[this.plugin.settings.fontScale]));
    this.renderBanner(dashboard);
    if (this.plugin.settings.slogan.trim()) {
      const sloganEl = dashboard.createDiv({ cls: "evolution-slogan", text: this.plugin.settings.slogan });
      if (this.plugin.settings.sloganColor.trim()) sloganEl.style.color = this.plugin.settings.sloganColor;
    }

    // 布局由设置里的 layout 决定：数组顺序就是从上到下的顺序，每条记录指明放哪一列。
    const items = this.plugin.settings.layout
      .map((entry, index) => ({ entry, index }))
      .filter((item) => this.plugin.isModuleEnabled(item.entry.key));
    if (!items.length) return;
    const grid = dashboard.createDiv({ cls: "evolution-grid" });

    const split = grid.createDiv({ cls: "evolution-split" });
    const leftItems = items.filter((item) => item.entry.column !== "right");
    const rightItems = items.filter((item) => item.entry.column === "right");
    // 空的那列也要建出来但不占宽度，否则拖动时没地方把模块丢过去。
    const left = this.makeColumn(split, "left", !leftItems.length);
    const right = this.makeColumn(split, "right", !rightItems.length);
    if (leftItems.length && rightItems.length) this.makeColumnResizer(split, left, right);
    for (const item of leftItems) {
      await this.renderModule(left, item);
      if (token !== this.refreshToken) return;
    }
    for (const item of rightItems) {
      await this.renderModule(right, item);
      if (token !== this.refreshToken) return;
    }
    if (this.taskComposerOpen || this.editing) this.focusTaskComposer();
  }

  private renderModule(parent: HTMLElement, item: { entry: LayoutEntry; index: number }): Promise<void> | void {
    if (item.entry.key === "diary") return this.renderDiary(parent);
    if (item.entry.key === "shortcuts") return this.renderShortcuts(parent);
    if (item.entry.key === "tasks") return this.renderTasks(parent);
    return this.renderProjects(parent);
  }

  /** 一列模块；宽窄由 flex-grow 决定，拖中间那条竖分隔条改的就是它。 */
  private makeColumn(parent: HTMLElement, side: ColumnSide, empty: boolean): HTMLElement {
    const column = parent.createDiv({ cls: empty ? ["evolution-column", "is-empty"] : "evolution-column", attr: { "data-column": side } });
    column.style.flexGrow = side === "left" ? String(this.plugin.settings.leftWidth) : String(100 - this.plugin.settings.leftWidth);
    this.attachDropZone(column, side);
    return column;
  }

  /** 两列中间那条竖分隔条：左右拖改变左右列宽比，松手才写进设置。 */
  private makeColumnResizer(split: HTMLElement, left: HTMLElement, right: HTMLElement): void {
    const resizer = split.createDiv({ cls: "evolution-resizer", attr: { title: "左右拖动调整列宽", "aria-label": "调整列宽" } });
    // 分隔条要夹在两列中间，直接 append 会跑到右列后面。
    left.insertAdjacentElement("afterend", resizer);
    resizer.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      resizer.setPointerCapture(event.pointerId);
      const width = split.getBoundingClientRect().width || 1;
      const startX = event.clientX;
      const start = this.plugin.settings.leftWidth;
      let next = start;
      const move = (moveEvent: PointerEvent): void => {
        next = Math.min(MAX_LEFT_WIDTH, Math.max(MIN_LEFT_WIDTH, start + ((moveEvent.clientX - startX) / width) * 100));
        left.style.flexGrow = String(next);
        right.style.flexGrow = String(100 - next);
      };
      const finish = (): void => {
        resizer.removeEventListener("pointermove", move);
        resizer.removeEventListener("pointerup", finish);
        resizer.removeEventListener("pointercancel", finish);
        if (Math.abs(next - start) >= 1) void this.plugin.setLeftWidth(Math.round(next));
      };
      resizer.addEventListener("pointermove", move);
      resizer.addEventListener("pointerup", finish);
      resizer.addEventListener("pointercancel", finish);
    });
  }

  /** 重绘会把输入框整个换掉，所以每次都要把光标放回原处。 */
  private focusTaskComposer(): void {
    const scope = this.taskComposerOpen ? ".evolution-task-add " : "";
    const input = this.contentEl.querySelector<HTMLInputElement>(`${scope}.evolution-task-edit__input`);
    if (!input) return;
    input.focus();
    const end = input.value.length;
    input.setSelectionRange(end, end);
  }

  private renderBanner(root: HTMLElement): void {
    const config = this.plugin.settings.banner;
    const banner = root.createDiv({ cls: "evolution-banner" });
    banner.style.minHeight = `${Math.max(120, config.height)}px`;
    banner.style.setProperty("--evolution-banner-dim", `${Math.min(100, Math.max(0, config.dim))}%`);
    const image = this.resolveImage(config.image);
    if (image) banner.style.backgroundImage = `url("${image.replace(/"/g, "\\\"")}")`;
    banner.createDiv({ cls: "evolution-banner__shade" });
    const tools = banner.createDiv({ cls: "evolution-banner__tools" });
    const theme = tools.createEl("button", { cls: "evolution-banner__edit", attr: { "aria-label": "Theme（主题）", title: "Theme（主题）" } });
    setIcon(theme, "palette");
    theme.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.plugin.openSettings("theme");
    });
    const edit = tools.createEl("button", { cls: "evolution-banner__edit", attr: { "aria-label": "Edit banner（编辑横幅）", title: "Edit banner（编辑横幅）" } });
    setIcon(edit, "pencil");
    edit.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.plugin.openSettings("banner");
    });
    const content = banner.createDiv({ cls: "evolution-banner__content" });
    const titleEl = content.createEl("h1", {
      cls: "evolution-banner__title",
      text: config.title || "Evolution",
      attr: { "data-align": config.titleAlign }
    });
    if (config.titleColor.trim()) titleEl.style.color = config.titleColor;
    if (config.description.trim()) {
      const descEl = content.createEl("p", {
        cls: "evolution-banner__description",
        text: config.description,
        attr: { "data-align": config.descriptionAlign }
      });
      if (config.descriptionColor.trim()) descEl.style.color = config.descriptionColor;
    }
  }

  private resolveImage(value: string): string {
    if (!value.trim()) return "";
    if (/^https?:\/\//i.test(value) || value.startsWith("data:")) return value;
    const file = this.app.vault.getAbstractFileByPath(normalizePath(value));
    return file instanceof TFile ? this.app.vault.getResourcePath(file) : "";
  }

  /** 传 null 表示这张卡片不要标题（设置按钮仍保留，浮在右上角）。 */
  private makeCard(root: HTMLElement, title: string | null, focus: SettingsFocus): HTMLElement {
    const isModule = focus !== null && (MODULE_KEYS as string[]).includes(focus);
    // 卡片外面套一层壳：高度、拖底边的手柄、拖动排序都挂在壳上，卡片本身只管内容。
    const shell = root.createDiv({ cls: isModule ? ["evolution-card-shell", `evolution-card-shell--${focus}`] : "evolution-card-shell" });
    const card = shell.createDiv({ cls: isModule ? ["evolution-card", `evolution-card--${focus}`] : "evolution-card" });
    const header = card.createDiv({ cls: title ? "evolution-card__header" : ["evolution-card__header", "evolution-card__header--bare"] });
    if (title) header.createEl("h2", { cls: "evolution-card__title", text: title });
    const settings = header.createEl("button", { cls: "evolution-icon-button", attr: { "aria-label": `Configure ${title ?? focus ?? "module"}` } });
    setIcon(settings, "settings-2");
    settings.addEventListener("click", () => this.plugin.openSettings(focus));
    if (isModule) this.attachCardShell(shell, focus as ModuleKey);
    return card;
  }

  /** 模块卡片才有：固定高度、底边拖高度、按住空白处拖动排序。 */
  private attachCardShell(shell: HTMLElement, key: ModuleKey): void {
    const index = this.plugin.settings.layout.findIndex((item) => item.key === key);
    if (index < 0) return;
    shell.dataset.evolutionModule = key;
    shell.dataset.evolutionIndex = String(index);
    const entry = this.plugin.settings.layout[index];
    if (entry.span === "half") shell.addClass("is-half");
    if (entry.height > 0) {
      shell.style.height = `${entry.height}px`;
      shell.addClass("is-fixed-height");
    }
    this.attachResizeHandle(shell, key);
    this.attachCardDrag(shell, index);
  }

  /** 底边那条小横杠：上下拖改高度，双击恢复跟着内容走。 */
  private attachResizeHandle(shell: HTMLElement, key: ModuleKey): void {
    const handle = shell.createDiv({ cls: "evolution-card-resize", attr: { title: "拖动调整高度，双击恢复自动高度", "aria-label": "调整卡片高度" } });
    handle.addEventListener("dblclick", () => void this.plugin.setLayoutHeight(key, 0));
    handle.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      handle.setPointerCapture(event.pointerId);
      const startY = event.clientY;
      const startHeight = shell.getBoundingClientRect().height;
      let next = startHeight;
      const move = (moveEvent: PointerEvent): void => {
        next = Math.max(MIN_CARD_HEIGHT, startHeight + moveEvent.clientY - startY);
        shell.style.height = `${next}px`;
        shell.addClass("is-fixed-height");
      };
      const finish = (): void => {
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", finish);
        handle.removeEventListener("pointercancel", finish);
        if (Math.abs(next - startHeight) >= 3) void this.plugin.setLayoutHeight(key, next);
      };
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", finish);
      handle.addEventListener("pointercancel", finish);
    });
  }

  /** 按住卡片空白处（控件之外）可以上下拖着换顺序，只在本列内生效。 */
  private attachCardDrag(shell: HTMLElement, index: number): void {
    shell.addEventListener("mousedown", (event) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, button, select, textarea, a, label, .evolution-card-resize")) return;
      shell.draggable = true;
    });
    // 按下去没拖就松手的话，趁早把可拖状态收回来，免得之后划选卡片里的文字被当成拖卡片。
    shell.addEventListener("mouseup", () => { shell.draggable = false; });
    shell.addEventListener("dragstart", (event) => {
      // 卡片里别的东西（链接等）也可能发起拖动，冒泡上来的就不算整块模块在拖。
      if (event.target !== shell) return;
      this.dragIndex = index;
      shell.addClass("is-dragging");
      event.dataTransfer?.setData("text/plain", shell.dataset.evolutionModule ?? "");
      if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
    });
    shell.addEventListener("dragend", () => {
      shell.draggable = false;
      shell.removeClass("is-dragging");
      this.dragIndex = null;
      this.clearDropLine();
    });
  }

  /** 一列是一个放置区：拖过来时显示一条插入线，松手就落到那个位置。
   *  只收本列的模块 —— 换列和改宽窄都在设置里做，主页上不再管左右。 */
  private attachDropZone(zone: HTMLElement, side: ColumnSide): void {
    /** 被拖的那张不在这一列就什么都不做：不 preventDefault，光标会显示"放不下"。 */
    const accepts = (): boolean => {
      if (this.dragIndex === null) return false;
      return this.plugin.settings.layout[this.dragIndex]?.column === side;
    };
    zone.addEventListener("dragover", (event) => {
      if (!accepts()) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
      const shells = Array.from(zone.querySelectorAll<HTMLElement>(".evolution-card-shell"))
        .filter((shell) => shell.dataset.evolutionIndex !== String(this.dragIndex));
      const before = this.resolveDropPosition(shells, event.clientY);
      this.dropTarget = {
        index: before
          ? Number(before.dataset.evolutionIndex)
          : (shells.length ? Number(shells[shells.length - 1].dataset.evolutionIndex) + 1 : this.plugin.settings.layout.length)
      };
      this.showDropLine(zone, before);
    });
    zone.addEventListener("drop", (event) => {
      if (this.dragIndex === null || !this.dropTarget) return;
      event.preventDefault();
      const from = this.dragIndex;
      const to = this.dropTarget.index;
      this.dragIndex = null;
      this.dropTarget = null;
      this.clearDropLine();
      void this.plugin.reorderLayout(from, to);
    });
  }

  /** 算出该插到哪张卡前面。只看纵向位置：鼠标过了某张卡的中线，就落到它后面。 */
  private resolveDropPosition(shells: HTMLElement[], y: number): HTMLElement | null {
    for (const shell of shells) {
      const rect = shell.getBoundingClientRect();
      if (y < rect.top + rect.height / 2) return shell;
    }
    return null;
  }

  private showDropLine(column: HTMLElement, before: HTMLElement | null): void {
    this.clearDropLine();
    const line = column.createDiv({ cls: "evolution-drop-line" });
    if (before) column.insertBefore(line, before);
    this.dropLine = line;
  }

  private clearDropLine(): void {
    this.dropLine?.remove();
    this.dropLine = null;
  }

  private async renderDiary(root: HTMLElement): Promise<void> {
    // 日历本身就是说明，不要再挂一个标题；右上角留设置按钮。
    const card = this.makeCard(root, null, "diary");
    const settings = this.plugin.settings.diary;
    const today = new Date();
    const month = this.diaryMonth;
    if (!this.diaryFolder(month)) {
      card.createEl("p", { cls: "evolution-empty", text: "在设置里填一个日记目录，或启用 Obsidian 核心的「日记」插件，本卡片会自动沿用它的配置。" });
      return;
    }
    const monthNames = ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"];
    const monthBar = card.createDiv({ cls: "evolution-calendar__month" });
    const prev = monthBar.createEl("button", { cls: ["evolution-icon-button", "evolution-calendar__month-btn"], attr: { "aria-label": "上个月", title: "上个月" } });
    setIcon(prev, "chevron-left");
    prev.addEventListener("click", () => {
      this.diaryMonth = new Date(month.getFullYear(), month.getMonth() - 1, 1);
      void this.refresh();
    });
    monthBar.createSpan({ cls: "evolution-calendar__month-label", text: `📅 ${month.getFullYear()}年 ${monthNames[month.getMonth()]}`, attr: { title: this.diaryPath(month) } });
    const next = monthBar.createEl("button", { cls: ["evolution-icon-button", "evolution-calendar__month-btn"], attr: { "aria-label": "下个月", title: "下个月" } });
    setIcon(next, "chevron-right");
    next.addEventListener("click", () => {
      this.diaryMonth = new Date(month.getFullYear(), month.getMonth() + 1, 1);
      void this.refresh();
    });
    const table = card.createEl("table", { cls: "evolution-calendar" });
    const heading = table.createEl("thead").createEl("tr");
    for (const day of ["日", "一", "二", "三", "四", "五", "六"]) heading.createEl("th", { text: day });
    const body = table.createEl("tbody");
    const first = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
    const total = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    let row = body.createEl("tr");
    for (let i = 0; i < first; i++) row.createEl("td");
    for (let day = 1; day <= total; day++) {
      if ((first + day - 1) % 7 === 0 && day !== 1) row = body.createEl("tr");
      const date = new Date(month.getFullYear(), month.getMonth(), day);
      const path = this.diaryPath(date);
      const cell = row.createEl("td");
      const button = cell.createEl("button", { cls: "evolution-calendar__day", text: String(day) });
      if (sameDate(date, today)) button.addClass("evolution-calendar__day--today");
      const file = this.app.vault.getAbstractFileByPath(path);
      if (file instanceof TFile) {
        const status = String(this.app.metadataCache.getFileCache(file)?.frontmatter?.[settings.statusField] ?? "");
        const color = statusColor(status);
        if (color) {
          // 原色直接铺底太重（红绿尤其），压成淡底、字用同色系的深色，看得清也不刺眼。
          const chip = statusChip(color, currentThemeMode());
          button.style.backgroundColor = chip.background;
          button.style.borderColor = chip.edge;
          button.style.color = chip.text;
          button.addClass("evolution-calendar__day--status");
          button.setAttribute("aria-label", `当日状态：${status.trim()}`);
          button.setAttribute("title", `当日状态：${status.trim()}`);
        }
      }
      button.addEventListener("click", () => void this.openOrCreateDiary(path, date));
    }
  }

  private diaryPath(date: Date): string {
    const settings = this.plugin.settings.diary;
    const folder = this.diaryFolder(date);
    const name = formatDate(date, settings.dateFormat.trim() || this.coreOption("format") || "YYYY.MM.DD");
    return normalizePath(folder ? `${folder}/${name}.md` : `${name}.md`);
  }

  private diaryFolder(date: Date): string {
    const settings = this.plugin.settings.diary;
    const base = formatPath(settings.folder.trim() || this.coreFolder(), date);
    const year = formatPath(settings.yearPattern, date);
    return [base, year].map((part) => part.replace(/^\/+|\/+$/g, "")).filter(Boolean).join("/");
  }

  private coreFolder(): string {
    // The core daily-notes plugin stores a folder that already ends in the
    // current year, so drop that segment and let yearPattern rebuild it.
    return String(this.coreOption("folder") ?? "").replace(/\/\d{4}(年)?$/, "");
  }

  private coreOption(key: string): string | null {
    const host = this.app as App & {
      internalPlugins?: {
        getPluginById: (id: string) => { enabled?: boolean; instance?: { options?: Record<string, unknown> } } | null;
      };
    };
    const plugin = host.internalPlugins?.getPluginById("daily-notes");
    if (!plugin?.enabled) return null;
    const value = plugin.instance?.options?.[key];
    return typeof value === "string" && value.trim() ? value : null;
  }

  private async openOrCreateDiary(path: string, date: Date): Promise<void> {
    const current = this.app.vault.getAbstractFileByPath(path);
    if (current instanceof TFile) {
      await this.app.workspace.getLeaf("tab").openFile(current);
      return;
    }
    try {
      const file = await this.ensureDiaryFile(date);
      await this.app.workspace.getLeaf("tab").openFile(file);
    } catch (error) {
      new Notice(`Could not create daily note: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /** 拿到某一天的日记：有就直接返回，没有就按模板新建一份（不打开）。 */
  private async ensureDiaryFile(date: Date): Promise<TFile> {
    const path = this.diaryPath(date);
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) return existing;
    const folder = path.includes("/") ? path.substring(0, path.lastIndexOf("/")) : "";
    if (folder) await ensureFolder(this.app, folder);
    const templatePath = this.plugin.settings.diary.template.trim() || this.coreOption("template") || "";
    const template = templatePath ? this.app.vault.getAbstractFileByPath(normalizePath(templatePath)) : null;
    const content = template instanceof TFile
      ? applyDateTemplate(await this.app.vault.read(template), date)
      : `# ${formatDate(date, this.plugin.settings.diary.dateFormat.trim() || "YYYY.MM.DD")}\n`;
    return await this.app.vault.create(path, content);
  }

  private renderShortcuts(root: HTMLElement): void {
    const card = this.makeCard(root, "Shortcuts（快捷入口）", "shortcuts");
    // 设置里刚加进来、还没填链接的空行不在主页占位置。
    // 但拖动排序要写回原数组，所以每条都带上它在 settings.shortcuts 里的真实下标。
    const entries = this.plugin.settings.shortcuts
      .map((shortcut, index) => ({ shortcut, index }))
      .filter((entry) => entry.shortcut.target.trim());
    if (!entries.length) {
      card.createEl("p", { cls: "evolution-empty", text: "在设置里添加快捷入口，想加几条就加几条。" });
      return;
    }
    const list = card.createDiv({ cls: "evolution-shortcuts" });
    let dragging: number | null = null;

    entries.forEach((entry) => {
      const shortcut = entry.shortcut;
      const index = entry.index;
      const item = list.createDiv({
        cls: "evolution-shortcut",
        attr: { role: "button", tabindex: "0", title: `${shortcut.label || shortcut.target}\n${shortcut.target}\n拖动可调整顺序` }
      });
      item.draggable = true;
      const grip = item.createDiv({ cls: "evolution-shortcut__grip", attr: { "aria-hidden": "true" } });
      setIcon(grip, "grip-vertical");
      const icon = item.createDiv({ cls: "evolution-shortcut__icon" });
      setIcon(icon, autoIcon(shortcut.target));
      // 主页上只显示名称；路径/链接只在鼠标悬停的提示里出现，不再占一行。
      const body = item.createDiv({ cls: "evolution-shortcut__body" });
      body.createDiv({ cls: "evolution-shortcut__label", text: shortcut.label || shortcut.target });

      const activate = (): void => void openShortcutTarget(this.app, shortcut);
      item.addEventListener("click", activate);
      item.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        activate();
      });

      item.addEventListener("dragstart", (event) => {
        dragging = index;
        item.addClass("is-dragging");
        event.dataTransfer?.setData("text/plain", String(index));
        if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
      });
      item.addEventListener("dragend", () => {
        dragging = null;
        item.removeClass("is-dragging");
        clearDropMarks(list);
      });
      item.addEventListener("dragover", (event) => {
        if (dragging === null) return;
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
        const after = isBelowMidpoint(event, item);
        item.toggleClass("is-drop-after", after);
        item.toggleClass("is-drop-before", !after);
      });
      item.addEventListener("dragleave", () => item.removeClass("is-drop-before", "is-drop-after"));
      item.addEventListener("drop", (event) => {
        event.preventDefault();
        if (dragging === null) return;
        const after = isBelowMidpoint(event, item);
        const from = dragging;
        dragging = null;
        clearDropMarks(list);
        void this.plugin.reorderShortcut(from, index + (after ? 1 : 0));
      });
    });

    // 拖动排序的小提示只在设置面板里说，主页不出现——卡片上的 grip 手柄与 title 属性已提示到位。
  }

  private async renderTasks(root: HTMLElement): Promise<void> {
    const card = this.makeCard(root, "Open tasks（待办任务）", "tasks");
    this.renderTaskComposer(card);
    const files = this.filesFor(this.plugin.settings.tasks.folders, this.plugin.settings.tasks.files);
    // 新任务会落到当日日记时，列表也要把当日日记扫一遍，否则刚加的任务看不见。
    const diaryPath = this.diaryPath(new Date());
    if (!this.configuredTaskFile() && !files.some((file) => file.path === diaryPath)) {
      const diary = this.app.vault.getAbstractFileByPath(diaryPath);
      if (diary instanceof TFile) files.push(diary);
    }
    if (!files.length) { card.createEl("p", { cls: "evolution-empty", text: "还没有配置任务来源，上面添加的任务会写进当日日记。" }); return; }
    // 来源目录常常上千篇，先把没有待办项的笔记筛掉再读全文。
    const sources = files.filter((file) => this.mayHaveOpenTasks(file));
    const tasks = (await Promise.all(sources.map((file) => this.tasksInFile(file)))).flat();
    if (!tasks.length) { card.createEl("p", { cls: "evolution-empty", text: "暂无未完成任务。" }); return; }
    // 到期日是有意义的：有日期的排前面、日子近的在前；没有日期的保持来源笔记的顺序跟在后面。
    const withDue = tasks.filter((task) => task.due).sort((a, b) => a.due.localeCompare(b.due));
    const ordered = [...withDue, ...tasks.filter((task) => !task.due)];
    const list = card.createDiv({ cls: "evolution-list evolution-list--tasks" });
    for (const task of ordered.slice(0, 30)) {
      // 正在编辑的这条就地换成输入框，其余照常显示。
      if (this.editing && this.editing.path === task.file.path && this.editing.line === task.line) {
        this.renderTaskFields(list, this.draft, (draft) => void this.updateTask(task.file, task.line, draft, task.raw), () => this.closeEditor());
        continue;
      }
      const item = list.createDiv({ cls: "evolution-task" });
      const checkbox = item.createEl("input", { type: "checkbox", attr: { "aria-label": task.text } });
      checkbox.addEventListener("change", () => void this.completeTask(task.file, task.line, task.raw));
      const body = item.createDiv({ cls: "evolution-task__body" });
      body.createDiv({ cls: "evolution-task__title", text: task.text, attr: { title: task.raw } });
      this.renderTaskBadges(body, task);

      const tools = item.createDiv({ cls: "evolution-task__tools" });
      const edit = tools.createEl("button", { cls: "evolution-open", attr: { "aria-label": "Edit task（修改任务）", title: "修改任务" } });
      setIcon(edit, "pencil");
      edit.addEventListener("click", () => {
        this.editing = { path: task.file.path, line: task.line };
        this.draft = { text: task.text, due: task.due, priority: task.priority };
        void this.refresh();
      });
      const open = tools.createEl("button", { cls: "evolution-open", attr: { "aria-label": "Open task note" } });
      setIcon(open, "external-link");
      open.addEventListener("click", () => void this.app.workspace.getLeaf("tab").openFile(task.file));
    }
  }

  /** 截止时间和优先级做成小徽章，不再把原始表情符号堆在正文里。 */
  private renderTaskBadges(body: HTMLElement, task: TaskItem): void {
    if (!task.due && !task.priority && !task.done && !task.repeat && !task.scheduled && !task.start) return;
    const row = body.createDiv({ cls: "evolution-task__badges" });
    if (task.priority) {
      row.createSpan({ cls: "evolution-task__badge evolution-task__badge--priority", text: PRIORITY_LABEL[task.priority] });
    }
    if (task.due) {
      const today = todayIso();
      const overdue = task.due < today;
      const cls = ["evolution-task__badge", "evolution-task__badge--due"];
      if (overdue) cls.push("is-overdue");
      else if (task.due === today) cls.push("is-today");
      row.createSpan({ cls: cls.join(" "), text: overdue ? `${task.due} 已过期` : task.due });
    }
    if (task.start) row.createSpan({ cls: "evolution-task__badge", text: `开始 ${task.start}` });
    if (task.scheduled) row.createSpan({ cls: "evolution-task__badge", text: `计划 ${task.scheduled}` });
    if (task.repeat) row.createSpan({ cls: "evolution-task__badge", text: `🔁 ${task.repeat.trim()}` });
    if (task.done) row.createSpan({ cls: "evolution-task__badge", text: `上次完成 ${task.done}` });
  }

  /**
   * 先看缓存里有没有未勾选的任务项，没有就别读全文了。
   * 任务来源常常是整个目录（上千篇），每篇都 vault.read 一遍是主页卡顿的主因；
   * 刚改过几秒内的文件缓存可能还没跟上，这类一律照读，免得新加的任务不显示。
   */
  private mayHaveOpenTasks(file: TFile): boolean {
    if (Date.now() - file.stat.mtime < 5000) return true;
    const cache = this.app.metadataCache.getFileCache(file);
    if (!cache) return true;
    return (cache.listItems ?? []).some((item) => item.task !== undefined && item.task.trim() === "");
  }

  private async tasksInFile(file: TFile): Promise<TaskItem[]> {
    const content = await this.app.vault.read(file);
    return content.split(/\r?\n/).flatMap((line, index) => {
      const match = line.match(/^\s*(?:[-*+]\s+)\[ \]\s+(.+)$/);
      return match ? [{ file, line: index, ...parseTaskLine(match[1]) }] : [];
    });
  }

  /** 卡片顶部的「添加任务」：收起时是一行按钮，点开就地输入，回车即写进笔记。 */
  private renderTaskComposer(card: HTMLElement): void {
    const bar = card.createDiv({ cls: "evolution-task-add" });
    const hint = this.taskTargetHint();

    if (!this.taskComposerOpen) {
      const trigger = bar.createEl("button", { cls: "evolution-task-add__trigger", attr: { title: hint } });
      const icon = trigger.createSpan({ cls: "evolution-task-add__icon", attr: { "aria-hidden": "true" } });
      setIcon(icon, "plus");
      trigger.createSpan({ text: "添加任务" });
      trigger.addEventListener("click", () => {
        this.taskComposerOpen = true;
        void this.refresh();
      });
      return;
    }

    this.renderTaskFields(bar, this.draft, (draft) => {
      this.taskComposerOpen = false;
      this.draft = { ...EMPTY_DRAFT };
      void this.addTask(draft);
    }, () => {
      this.taskComposerOpen = false;
      this.draft = { ...EMPTY_DRAFT };
      void this.refresh();
    });

    bar.createDiv({ cls: "evolution-task-add__hint", text: hint });
  }

  /** 新增和编辑共用的一行输入：正文 + 截止日期 + 优先级，后两项可选。 */
  private renderTaskFields(container: HTMLElement, draft: TaskDraft, onSave: (draft: TaskDraft) => void, onCancel: () => void): void {
    const form = container.createDiv({ cls: "evolution-task-edit" });
    const input = form.createEl("input", { type: "text", cls: "evolution-task-edit__input", placeholder: "写一条任务，回车保存", attr: { "aria-label": "任务内容" } });
    input.value = draft.text;
    const due = form.createEl("input", { type: "date", cls: "evolution-task-edit__due", attr: { "aria-label": "截止时间（可选）", title: "截止时间（可选）" } });
    due.value = draft.due;
    const priority = form.createEl("select", { cls: "evolution-task-edit__priority", attr: { "aria-label": "优先级（可选）", title: "优先级（可选）" } });
    priority.createEl("option", { value: "", text: "优先级" });
    PRIORITY_ORDER.forEach((key) => priority.createEl("option", { value: key, text: PRIORITY_LABEL[key] }));
    priority.value = draft.priority;

    const save = (): void => {
      const text = input.value.trim();
      if (!text) { onCancel(); return; }
      onSave({ text, due: due.value, priority: (priority.value || "") as TaskPriority | "" });
    };
    const confirm = form.createEl("button", { cls: "evolution-task-add__confirm", attr: { "aria-label": "保存任务", title: "保存（Enter）" } });
    setIcon(confirm, "check");
    const cancel = form.createEl("button", { cls: "evolution-icon-button", attr: { "aria-label": "取消", title: "取消（Esc）" } });
    setIcon(cancel, "x");

    confirm.addEventListener("click", save);
    cancel.addEventListener("click", onCancel);
    form.addEventListener("keydown", (event) => {
      if (event.key === "Enter") { event.preventDefault(); save(); }
      else if (event.key === "Escape") { event.preventDefault(); onCancel(); }
    });
  }

  private closeEditor(): void {
    this.editing = null;
    this.draft = { ...EMPTY_DRAFT };
    void this.refresh();
  }

  /** 设置里填的第一条「任务笔记」；没填返回空串，表示新任务要落到当日日记。 */
  private configuredTaskFile(): string {
    return this.plugin.settings.tasks.files.map((item) => item.trim()).find(Boolean) ?? "";
  }

  /** 新任务落到哪里：先看设置里的「任务笔记」第一条，没有就写当日日记。 */
  private async resolveTaskFile(): Promise<TFile> {
    const configured = this.configuredTaskFile();
    if (configured) {
      const raw = normalizePath(configured);
      // 允许省略 .md：先按填的原样找，找不到再补上后缀找一遍。
      const candidates = /\.md$/i.test(raw) ? [raw] : [raw, `${raw}.md`];
      for (const candidate of candidates) {
        const existing = this.app.vault.getAbstractFileByPath(candidate);
        if (existing instanceof TFile) return existing;
      }
      const path = candidates[candidates.length - 1];
      const folder = path.includes("/") ? path.substring(0, path.lastIndexOf("/")) : "";
      if (folder) await ensureFolder(this.app, folder);
      return await this.app.vault.create(path, `# ${path.split("/").pop()?.replace(/\.md$/i, "") ?? "Tasks"}\n`);
    }
    return await this.ensureDiaryFile(new Date());
  }

  private taskTargetHint(): string {
    const configured = this.configuredTaskFile();
    if (configured) return `新任务保存路径：${configured}`;
    return `新任务保存路径：${this.diaryPath(new Date())}`;
  }

  private async addTask(draft: TaskDraft): Promise<void> {
    try {
      const target = await this.resolveTaskFile();
      await this.appendLine(target, buildTaskLine(draft));
      new Notice(`已添加到 ${target.path}`);
    } catch (error) {
      // 写失败就把内容放回输入框，别让用户白打一遍。
      this.taskComposerOpen = true;
      this.draft = draft;
      new Notice(`添加失败：${error instanceof Error ? error.message : String(error)}`);
      void this.refresh();
    }
  }

  /**
   * 改的是原始笔记里那一行：整行替换，截止时间/优先级一起写回去。
   * 不直接信行号 —— 扫描之后笔记可能在别处被增删过行，先用行号对一遍内容，
   * 对不上再按内容找，都找不到就放弃改写，免得把别的行覆盖掉。
   */
  private async updateTask(file: TFile, line: number, draft: TaskDraft, original: string): Promise<void> {
    this.editing = null;
    this.draft = { ...EMPTY_DRAFT };
    try {
      await this.app.vault.process(file, (content) => {
        const lines = content.split(/\r?\n/);
        const target = locateTaskLine(lines, line, original);
        if (target < 0) throw new Error("笔记里找不到这条任务，可能被别处改动过");
        // 行尾 Tasks 自己的元数据（重复、id 等）主页不碰，原样带回去。
        lines[target] = buildTaskLine(draft, keepTaskMeta(original));
        return lines.join(detectNewline(content));
      });
      new Notice(`已更新 ${file.path}`);
    } catch (error) {
      // 内容别丢：搬回顶部的添加框，用户可以直接再存一次。
      this.taskComposerOpen = true;
      this.draft = draft;
      new Notice(`修改失败：${error instanceof Error ? error.message : String(error)}`);
      void this.refresh();
    }
  }

  /** 往笔记末尾追加一行，顺便保证结尾只有一个换行。 */
  private async appendLine(file: TFile, line: string): Promise<void> {
    await this.app.vault.process(file, (content) => {
      const newline = detectNewline(content);
      const body = content.replace(/\s+$/, "");
      return body ? `${body}${newline}${line}${newline}` : `${line}${newline}`;
    });
  }

  private async completeTask(file: TFile, line: number, original: string): Promise<void> {
    try {
      await this.app.vault.process(file, (content) => {
        const lines = content.split(/\r?\n/);
        const target = locateTaskLine(lines, line, original);
        if (target < 0) return content;
        // 数字列表（1. [ ]）也算，只把方括号里的空格换成 x。
        let next = lines[target].replace(/^(\s*(?:[-*+]|\d+[.)])\s+\[) (\])/, "$1x$2");
        // 补一条 ✅ 完成日期（可在设置里关掉）。重复任务行上本来就有一个，那就更新它。
        if (this.plugin.shouldWriteDoneDate()) {
          const today = todayIso();
          next = /✅\s*\d{4}-\d{2}-\d{2}/.test(next)
            ? next.replace(/✅\s*\d{4}-\d{2}-\d{2}/, `✅ ${today}`)
            : `${next.replace(/\s+$/, "")} ✅ ${today}`;
        }
        lines[target] = next;
        return lines.join(detectNewline(content));
      });
    } catch (error) {
      new Notice(`勾选失败：${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private renderProjects(root: HTMLElement): void {
    const card = this.makeCard(root, "Active notes（活跃笔记）", "projects");
    const config = this.plugin.settings.projects;
    const source = config.folders.length ? this.filesFor(config.folders, []) : this.app.vault.getMarkdownFiles();
    const files = source.filter((file) => matchesTags(this.app, file, config.tags));
    if (!files.length) { card.createEl("p", { cls: "evolution-empty", text: "Choose active-note tags or folders in Evolution settings." }); return; }
    const list = card.createDiv({ cls: "evolution-list" });
    files.sort((a, b) => b.stat.mtime - a.stat.mtime).slice(0, config.limit).forEach((file) => {
      const item = list.createDiv({ cls: "evolution-note" });
      const body = item.createDiv({ cls: "evolution-note__body" });
      body.createDiv({ cls: "evolution-note__title", text: file.basename });
      body.createDiv({ cls: "evolution-note__meta", text: file.path });
      item.addEventListener("click", () => void this.app.workspace.getLeaf("tab").openFile(file));
    });
  }

  private filesFor(folders: string[], files: string[]): TFile[] {
    const folderPaths = folders.map(normalizePath).filter(Boolean);
    const filePaths = new Set(files.map(normalizePath).filter(Boolean));
    return this.app.vault.getMarkdownFiles().filter((file) => filePaths.has(file.path) || folderPaths.some((folder) => file.path.startsWith(`${folder}/`)));
  }
}

class EvolutionSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: EvolutionPlugin) { super(app, plugin); }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    const focus = this.plugin.pendingFocus;
    if (focus) {
      this.plugin.clearPendingFocus();
      this.renderFocused(focus);
      return;
    }
    containerEl.createEl("h2", { text: "Evolution homepage" });
    containerEl.createEl("p", { text: "Every path is vault-relative. Settings never include files from the dashboard author’s vault." });
    this.themeSettings(containerEl);
    this.fontSettings(containerEl);
    this.layoutSettings(containerEl);
    this.bannerSettings(containerEl);
    this.diarySettings(containerEl);
    this.taskSettings(containerEl);
    this.projectSettings(containerEl);
    this.shortcutSettings(containerEl);
  }

  private renderFocused(focus: SettingsFocus): void {
    const back = this.containerEl.createEl("button", { cls: "evolution-settings__back", text: "← 返回全部设置" });
    back.addEventListener("click", () => this.display());
    this.containerEl.createEl("p", { cls: "evolution-settings__back-hint", text: "只显示当前模块的配置。点「返回全部设置」可查看所有模块。" });
    if (focus === "theme") this.themeSettings(this.containerEl);
    else if (focus === "banner") this.bannerSettings(this.containerEl);
    else if (focus === "diary") this.diarySettings(this.containerEl);
    else if (focus === "tasks") this.taskSettings(this.containerEl);
    else if (focus === "projects") this.projectSettings(this.containerEl);
    else if (focus === "shortcuts") this.shortcutSettings(this.containerEl);
  }

  private themeSettings(root: HTMLElement): void {
    root.createEl("h3", { cls: "evolution-settings-anchor--theme", text: "Theme（主题）" });
    root.createEl("p", { text: "配色取自 obsidian-color-boost 的四套预设。主题只改主页自己的文字、描边和模块强调色，底色保持中性不染色；库里其它笔记界面一概不动。" });

    // 色卡 + 一张迷你卡片，选之前就能看到实际效果。用的是主页同一套 class，预览即所得。
    const preview = root.createDiv({ cls: "evolution-theme-preview" });
    const renderPreview = (): void => {
      preview.empty();
      const style = this.plugin.themeStyle();
      applyThemeVars(preview, style);
      if (!style) {
        preview.createDiv({ cls: "evolution-theme-preview__hint", text: "跟随 Obsidian 主题：主页沿用你当前 Obsidian 主题自身的颜色，不做任何覆盖。" });
        return;
      }
      const strip = preview.createDiv({ cls: "evolution-theme-preview__strip" });
      themeSwatch(strip, "正文", style.text);
      themeSwatch(strip, "标题", style.heading);
      themeSwatch(strip, "强调", style.accent);
      themeSwatch(strip, "边框", style.border);
      themeSwatch(strip, "日记", style.modules.diary);
      themeSwatch(strip, "快捷入口", style.modules.shortcuts);
      themeSwatch(strip, "待办", style.modules.tasks);
      themeSwatch(strip, "活跃笔记", style.modules.projects);

      const demo = preview.createDiv({ cls: ["evolution-card", "evolution-card--diary"] });
      const header = demo.createDiv({ cls: "evolution-card__header" });
      header.createEl("h2", { cls: "evolution-card__title", text: "Diary（日记）" });
      const body = demo.createDiv({ cls: "evolution-theme-preview__body" });
      body.createDiv({ text: "这是今天的日记示例文字。" });
      body.createDiv({ cls: "evolution-theme-preview__meta", text: "记录 / 2026.09.14" });
    };

    const note = root.createDiv({ cls: "evolution-settings__note" });
    const renderNote = (): void => {
      note.setText(themeNote(this.plugin.settings.theme));
    };

    const custom = root.createDiv({ cls: "evolution-theme-custom" });
    const renderCustom = (): void => {
      custom.empty();
      if (this.plugin.settings.theme !== "custom") return;
      const config = this.plugin.settings.customTheme;
      const pick = (name: string, desc: string, value: string, apply: (next: string) => void): void => {
        customColorSetting(custom, name, desc, value, async (next) => {
          apply(next);
          await this.plugin.saveSettings();
          renderPreview();
        });
      };
      pick("正文文字", "清单项与日历数字的颜色。", config.text, (v) => { config.text = v; });
      pick("卡片标题", "各卡片标题的兜底颜色，模块色没设时用它。", config.heading, (v) => { config.heading = v; });
      pick("强调色", "悬浮边框、今天高亮、图标兜底色。", config.accent, (v) => { config.accent = v; });
      pick("日记模块", "日历的月份标题与今天高亮。", config.modules.diary, (v) => { config.modules.diary = v; });
      pick("快捷入口模块", "入口左侧的图标颜色。", config.modules.shortcuts, (v) => { config.modules.shortcuts = v; });
      pick("待办模块", "任务复选框的颜色。", config.modules.tasks, (v) => { config.modules.tasks = v; });
      pick("活跃笔记模块", "活跃笔记卡片的标题颜色。", config.modules.projects, (v) => { config.modules.projects = v; });
    };

    new Setting(root)
      .setName("主题")
      .setDesc("选一套预设会立刻作用到主页。四套色值都来自 obsidian-color-boost；切到深色模式时亮度会自动提上来，不用手改。")
      .addDropdown((dd) => {
        dd.addOption("auto", "跟随 Obsidian 主题");
        for (const [id, preset] of Object.entries(THEME_PRESETS)) dd.addOption(id, preset.label);
        dd.addOption("custom", "🎨 自定义");
        dd.setValue(this.plugin.settings.theme);
        dd.onChange(async (value) => {
          this.plugin.settings.theme = value as ThemeId;
          await this.plugin.saveSettings();
          renderPreview();
          renderNote();
          renderCustom();
        });
      });

    renderPreview();
    renderNote();
    renderCustom();
  }

  private fontSettings(root: HTMLElement): void {
    root.createEl("h3", { cls: "evolution-settings-anchor--font", text: "Font size（字号）" });
    dropdownSetting(root, "整体字号", "主页所有文字统一缩放一档。默认「小」，比 Obsidian 正文字号小一号；觉得紧就调回「标准」或「大」。",
      this.plugin.settings.fontScale, FONT_SCALE_LABEL, async (value) => {
        this.plugin.settings.fontScale = value as FontScaleId;
        await this.plugin.saveSettings();
      });
  }

  private bannerSettings(root: HTMLElement): void {
    root.createEl("h3", { cls: "evolution-settings-anchor--banner", text: "Banner and slogan（横幅与标语）" });
    textSetting(root, "Banner image", "库内相对路径或 https 链接。不想手写路径，用下面的「添加图片」直接从本地上传。", this.plugin.settings.banner.image, async (value) => { this.plugin.settings.banner.image = value; await this.plugin.saveSettings(); });
    new Setting(root).setName("添加图片").setDesc("从本地选择一张图片，上传后保存在库根目录。").addButton((btn) => btn.setButtonText("选择并上传").onClick(() => void this.uploadBannerImage()));
    textSetting(root, "Banner title", "Main heading shown over the banner.", this.plugin.settings.banner.title, async (value) => { this.plugin.settings.banner.title = value; await this.plugin.saveSettings(); });
    alignSetting(root, "Title alignment（标题位置）", "标题靠左、居中还是靠右。", this.plugin.settings.banner.titleAlign, async (value) => { this.plugin.settings.banner.titleAlign = value; await this.plugin.saveSettings(); });
    colorSetting(root, "Title color（标题颜色）", "横幅标题文字颜色，留空用白色。", this.plugin.settings.banner.titleColor, async (value) => { this.plugin.settings.banner.titleColor = value; await this.plugin.saveSettings(); });
    textSetting(root, "Banner description", "Short introduction shown under the title.", this.plugin.settings.banner.description, async (value) => { this.plugin.settings.banner.description = value; await this.plugin.saveSettings(); });
    alignSetting(root, "Description alignment（描述位置）", "描述文字靠左、居中还是靠右，和标题分开设置。", this.plugin.settings.banner.descriptionAlign, async (value) => { this.plugin.settings.banner.descriptionAlign = value; await this.plugin.saveSettings(); });
    colorSetting(root, "Description color（描述颜色）", "描述文字颜色，留空用白色。", this.plugin.settings.banner.descriptionColor, async (value) => { this.plugin.settings.banner.descriptionColor = value; await this.plugin.saveSettings(); });
    textSetting(root, "Slogan", "A separate text-only line below the banner.", this.plugin.settings.slogan, async (value) => { this.plugin.settings.slogan = value; await this.plugin.saveSettings(); });
    colorSetting(root, "Slogan color（标语颜色）", "标语文字颜色，留空跟随主题灰。", this.plugin.settings.sloganColor, async (value) => { this.plugin.settings.sloganColor = value; await this.plugin.saveSettings(); });
  }

  /** 模块布局：每个模块放左列还是右列，以及从上到下的顺序。 */
  private layoutSettings(root: HTMLElement): void {
    root.createEl("h3", { cls: "evolution-settings-anchor--layout", text: "Layout（模块布局）" });
    root.createEl("p", { cls: "evolution-settings__note", text: "主页上能直接动手的只有两件事：按住卡片空白处上下拖动换顺序（只在同一列里挪），拖卡片底边的小横杠改高度（双击横杠恢复自动高度）。换列、改宽窄都在这一页做。" });
    root.createEl("p", { cls: "evolution-settings__note", text: "每个模块都能放左列或右列，用 ↑ / ↓ 调整上下顺序。顺序是整条列表通用的：同列内按这个顺序从上往下排。" });
    root.createEl("p", { cls: "evolution-settings__note", text: "「半宽」的模块两两并排：同一列里两条半宽就横着放一起，落单的那条自己占满整行。想在右列横放两个模块，把那两个都切成半宽就行。左右怎么摆只在设置里改，主页上的拖拽只管上下顺序。" });
    root.createEl("p", { cls: "evolution-settings__note", text: "关掉的模块（在下面各自的小节里关）会灰着显示，不会出现在主页。某一列一个模块都没分到时，另一列自动占满整行。" });

    textSetting(root, "Left column width", `左右两列的宽度比，左列占百分之多少，${MIN_LEFT_WIDTH} 到 ${MAX_LEFT_WIDTH}。主页上拖两列中间那条竖条也能改。`, String(this.plugin.settings.leftWidth), async (value) => {
      this.plugin.settings.leftWidth = clampNumber(value, MIN_LEFT_WIDTH, MAX_LEFT_WIDTH, 42);
      await this.plugin.saveSettings();
    });

    const editor = root.createDiv({ cls: "evolution-layout-editor" });
    const rerender = (): void => {
      editor.empty();
      this.plugin.settings.layout.forEach((entry, index) => this.renderLayoutRow(editor, entry, index, rerender));
    };
    rerender();
  }

  private renderLayoutRow(root: HTMLElement, entry: LayoutEntry, index: number, rerender: () => void): void {
    const row = root.createDiv({ cls: "evolution-layout-editor__row" });
    const enabled = this.plugin.isModuleEnabled(entry.key);
    if (!enabled) row.addClass("is-off");
    const name = row.createDiv({ cls: "evolution-layout-editor__name" });
    name.createSpan({ text: MODULE_LABEL[entry.key] });
    if (!enabled) name.createSpan({ cls: "evolution-layout-editor__off", text: "已关闭" });

    const sides = row.createDiv({ cls: "evolution-layout-editor__sides" });
    ([["left", "左列"], ["right", "右列"]] as Array<[ColumnSide, string]>).forEach(([side, label]) => {
      const button = sides.createEl("button", {
        cls: entry.column === side ? "evolution-layout-editor__side is-active" : "evolution-layout-editor__side",
        text: label,
        attr: { "aria-label": `把${MODULE_LABEL[entry.key]}放到${label}`, title: `放到${label}` }
      });
      button.addEventListener("click", () => void this.plugin.setLayoutColumn(index, side).then(rerender));
    });

    const tools = row.createDiv({ cls: "evolution-layout-editor__tools" });
    const spanButton = tools.createEl("button", {
      cls: entry.span === "half" ? "evolution-layout-editor__span is-half" : "evolution-layout-editor__span",
      text: SPAN_LABEL[entry.span],
      attr: {
        "aria-label": "模块宽度",
        title: entry.span === "half" ? "当前半宽：同一列里两条半宽会并排，点一下改回整行" : "当前整行：点一下改半宽，同列两条半宽会并排"
      }
    });
    spanButton.addEventListener("click", () => void this.plugin.setLayoutSpan(entry.key, entry.span === "half" ? "full" : "half").then(rerender));
    const heightButton = tools.createEl("button", {
      cls: "evolution-layout-editor__height",
      text: entry.height > 0 ? `${entry.height}px` : "自适应",
      attr: { "aria-label": "卡片高度", title: entry.height > 0 ? "点一下恢复自动高度" : "当前跟着内容走，可以在主页拖卡片底边改" }
    });
    if (entry.height <= 0) heightButton.disabled = true;
    heightButton.addEventListener("click", () => void this.plugin.setLayoutHeight(entry.key, 0).then(rerender));
    iconTool(tools, "arrow-up", "上移", index === 0, () => void this.plugin.moveLayoutEntry(index, -1).then(rerender));
    iconTool(tools, "arrow-down", "下移", index === this.plugin.settings.layout.length - 1, () => void this.plugin.moveLayoutEntry(index, 1).then(rerender));
  }

  private async uploadBannerImage(): Promise<void> {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const data = await file.arrayBuffer();
      const path = normalizePath(file.name);
      try {
        if (!this.app.vault.getAbstractFileByPath(path)) await this.app.vault.createBinary(path, data);
        this.plugin.settings.banner.image = path;
        await this.plugin.saveSettings();
        this.plugin.pendingFocus = "banner";
        this.display();
        new Notice(`图片已保存到库根目录：${path}`);
      } catch (error) {
        new Notice(`上传失败：${error instanceof Error ? error.message : String(error)}`);
      }
    };
    input.click();
  }

  private diarySettings(root: HTMLElement): void {
    root.createEl("h3", { cls: "evolution-settings-anchor--diary", text: "Diary（日记）" });
    textSetting(root, "日记根目录", "年份目录之上的那一层，可用 {YYYY} {MM} {DD}。留空则沿用核心「日记」插件的目录。", this.plugin.settings.diary.folder, async (value) => { this.plugin.settings.diary.folder = value; await this.plugin.saveSettings(); });
    textSetting(root, "年份子目录", "追加在根目录之后的一层，默认 {YYYY}年。留空表示不分年份。", this.plugin.settings.diary.yearPattern, async (value) => { this.plugin.settings.diary.yearPattern = value; await this.plugin.saveSettings(); });
    textSetting(root, "日记模板", "留空则沿用核心「日记」插件的模板，支持 {{date:YYYY.MM.DD}} 等变量。", this.plugin.settings.diary.template, async (value) => { this.plugin.settings.diary.template = value; await this.plugin.saveSettings(); });
    textSetting(root, "文件名格式", "支持 YYYY、MM、DD。留空沿用核心「日记」插件的格式。", this.plugin.settings.diary.dateFormat, async (value) => { this.plugin.settings.diary.dateFormat = value; await this.plugin.saveSettings(); });
    textSetting(root, "Status field", "Frontmatter field used for calendar colors: 红灯/🔴→红, 黄灯/🟡→黄, 绿灯/🟢→绿, 或直接填 #rrggbb 色值。", this.plugin.settings.diary.statusField, async (value) => { this.plugin.settings.diary.statusField = value; await this.plugin.saveSettings(); });
  }

  private taskSettings(root: HTMLElement): void {
    root.createEl("h3", { cls: "evolution-settings-anchor--tasks", text: "Open tasks（待办任务）" });
    root.createEl("p", { cls: "evolution-settings__note", text: "主页待办卡片顶部可以直接添加任务：写一行字回车即可，不用先打开笔记。截止时间和优先级是可选输入，填了会按 Tasks 插件的格式写进同一行，例如「- [ ] 交周报 ⏫ 📅 2026-09-20」。" });
    root.createEl("p", { cls: "evolution-settings__note", text: "每条任务右侧有铅笔按钮，点开就地改内容、截止时间、优先级，回车后直接改写原笔记里那一行；已过期的截止日期会标红。" });
    dropdownSetting(root, "完成日期（✅）", "在主页勾选完成时，要不要在行尾补一条 ✅ YYYY-MM-DD。主页自己认这个符号（会显示成「上次完成」徽章），所以不装 Tasks 插件也照样有意义；装了 Tasks 的话它那边也统计得到。",
      this.plugin.settings.tasks.doneDate, DONE_DATE_LABEL, async (value) => {
        this.plugin.settings.tasks.doneDate = value as DoneDateMode;
        await this.plugin.saveSettings();
      });
    textSetting(root, "Task folders", "Comma-separated folders. Tasks in every descendant note are included.", this.plugin.settings.tasks.folders.join(", "), async (value) => { this.plugin.settings.tasks.folders = splitPaths(value); await this.plugin.saveSettings(); });
    textSetting(root, "Task notes", "Comma-separated individual task note paths. 新任务会保存到这里的第一条笔记（文件不存在时自动新建）；整栏留空时，新任务改写到当日日记，日记不存在就新建当天日记。", this.plugin.settings.tasks.files.join(", "), async (value) => { this.plugin.settings.tasks.files = splitPaths(value); await this.plugin.saveSettings(); });
  }

  private projectSettings(root: HTMLElement): void {
    root.createEl("h3", { cls: "evolution-settings-anchor--projects", text: "Active notes（活跃笔记）" });
    textSetting(root, "Note folders", "Comma-separated folders; leave blank to search the whole vault.", this.plugin.settings.projects.folders.join(", "), async (value) => { this.plugin.settings.projects.folders = splitPaths(value); await this.plugin.saveSettings(); });
    textSetting(root, "Required tags", "多个标签用英文逗号「,」分隔，例如“项目,关注,daily”——任一标签命中即匹配（OR 关系，不需要全中）。带不带前导 # 都行，前后空格自动忽略。嵌套子标签直接写「项目/关注」。标签需与笔记里实际写的完全一致，比如笔记里写 #AI，这里也写 AI，写 ai 不会命中。", this.plugin.settings.projects.tags.join(", "), async (value) => { this.plugin.settings.projects.tags = splitPaths(value); await this.plugin.saveSettings(); });
    textSetting(root, "Maximum notes", "How many recently updated notes to display.", String(this.plugin.settings.projects.limit), async (value) => { this.plugin.settings.projects.limit = clampNumber(value, 1, 50, 12); await this.plugin.saveSettings(); });
  }

  private shortcutSettings(root: HTMLElement): void {
    root.createEl("h3", { cls: "evolution-settings-anchor--shortcuts", text: "Shortcuts（快捷入口）" });
    root.createEl("p", { text: "每条入口只填两项：「名称」是主页上显示的字，「链接」是要打开的东西。加几条就有几条，主页会按顺序往下排。" });
    root.createEl("p", { cls: "evolution-settings__note", text: "链接可以填网页地址（https://…）、库内笔记路径（例如 工作/项目/周复盘.md）、或本地文件的 file:/// 链接与绝对路径。不用选类型，点开时自动判断。" });
    root.createEl("p", { cls: "evolution-settings__note", text: "按住任意一条入口上下拖动，可以调整主页上从上到下的顺序。每条右上角有 ↑ / ↓ 按钮，做不到拖动时也能用。" });

    const editor = root.createDiv({ cls: "evolution-shortcuts-editor" });
    const rerender = (): void => {
      editor.empty();
      const list = this.plugin.settings.shortcuts;
      if (!list.length) editor.createEl("p", { cls: "evolution-empty", text: "还没有入口，点下面的按钮加一条。" });
      list.forEach((shortcut, index) => this.shortcutRow(editor, shortcut, index, rerender));
      const footer = editor.createDiv({ cls: "evolution-shortcuts-editor__footer" });
      const add = footer.createEl("button", { cls: "mod-cta", text: "+ 添加快捷入口" });
      add.addEventListener("click", () => {
        void this.plugin.addShortcut().then(() => {
          rerender();
          const rows = editor.querySelectorAll<HTMLElement>(".evolution-shortcuts-editor__row");
          rows[rows.length - 1]?.querySelector<HTMLInputElement>("input")?.focus();
        });
      });
    };
    rerender();
  }

  private shortcutRow(root: HTMLElement, shortcut: Shortcut, index: number, rerender: () => void): void {
    const row = root.createDiv({ cls: "evolution-shortcuts-editor__row" });
    const head = row.createDiv({ cls: "evolution-shortcuts-editor__head" });
    head.createSpan({ cls: "evolution-shortcuts-editor__index", text: `入口 ${index + 1}` });
    const tools = head.createDiv({ cls: "evolution-shortcuts-editor__tools" });
    const total = this.plugin.settings.shortcuts.length;
    iconTool(tools, "arrow-up", "上移", index === 0, () => void this.plugin.reorderShortcut(index, index - 1).then(rerender));
    iconTool(tools, "arrow-down", "下移", index === total - 1, () => void this.plugin.reorderShortcut(index, index + 2).then(rerender));
    iconTool(tools, "external-link", "测试打开", false, () => void openShortcutTarget(this.app, this.plugin.settings.shortcuts[index]));
    iconTool(tools, "trash-2", "删除这条", false, () => void this.plugin.removeShortcut(index).then(rerender));

    // 打字时只改内存，停手 400ms 再落盘，避免每敲一个字就重刷主页。
    const persist = debounce(() => void this.plugin.saveSettings(), 400);

    const nameField = row.createDiv({ cls: "evolution-shortcuts-editor__field" });
    nameField.createSpan({ cls: "evolution-shortcuts-editor__field-label", text: "名称" });
    const nameInput = nameField.createEl("input", { type: "text", cls: "evolution-shortcuts-editor__input" });
    nameInput.placeholder = "例如：运动周报";
    nameInput.value = shortcut.label;
    nameInput.addEventListener("input", () => {
      shortcut.label = nameInput.value;
      persist();
    });

    const linkField = row.createDiv({ cls: "evolution-shortcuts-editor__field" });
    linkField.createSpan({ cls: "evolution-shortcuts-editor__field-label", text: "链接" });
    const linkInput = linkField.createEl("input", { type: "text", cls: "evolution-shortcuts-editor__input" });
    linkInput.placeholder = "https://… 或 库内笔记路径 或 file:///…/x.html";
    linkInput.value = shortcut.target;
    linkInput.addEventListener("input", () => {
      shortcut.target = linkInput.value;
      persist();
    });
  }
}

function textSetting(root: HTMLElement, name: string, desc: string, value: string, update: (value: string) => Promise<void>): void {
  new Setting(root).setName(name).setDesc(desc).addText((input) => input.setValue(value).onChange(async (next) => { await update(next); }));
}

function iconTool(root: HTMLElement, icon: string, label: string, disabled: boolean, onClick: () => void): void {
  const button = root.createEl("button", {
    cls: "evolution-icon-button evolution-shortcuts-editor__tool",
    attr: { "aria-label": label, title: label }
  });
  setIcon(button, icon);
  if (disabled) {
    button.disabled = true;
    button.addClass("is-disabled");
    return;
  }
  button.addEventListener("click", onClick);
}

function debounce(run: () => void, wait: number): () => void {
  let timer: number | null = null;
  return () => {
    if (timer !== null) window.clearTimeout(timer);
    timer = window.setTimeout(() => { timer = null; run(); }, wait);
  };
}

function isBelowMidpoint(event: DragEvent, item: HTMLElement): boolean {
  const rect = item.getBoundingClientRect();
  return event.clientY > rect.top + rect.height / 2;
}

function clearDropMarks(list: HTMLElement): void {
  list.querySelectorAll<HTMLElement>(".evolution-shortcut").forEach((el) => el.removeClass("is-dragging", "is-drop-before", "is-drop-after"));
}

interface ResolvedTheme {
  text: string;
  /** 次要文字。不从正文混出来，而是按主色色相单独生成一支灰 */
  muted: string;
  heading: string;
  accent: string;
  /** 描边。底色一律保持中性，主题色主要靠文字和这条描边体现 */
  border: string;
  tint: string;
  modules: Record<ModuleKey, string>;
}

/**
 * 四套预设的原始色值，一支不改地从 obsidian-color-boost 搬过来：
 * 深蓝之海 / 逐光之海 / 柔和粉色 / 全色彩虹。
 * 明暗适配统一在 resolveTheme 里做，这里只保管原色，方便日后照 skill 更新。
 */
const THEME_PRESETS: Record<Exclude<ThemeId, "auto" | "custom">, { label: string; note: string; palette: ThemePalette }> = {
  "deep-sea": {
    label: "🌊 深蓝之海",
    note: "深海暗流，从幽暗到海面微光",
    palette: {
      heading: "#0B2545",
      text: "#13315C",
      accent: "#134074",
      tint: "#134074",
      modules: { diary: "#13366C", shortcuts: "#3D6A8C", tasks: "#0F2C53", projects: "#6589A8" }
    }
  },
  sunlit: {
    label: "🌅 逐光之海",
    note: "阳光穿透海水，暖橘到深蓝",
    palette: {
      heading: "#9B2226",
      text: "#001219",
      accent: "#CA6702",
      tint: "#BB3E03",
      modules: { diary: "#0A9396", shortcuts: "#CA6702", tasks: "#9B2226", projects: "#005F73" }
    }
  },
  blossom: {
    label: "🌸 柔和粉色",
    note: "玫瑰与藕荷的粉彩，温润安静不刺眼",
    // 这套原色刻意拉开明暗（深玫红 → 亮粉 → 藕荷紫），映射之后才留得住层次；
    // 早先那版四支都是极淡的粉蓝，压进亮度带后齐平成一个色，看着就跟别的主题没差别。
    palette: {
      heading: "#A8486E",
      text: "#4A3440",
      accent: "#E07FA6",
      tint: "#F2A0BE",
      saturation: 58,
      modules: { diary: "#D9739C", shortcuts: "#E58BB0", tasks: "#C05F8E", projects: "#B07BC8" }
    }
  },
  rainbow: {
    label: "🌈 全色彩虹",
    note: "高饱和彩虹，红橙黄绿蓝紫",
    palette: {
      heading: "#FF6B6B",
      text: "#748FFC",
      accent: "#4DABF7",
      tint: "#DA77F2",
      saturation: 86,
      modules: { diary: "#38D9A9", shortcuts: "#FFA94D", tasks: "#FF6B6B", projects: "#748FFC" }
    }
  }
};

const THEME_VARS = [
  "--ev-text", "--ev-heading", "--ev-accent", "--ev-muted", "--ev-border",
  "--ev-module-diary", "--ev-module-shortcuts", "--ev-module-tasks", "--ev-module-projects"
];

function currentThemeMode(): "light" | "dark" {
  return document.body.classList.contains("theme-dark") ? "dark" : "light";
}

/**
 * 把主题解析成最终色值。
 * 关键一步是「保序映射」：先把整套色板的亮度区间整体压进一条合适的带子里。
 * 如果只做上下裁剪，深蓝之海这类单色主题在深色模式下会几支色一起顶到上限、糊成一片；
 * 按原始亮度的比例映射，就能保住彼此的高低关系，浅色深色两套都还有层次。
 */
function resolveTheme(theme: ThemeId, custom: CustomTheme, mode: "light" | "dark"): ResolvedTheme | null {
  if (theme === "auto") return null;
  const palette: ThemePalette = theme === "custom"
    ? { text: custom.text, heading: custom.heading, accent: custom.accent, tint: custom.accent, modules: { ...custom.modules } }
    : THEME_PRESETS[theme].palette;

  const entries: Array<[string, string]> = [
    ["text", palette.text],
    ["heading", palette.heading],
    ["accent", palette.accent],
    ...MODULE_KEYS.map((key) => [`module:${key}`, palette.modules[key]] as [string, string])
  ];
  const lightness = entries.map(([, hex]) => toHsl(hex)?.l ?? 50);
  const low = Math.min(...lightness);
  const high = Math.max(...lightness);
  const saturationCap = palette.saturation ?? (mode === "light" ? 54 : 72);
  const band = mode === "light" ? [16, 44] : [66, 92];
  const resolved = new Map<string, string>();

  entries.forEach(([key, hex]) => {
    const hsl = toHsl(hex);
    if (!hsl) { resolved.set(key, hex); return; }
    const ratio = high - low < 3 ? 0.5 : (hsl.l - low) / (high - low);
    const level = clampLevel(key, band[0] + ratio * (band[1] - band[0]), mode);
    const color = fromHsl(hsl.h, Math.min(hsl.s, saturationCap), level);
    resolved.set(key, ensureContrast(color, mode));
  });

  return {
    text: resolved.get("text") ?? palette.text,
    muted: ensureContrast(mutedFor(palette.tint, mode), mode),
    heading: resolved.get("heading") ?? palette.heading,
    accent: resolved.get("accent") ?? palette.accent,
    border: borderFor(palette.tint, palette, mode),
    tint: palette.tint,
    modules: {
      diary: resolved.get("module:diary") ?? palette.modules.diary,
      shortcuts: resolved.get("module:shortcuts") ?? palette.modules.shortcuts,
      tasks: resolved.get("module:tasks") ?? palette.modules.tasks,
      projects: resolved.get("module:projects") ?? palette.modules.projects
    }
  };
}

/**
 * 感知对比度兜底。
 * HSL 的亮度不是感知亮度——同样是 40% 亮度，青色和琥珀色看着比深蓝亮得多，
 * 所以逐色映射之后，琥珀/青这几支仍可能偏浅。
 * 这里按 WCAG 相对亮度再收一道：不够就把亮度一格一格挪走，直到达标为止。
 * 浅色模式的对手是最亮背景（纯白），深色模式取略亮于纯黑的底，两边都留余量。
 */
function ensureContrast(hex: string, mode: "light" | "dark", target = 4.5): string {
  const background = mode === "light" ? "#ffffff" : "#262629";
  const backgroundLum = relativeLuminance(background);
  const hsl = toHsl(hex);
  if (!hsl) return hex;
  let current = hex;
  for (let step = 0; step < 60; step += 1) {
    if (contrastRatio(current, backgroundLum) >= target) return current;
    const level = hsl.l + (mode === "light" ? -1 : 1) * (step + 1);
    if (level <= 3 || level >= 97) return current;
    current = fromHsl(hsl.h, hsl.s, level);
  }
  return current;
}

function relativeLuminance(hex: string): number {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return 0;
  const value = parseInt(match[1], 16);
  const channel = (raw: number): number => {
    const c = raw / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel((value >> 16) & 255) + 0.7152 * channel((value >> 8) & 255) + 0.0722 * channel(value & 255);
}

function contrastRatio(hex: string, backgroundLum: number): number {
  const [high, low] = [relativeLuminance(hex), backgroundLum].sort((a, b) => b - a);
  return (high + 0.05) / (low + 0.05);
}

/**
 * 次要文字单独生成，不从正文色跟背景混。
 * 混色的问题在于正文越亮、混出来的次要色就越没有对比度余量（彩虹那套尤其明显），
 * 小字会虚。直接按主色色相取一支低饱和的灰，两种模式下对比度都稳得住。
 */
function mutedFor(tint: string, mode: "light" | "dark"): string {
  const hue = toHsl(tint)?.h ?? 220;
  return mode === "light" ? fromHsl(hue, 22, 45) : fromHsl(hue, 16, 68);
}

/**
 * 描边单独取一支：只借主色的色相与饱和度，亮度靠二分反解。
 * 不照搬原色亮度——深海是 #134074、粉彩是 #FAD2E1，照搬过来深色模式下前者直接看不见。
 * 反解的目标是让四套预设的描边分量一致：色相不同，同样亮度的人眼亮度差很多，
 * 玫红和橘色摆一起，橘色会明显更浅。所以这里按「对比度落在多少」来定亮度，而不是按数值亮度。
 */
function borderFor(tint: string, palette: ThemePalette, mode: "light" | "dark"): string {
  const hsl = toHsl(tint);
  if (!hsl) return tint;
  const backgroundLum = relativeLuminance(mode === "light" ? "#ffffff" : "#262629");
  const target = mode === "light" ? 3.4 : 4.4;
  const saturation = Math.min(hsl.s, palette.saturation ?? 46);
  let low = 0;
  let high = 100;
  let current = fromHsl(hsl.h, saturation, mode === "light" ? 56 : 58);
  for (let step = 0; step < 18; step += 1) {
    const level = (low + high) / 2;
    current = fromHsl(hsl.h, saturation, level);
    const ratio = contrastRatio(current, backgroundLum);
    if (Math.abs(ratio - target) < 0.04) return current;
    // 浅色模式下越亮越贴背景（对比度往下走），深色模式正好相反
    const needBrighter = mode === "light" ? ratio > target : ratio < target;
    if (needBrighter) low = level; else high = level;
  }
  return current;
}

/** 亮度带再按角色收一道口：正文要比标题更实，强调色可以留点亮 */
function clampLevel(key: string, level: number, mode: "light" | "dark"): number {
  // module 这条带子放宽过：原先是 [16,40]，几个模块色一旦挤到上限就成了同一个深浅，
  // 只剩下色相不同，整套主题的层次就没了。
  const bounds: Record<string, [number, number]> = mode === "light"
    ? { text: [12, 36], heading: [14, 42], accent: [16, 44], module: [18, 50] }
    : { text: [82, 98], heading: [78, 96], accent: [70, 94], module: [64, 90] };
  const role = key.startsWith("module:") ? "module" : key;
  const [min, max] = bounds[role];
  return Math.max(min, Math.min(max, level));
}

function toHsl(hex: string): { h: number; s: number; l: number } | null {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  const value = parseInt(match[1], 16);
  const r = ((value >> 16) & 255) / 255;
  const g = ((value >> 8) & 255) / 255;
  const b = (value & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const span = max - min;
  if (span === 0) return { h: 0, s: 0, l: l * 100 };
  const s = l > 0.5 ? span / (2 - max - min) : span / (max + min);
  const h = max === r ? (g - b) / span + (g < b ? 6 : 0) : max === g ? (b - r) / span + 2 : (r - g) / span + 4;
  return { h: h * 60, s: s * 100, l: l * 100 };
}

function fromHsl(h: number, s: number, l: number): string {
  const sat = Math.max(0, Math.min(100, s)) / 100;
  const light = Math.max(0, Math.min(100, l)) / 100;
  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = light - c / 2;
  const rgb: [number, number, number] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const channel = (v: number): string => Math.round((v + m) * 255).toString(16).padStart(2, "0");
  return `#${channel(rgb[0])}${channel(rgb[1])}${channel(rgb[2])}`;
}

/**
 * 把主题挂成 CSS 变量。
 * 底色不参与染色：卡片底、软底一律回落到 Obsidian 自己的中性背景，
 * 染过的底在明暗模式之间容易发浑，也容易和库里其它界面打架。
 * 所以这里只挂文字、强调色、描边和四个模块色。
 */
function applyThemeVars(el: HTMLElement, theme: ResolvedTheme | null): void {
  for (const name of THEME_VARS) el.style.removeProperty(name);
  el.toggleClass("is-themed", theme !== null);
  if (!theme) return;
  el.style.setProperty("--ev-text", theme.text);
  el.style.setProperty("--ev-muted", theme.muted);
  el.style.setProperty("--ev-heading", theme.heading);
  el.style.setProperty("--ev-accent", theme.accent);
  el.style.setProperty("--ev-border", theme.border);
  for (const key of MODULE_KEYS) el.style.setProperty(`--ev-module-${key}`, theme.modules[key]);
}

function themeNote(id: ThemeId): string {
  if (id === "auto") return "主页跟着 Obsidian 主题走，不覆盖任何颜色。";
  if (id === "custom") return "逐支指定颜色，改完立刻生效。";
  return `${THEME_PRESETS[id].note}。`;
}

function themeSwatch(parent: HTMLElement, label: string, color: string): void {
  const item = parent.createDiv({ cls: "evolution-theme-swatch" });
  item.createDiv({ cls: "evolution-theme-swatch__dot" }).style.background = color;
  item.createDiv({ cls: "evolution-theme-swatch__label", text: label });
}

function customColorSetting(root: HTMLElement, name: string, desc: string, value: string, update: (value: string) => Promise<void>): void {
  new Setting(root).setName(name).setDesc(desc).addColorPicker((picker) => picker.setValue(value).onChange(async (next) => { await update(next); }));
}

const COLOR_PRESETS: Record<string, string> = {
  "跟随主题": "",
  "红 #ff4d4d": "#ff4d4d",
  "橙 #f5a623": "#f5a623",
  "金 #d4af37": "#d4af37",
  "绿 #2ecc71": "#2ecc71",
  "蓝 #4a90d9": "#4a90d9",
  "紫 #8e6bc9": "#8e6bc9",
  "黑 #1a1a1a": "#1a1a1a",
  "白 #ffffff": "#ffffff"
};
function colorSetting(root: HTMLElement, name: string, desc: string, value: string, update: (value: string) => Promise<void>): void {
  new Setting(root).setName(name).setDesc(desc).addDropdown((dd) => {
    for (const [label, hex] of Object.entries(COLOR_PRESETS)) dd.addOption(hex, label);
    dd.setValue(value);
    dd.onChange(async (next) => { await update(next); });
  });
}

/** 位置三选一：靠左 / 居中 / 靠右。 */
/** 通用下拉：选项就是 labels 的键，显示文案是它的值。 */
function dropdownSetting<K extends string>(root: HTMLElement, name: string, desc: string, value: K, labels: Record<K, string>, update: (value: K) => Promise<void>): void {
  new Setting(root).setName(name).setDesc(desc).addDropdown((dd) => {
    for (const key of Object.keys(labels) as K[]) dd.addOption(key, labels[key]);
    dd.setValue(value);
    dd.onChange(async (next) => { await update(next as K); });
  });
}

function alignSetting(root: HTMLElement, name: string, desc: string, value: BannerAlign, update: (value: BannerAlign) => Promise<void>): void {
  new Setting(root).setName(name).setDesc(desc).addDropdown((dd) => {
    for (const align of BANNER_ALIGNS) dd.addOption(align, ALIGN_LABEL[align]);
    dd.setValue(value);
    dd.onChange(async (next) => { await update(normalizeAlign(next)); });
  });
}

/** Tasks 插件装没装：只看插件清单，不调用它的任何接口，所以它在不在都不影响主页。 */
function tasksPluginEnabled(app: App): boolean {
  const host = app as App & { plugins?: { plugins?: Record<string, { enabled?: boolean } | undefined> } };
  return !!host.plugins?.plugins?.["obsidian-tasks-plugin"]?.enabled;
}

function splitPaths(value: string): string[] { return value.split(",").map((item) => item.trim()).filter(Boolean); }
function clampNumber(value: string, min: number, max: number, fallback: number): number { const parsed = Number(value); return Number.isFinite(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback; }
function sameDate(a: Date, b: Date): boolean { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }

// 日历红绿灯：当日状态命中关键词即着色；直接填 #rrggbb 色值也支持。
const STATUS_COLORS: Array<[string, string]> = [
  ["红", "#ff4d4d"],
  ["🔴", "#ff4d4d"],
  ["黄", "#f5a623"],
  ["🟡", "#f5a623"],
  ["绿", "#2ecc71"],
  ["🟢", "#2ecc71"]
];
function statusColor(status: string): string {
  const value = status.trim();
  if (!value) return "";
  if (/^#[0-9a-f]{3,8}$/i.test(value)) return value;
  for (const [keyword, color] of STATUS_COLORS) if (value.includes(keyword)) return color;
  return "";
}
/**
 * 日历格子的配色：状态色原样铺底太重，红配黑字尤其脏。
 * 这里保留色相、只压浓度 —— 底色往背景方向混到两成多，字用同色系的深/浅色，
 * 另给一条同色描边，淡底才立得住。浅色深色两套各混各的底色。
 */
function statusChip(color: string, mode: "light" | "dark"): { background: string; edge: string; text: string } {
  const base = color.trim();
  return mode === "light"
    ? {
        background: `color-mix(in srgb, ${base} 20%, white)`,
        edge: `color-mix(in srgb, ${base} 45%, white)`,
        text: `color-mix(in srgb, ${base} 70%, #141414)`
      }
    : {
        background: `color-mix(in srgb, ${base} 26%, #262629)`,
        edge: `color-mix(in srgb, ${base} 52%, #262629)`,
        text: `color-mix(in srgb, ${base} 58%, white)`
      };
}

function pad(value: number): string { return String(value).padStart(2, "0"); }
function formatDate(date: Date, pattern: string): string { return pattern.replaceAll("YYYY", String(date.getFullYear())).replaceAll("MM", pad(date.getMonth() + 1)).replaceAll("DD", pad(date.getDate())); }
function formatPath(pattern: string, date: Date): string {
  return pattern
    .replaceAll("{YYYY}", String(date.getFullYear()))
    .replaceAll("{YY}", String(date.getFullYear()).slice(-2))
    .replaceAll("{MM}", pad(date.getMonth() + 1))
    .replaceAll("{DD}", pad(date.getDate()));
}
function momentLib(): ((input?: Date | string) => { format: (pattern: string) => string }) | null {
  const candidate = (window as unknown as { moment?: (input?: Date | string) => { format: (pattern: string) => string } }).moment;
  return typeof candidate === "function" ? candidate : null;
}
function formatWithMoment(date: Date, pattern: string): string {
  const lib = momentLib();
  return lib ? lib(date).format(pattern) : formatDate(date, pattern);
}
function applyDateTemplate(content: string, date: Date): string {
  return content
    .replace(/\{\{date:([^}]+)\}\}/g, (_, pattern: string) => formatWithMoment(date, pattern))
    .replaceAll("{{date}}", formatWithMoment(date, "YYYY-MM-DD"));
}
/** 把旧版数据（带 icon / kind 字段）统一成只有名字和链接的形状 */
/** 今天的 YYYY-MM-DD，按本地时区算，用来判断截止日是否过期。 */
function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** 把笔记里的一行任务文本拆成正文明文 + 截止时间 + 优先级。 */
function parseTaskLine(rest: string): { raw: string; text: string; due: string; priority: TaskPriority | ""; done: string; repeat: string; scheduled: string; start: string } {
  const raw = rest.trim();
  let priority: TaskPriority | "" = "";
  for (const key of PRIORITY_ORDER) {
    if (raw.includes(PRIORITY_EMOJI[key])) { priority = key; break; }
  }
  const dueMatch = raw.match(/📅\s*(\d{4}-\d{2}-\d{2})/);
  const due = dueMatch ? dueMatch[1] : "";
  // Tasks 写在行尾的其它元数据：完成日期、重复规则、计划/开始日期、任务 id。
  // 前四个做成徽章，id 那串字符没意义，直接丢掉。
  const done = raw.match(/✅\s*(\d{4}-\d{2}-\d{2})/)?.[1] ?? "";
  const repeat = raw.match(/🔁\s*([^📅⏫🔼🔽🔺✅🆔⏳🛫]*)/)?.[1] ?? "";
  const scheduled = raw.match(/⏳\s*(\d{4}-\d{2}-\d{2})/)?.[1] ?? "";
  const start = raw.match(/🛫\s*(\d{4}-\d{2}-\d{2})/)?.[1] ?? "";
  const text = raw
    .replace(/📅\s*\d{4}-\d{2}-\d{2}/g, " ")
    .replace(/✅\s*\d{4}-\d{2}-\d{2}/g, " ")
    .replace(/🔁[^📅⏫🔼🔽🔺✅🆔⏳🛫]*/g, " ")
    .replace(/⏳\s*\d{4}-\d{2}-\d{2}/g, " ")
    .replace(/🛫\s*\d{4}-\d{2}-\d{2}/g, " ")
    .replace(/🆔\s*[A-Za-z0-9]+/g, " ")
    .replace(/[🔺⏫🔼🔽]️?/g, " ")
    .replace(/\[due::[^\]]*\]/gi, " ")
    .replace(/\[priority::[^\]]*\]/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  return { raw, text: text || raw, due, priority, done, repeat, scheduled, start };
}

/**
 * Tasks 写在行尾、但主页不编辑的那些元数据：重复规则、任务 id、计划/开始日期、上次完成日期。
 * 编辑任务时整行会被重写，这些必须原样挂回行尾 —— 少了 🔁 和 🆔，Tasks 就不再把它当重复任务了。
 */
const TASK_META_RE = /(🆔\s*[A-Za-z0-9]+|🔁[^📅⏫🔼🔽🔺✅🆔⏳🛫]*|⏳\s*\d{4}-\d{2}-\d{2}|🛫\s*\d{4}-\d{2}-\d{2}|✅\s*\d{4}-\d{2}-\d{2})/gu;

function keepTaskMeta(raw: string): string {
  return (raw.match(TASK_META_RE) ?? []).map((part) => part.trim()).filter(Boolean).join(" ");
}

/** 把输入框里的三项拼成真正的 Markdown 任务行，用 Tasks 插件的表情符号格式。 */
function buildTaskLine(draft: TaskDraft, keep = ""): string {
  const parts = [draft.text.trim()];
  if (draft.priority) parts.push(PRIORITY_EMOJI[draft.priority]);
  if (draft.due) parts.push(`📅 ${draft.due}`);
  if (keep.trim()) parts.push(keep.trim());
  return `- [ ] ${parts.join(" ")}`;
}

const TASK_LINE_RE = /^\s*(?:[-*+]|\d+[.)])\s+\[[ xX]\]\s+/;

/** 文件原来用什么换行，写回时就用什么，别顺手把 CRLF 全改成 LF。 */
function detectNewline(content: string): string {
  return content.includes("\r\n") ? "\r\n" : "\n";
}

/**
 * 找任务在文件里的行号。行号是扫描时记下的，这中间笔记可能在别处被增删过行，
 * 所以先用行号核对内容，对不上再按内容全文找一遍，都找不到返回 -1（宁可不改，也别改错行）。
 */
function locateTaskLine(lines: string[], line: number, original: string): number {
  if (!original) return -1;
  if (lines[line] !== undefined && lines[line].includes(original)) return line;
  return lines.findIndex((text) => text.includes(original) && TASK_LINE_RE.test(text));
}

function normalizeShortcut(value: Partial<Shortcut> | null | undefined): Shortcut | null {
  if (!value) return null;
  const label = String(value.label ?? "").trim();
  const target = String(value.target ?? "").trim();
  if (!label && !target) return null;
  const name = label || target;
  const link = target || label;
  return { id: value.id || `${name}::${link}`, label: name, target: link };
}

/** 图标按链接形态自动给一个，不再需要手选 */
function autoIcon(target: string): string {
  const value = target.trim();
  if (!value) return "arrow-up-right";
  if (isHttpUrl(value)) return "globe";
  if (isFileUrl(value) || isAbsolutePath(value)) return /\.html?($|[?#])/i.test(value) ? "monitor" : "file";
  return "file-text";
}

function isFileUrl(value: string): boolean { return /^file:\/\//i.test(value.trim()); }
function isAbsolutePath(value: string): boolean { const text = value.trim(); return /^[a-zA-Z]:[\\/]/.test(text) || text.startsWith("\\\\") || text.startsWith("/"); }
function isHttpUrl(value: string): boolean { return /^https?:\/\//i.test(value.trim()); }

/** 把 file:// URL 或绝对路径还原成本地绝对路径（去掉百分号转义） */
function toLocalPath(value: string): string {
  let text = value.trim();
  if (isFileUrl(text)) {
    text = text.replace(/^file:\/\//i, "");
    text = text.replace(/^localhost\//i, "");
    // file:///E:/x → E:/x（Windows 盘符前的斜杠要去掉）
    if (/^\/[a-zA-Z]:/.test(text)) text = text.slice(1);
  }
  try { text = decodeURIComponent(text); } catch { /* 路径里含裸 % 就保留原样 */ }
  return text.replace(/\\/g, "/").replace(/\/+$/, "");
}

/** 本地绝对路径落在库内时，转成库内相对路径；库外返回 null */
function toVaultRelative(basePath: string, localPath: string): string | null {
  const abs = localPath.replace(/\\/g, "/").replace(/\/+$/, "");
  const base = basePath.replace(/\\/g, "/").replace(/\/+$/, "");
  if (!base) return null;
  if (abs.toLowerCase() === base.toLowerCase()) return "";
  if (abs.toLowerCase().startsWith(base.toLowerCase() + "/")) return abs.slice(base.length + 1);
  return null;
}

/** 本地绝对路径 → file:// URL（含中文与空格的安全编码） */
function pathToFileUrl(localPath: string): string {
  const normalized = localPath.replace(/\\/g, "/");
  const prefixed = /^[a-zA-Z]:/.test(normalized) ? `/${normalized}` : normalized;
  return "file://" + prefixed.split("/").map((segment) => encodeURIComponent(segment).replace(/%3A/gi, ":")).join("/");
}

function vaultBasePath(app: App): string {
  const adapter = app.vault.adapter as unknown as { getBasePath?: () => string };
  try { return typeof adapter.getBasePath === "function" ? adapter.getBasePath() : ""; } catch { return ""; }
}

function electronShell(): { openPath?: (path: string) => Promise<string>; openExternal?: (url: string) => Promise<void> } | null {
  const runtime = window as unknown as { require?: (id: string) => unknown };
  if (typeof runtime.require !== "function") return null;
  try {
    const electron = runtime.require("electron") as { shell?: unknown; remote?: { shell?: unknown } };
    const shell = (electron?.shell ?? electron?.remote?.shell) as { openPath?: (path: string) => Promise<string>; openExternal?: (url: string) => Promise<void> } | undefined;
    return shell ?? null;
  } catch { return null; }
}

function openExternalUrl(url: string): void {
  const shell = electronShell();
  if (shell?.openExternal) { void shell.openExternal(url).catch(() => window.open(url, "_blank", "noopener")); return; }
  window.open(url, "_blank", "noopener");
}

/**
 * 交给系统默认程序打开本地文件。
 * 顺序：Obsidian 自带通道（库内文件最稳）→ Electron shell.openPath → shell.openExternal(file://)
 */
async function openLocalBySystem(app: App, vaultPath: string | null, localPath: string): Promise<boolean> {
  if (vaultPath) {
    const withOpener = app as App & { openWithDefaultApp?: (path: string) => Promise<void> };
    if (typeof withOpener.openWithDefaultApp === "function") {
      try { await withOpener.openWithDefaultApp(vaultPath); return true; } catch { /* 换下一条路 */ }
    }
    const adapter = app.vault.adapter as unknown as { getFullPath?: (path: string) => string };
    if (typeof adapter.getFullPath === "function") localPath = adapter.getFullPath(vaultPath);
  }
  const shell = electronShell();
  if (shell?.openPath) {
    try { const failure = await shell.openPath(localPath); if (!failure) return true; } catch { /* 换下一条路 */ }
  }
  if (shell?.openExternal) {
    try { await shell.openExternal(pathToFileUrl(localPath)); return true; } catch { /* 换下一条路 */ }
  }
  return false;
}

/**
 * 快捷入口的统一打开逻辑。只用链接本身判断类型，不需要用户选：
 * 网页地址 → 浏览器；file:// 或绝对路径 → 库内文件走 Obsidian、库外交系统；其余当库内笔记。
 */
async function openShortcutTarget(app: App, shortcut: Shortcut): Promise<void> {
  const target = shortcut.target.trim();
  if (!target) return;

  // 1) 外部网页
  if (isHttpUrl(target) || /^mailto:/i.test(target)) { openExternalUrl(target); return; }

  // 2) 本地文件（file:// 链接或绝对路径）
  if (isFileUrl(target) || isAbsolutePath(target)) {
    const localPath = toLocalPath(target);
    const base = vaultBasePath(app);
    const relative = base ? toVaultRelative(base, localPath) : null;

    if (relative) {
      const file = app.vault.getAbstractFileByPath(normalizePath(relative));
      if (file instanceof TFile) {
        // Markdown / 白板用 Obsidian 自己的视图打开，HTML 等交给系统默认程序
        if (file.extension === "md" || file.extension === "canvas") await app.workspace.getLeaf("tab").openFile(file);
        else if (!(await openLocalBySystem(app, file.path, localPath))) new Notice(`打不开文件：${relative}`);
        return;
      }
      new Notice(`库内找不到文件：${relative}`);
      return;
    }

    if (await openLocalBySystem(app, null, localPath)) return;
    new Notice(`打不开本地文件：${localPath}`);
    return;
  }

  // 3) 库内笔记（允许省略 .md）
  for (const candidate of [target, `${target}.md`]) {
    const file = app.vault.getAbstractFileByPath(normalizePath(candidate));
    if (file instanceof TFile) { await app.workspace.getLeaf("tab").openFile(file); return; }
  }
  new Notice(`找不到文件：${target}`);
}
async function ensureFolder(app: App, folder: string): Promise<void> {
  const parts = normalizePath(folder).split("/").filter(Boolean);
  let current = "";
  for (const part of parts) {
    current = current ? `${current}/${part}` : part;
    if (!app.vault.getAbstractFileByPath(current)) await app.vault.createFolder(current);
  }
}
function matchesTags(app: App, file: TFile, desired: string[]): boolean {
  if (!desired.length) return true;
  const cache = app.metadataCache.getFileCache(file);
  const inline = cache?.tags?.map((tag) => tag.tag.replace(/^#/, "")) ?? [];
  const frontmatter = cache?.frontmatter?.tags;
  const yaml = Array.isArray(frontmatter) ? frontmatter.map(String) : typeof frontmatter === "string" ? [frontmatter] : [];
  const tags = new Set([...inline, ...yaml].map((tag) => tag.replace(/^#/, "")));
  return desired.some((tag) => tags.has(tag.replace(/^#/, "")));
}
