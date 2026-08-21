"use client";

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from "react";

export type Language = "en" | "zh";

const LANGUAGE_STORAGE_KEY = "kart-data-language";

/**
 * Simplified Chinese follows the convention already set by USER_GUIDE.zh-CN.md: the structural
 * nouns of the data model — Event, Session, Run, Setup, Marker, Track, Layout — and product
 * names such as Track Library stay in English, with Chinese prose around them. That is how the
 * owner writes about the app, and inventing Chinese equivalents would not match how he or the
 * karting paddock actually talk.
 *
 * Keys are the English source strings, so an untranslated string falls back to readable
 * English rather than a missing-key placeholder. `{name}` placeholders are filled from params.
 */
const zh: Record<string, string> = {
  // Shell, navigation and top bar
  "Trackside recorder": "赛道现场记录",
  Back: "返回",
  "Switch light or dark mode": "切换浅色或深色模式",
  "Switch to Chinese": "切换到中文",
  "Switch to English": "切换到英文",
  "Data and settings": "数据与设置",
  "Data & settings": "数据与设置",
  "Stored on this device": "仅保存在本设备",
  "Loading Kart Data…": "正在载入 Kart Data…",
  "Record not found": "找不到记录",
  "It may have been deleted. Return home to continue.": "该记录可能已被删除。返回首页继续。",

  // Home
  "Ready for the next run?": "准备下一个 Run？",
  "Start your first event": "建立你的第一个 Event",
  "Resume the active event or start a new one.": "继续当前 Event，或新建一个。",
  "Create an event, add a session, then record each run.": "建立 Event，添加 Session，然后记录每个 Run。",
  "Track not set": "未填写赛道",
  "Axle not set": "未填写后轴",
  "Sprocket not set": "未填写齿盘",
  "This browser does not support location access. Enter the temperature manually.": "此浏览器不支持定位。请手动填写温度。",
  "Finding your current location…": "正在获取当前位置…",
  "Reading the current local temperature…": "正在读取当前气温…",
  "Uses your device location. You can still enter a value manually.": "使用设备定位。你也可以手动填写。",
  "Getting temperature…": "正在获取温度…",
  "Updated from your current location at {time}.": "已于 {time} 根据当前位置更新。",
  "EDIT EVENT": "编辑 EVENT",
  "NEW EVENT": "新建 EVENT",
  "COMPLETED RUN": "已完成的 RUN",
  "CURRENT RUN": "当前 RUN",
  "Trackside entry": "赛道现场录入",
  "Active event": "当前 Event",
  "Resume recording": "继续记录",
  Sessions: "Sessions",
  Runs: "Runs",
  Track: "赛道",
  "No events yet": "还没有 Event",
  "Your records stay on this device and work without an account.": "记录保存在本设备，无需账号即可使用。",
  "New event": "新建 Event",
  "Track tools": "赛道工具",
  "Track Library": "Track Library",
  "Map corners, braking points and reference notes": "在赛道图上记录弯角、刹车点和参考笔记",
  "Recent events": "最近的 Events",
  "View all": "查看全部",
  "All events": "全部 Events",
  New: "新建",
  "No events": "没有 Event",
  "Create an event to begin recording.": "先建立一个 Event 才能开始记录。",

  // Event screen
  "EVENT CONDITIONS": "EVENT 条件",
  Ambient: "环境温度",
  Surface: "路面",
  "Add session": "新增 Session",
  "No sessions yet": "还没有 Session",
  "Add the first practice, qualifying, heat or final session.": "建立第一个练习、排位、预赛或决赛 Session。",
  "Edit event": "编辑 Event",
  "Delete event": "删除 Event",

  // Session screen
  "SESSION SUMMARY": "SESSION 摘要",
  "{count} recorded runs": "已记录 {count} 个 Runs",
  Best: "最快圈",
  Laps: "圈数",
  Start: "开始时间",
  "Track notes": "赛道笔记",
  "Edit this Event and choose a saved Track Layout before adding Session Track notes.":
    "请先编辑此 Event 并选择已保存的 Track Layout，然后再记录 Session 赛道笔记。",
  "Duplicate last run": "复制上一个 Run",
  "Copy a historical run": "复制历史 Run",
  "Compare runs": "比较 Runs",
  "Newest first": "最新优先",
  "No runs yet": "还没有 Run",
  "Add a run before going on track, then enter hot readings afterwards.": "出场前先建立一个 Run，回场后再填写热态数据。",
  "best lap": "最快圈",
  "Edit session": "编辑 Session",
  "Delete session": "删除 Session",
  "Add blank Run {number}": "新增空白 Run {number}",
  "Complete Run {number}": "完成 Run {number}",
  "Run {number}": "Run {number}",
  Done: "已完成",

  // Data and settings
  "Backup your data": "备份你的数据",
  "Without an account, this device is the only copy until you export a backup.": "没有账号，导出备份前本设备是唯一的副本。",
  "Export full backup": "导出完整备份",
  "Export Excel-ready CSV": "导出 Excel 可用的 CSV",
  "Restore JSON backup": "恢复 JSON 备份",
  "Setup templates": "Setup 模板",
  "Save a chassis setup from any Run, then apply it to a future Run in one tap.":
    "从任意 Run 保存一套 Chassis setup，之后一键应用到新的 Run。",
  "No templates yet. Open a Run, expand Chassis setup, then choose Save as template.":
    "还没有模板。打开一个 Run，展开 Chassis setup，然后选择「另存为模板」。",
  "Manage Track Maps": "管理 Track Maps",
  "Manage circuit layouts, map images and permanent reference markers.": "管理赛道 Layout、地图图片和永久参考 Marker。",
  "Install on iPhone": "安装到 iPhone",
  Installed: "已安装",
  "Open this website in Chrome or Safari.": "在 Chrome 或 Safari 中打开本网站。",
  "Tap the Share button.": "点击浏览器的分享按钮。",
  "Choose Add to Home Screen, then tap Add.": "选择「添加到主屏幕」，然后点击「添加」。",
  "On another device, use the browser's Install or Add to Home Screen option.": "在其他设备上，使用浏览器的「安装」或「添加到主屏幕」。",
  "Kart Data is running from your Home Screen.": "Kart Data 正在以主屏幕应用方式运行。",
  "Install it for a full-screen, app-like trackside experience.": "安装后可以全屏、像 App 一样在赛道使用。",
  "{tracks} Tracks · {layouts} Layouts · {markers} Markers": "{tracks} 个 Tracks · {layouts} 个 Layouts · {markers} 个 Markers",
  "Current storage": "当前存储",
  Events: "Events",
  "Clearing this browser's site data will remove these records. Export a backup regularly.":
    "清除此浏览器的网站数据会删除这些记录。请定期导出备份。",

  // Event and Session forms
  "Event name": "Event 名称",
  "e.g. Whilton Mill Practice": "例如 Whilton Mill Practice",
  Close: "关闭",
  "Saved Track Layout": "已保存的 Track Layout",
  "No saved layout": "未选择 Layout",
  "Track name": "赛道名称",
  "Circuit name": "赛道名称",
  "Start date": "开始日期",
  "End date": "结束日期",
  "Event type": "Event 类型",
  "Track condition": "赛道状况",
  Weather: "天气",
  "e.g. Clear, light wind": "例如 晴，微风",
  "Ambient temperature": "环境温度",
  "Track temperature": "赛道温度",
  Notes: "备注",
  "Get current temperature": "获取当前温度",
  "Uses your device location and Open-Meteo. You can still enter a value manually.":
    "使用设备定位和 Open-Meteo。你也可以手动填写。",
  "Session name": "Session 名称",
  Type: "类型",
  "Start time": "开始时间",
  "Create event": "建立 Event",
  "Create session": "建立 Session",
  "Save changes": "保存修改",
  "New session": "新增 Session",
  "Edit Event": "编辑 Event",
  "Edit Session": "编辑 Session",

  // Run creation, templates and confirmations
  "NEW RUN": "新的 RUN",
  "Source run": "来源 Run",
  "Tyre readings and chassis setup will be copied. Lap times and driver feedback start blank.":
    "会复制轮胎数据和 Chassis setup。圈速和 Driver feedback 保持空白。",
  "Copy into new run": "复制到新的 Run",
  "Save setup template": "保存 Setup 模板",
  "CHASSIS SETUP": "CHASSIS SETUP",
  "Template name": "模板名称",
  "Save template": "保存模板",
  "Apply setup template": "应用 Setup 模板",
  Template: "模板",
  "This replaces every chassis setup field in the current Run. Tyres, performance and feedback are unchanged.":
    "这会替换当前 Run 的全部 Chassis setup 字段。轮胎、成绩和反馈不变。",
  "Apply template": "应用模板",
  "Replace current data?": "替换当前数据？",
  "Restore backup": "恢复备份",
  Cancel: "取消",
  "Delete permanently": "永久删除",
  "This action cannot be undone.": "此操作无法撤销。",
  "This also deletes every session and run inside it.": "同时会删除其中所有 Sessions 和 Runs。",
  "This also deletes every run inside it.": "同时会删除其中所有 Runs。",
  "Delete {name}?": "删除 {name}？",

  // Run editor
  "Delete run": "删除 Run",
  Tyres: "轮胎",
  "Cold / hot": "冷态 / 热态",
  "Cold pressure": "冷态胎压",
  "Hot pressure": "热态胎压",
  "Cold temp": "冷态胎温",
  "Hot temp": "热态胎温",
  "Front left": "左前",
  "Front right": "右前",
  "Rear left": "左后",
  "Rear right": "右后",
  "Chassis setup": "Chassis setup",
  "Save as template": "另存为模板",
  "Front track / spacers": "前轮距 / 垫片",
  "Rear track width": "后轮距",
  "Front ride height": "前车高",
  "Rear ride height": "后车高",
  "Front toe": "前束",
  "Front camber": "前轮外倾角",
  Caster: "主销后倾角",
  "Axle type": "后轴类型",
  "Rear hub": "后轮毂",
  "Front torsion bar": "前扭力杆",
  "Seat stays": "座椅支撑",
  "Front sprocket": "前齿盘",
  "Rear sprocket": "后齿盘",
  "Wheel / rim type": "轮圈类型",
  "Setup notes": "Setup 备注",
  Performance: "成绩",
  Optional: "可选",
  "Run label": "Run 名称",
  "Number of laps": "圈数",
  "Fastest lap": "最快圈",
  "Average lap": "平均圈速",
  Position: "名次",
  "Driver feedback": "Driver feedback",
  Balance: "平衡",
  "Not recorded": "未记录",
  Understeer: "转向不足",
  Neutral: "中性",
  Oversteer: "转向过度",
  Grip: "抓地力",
  Low: "低",
  Medium: "中",
  High: "高",
  Braking: "刹车",
  Poor: "差",
  Acceptable: "可接受",
  Good: "好",
  "Corner entry": "入弯",
  "Mid-corner": "弯中",
  "Corner exit / traction": "出弯 / 牵引力",
  "General comments": "其他意见",

  // Compare
  "{corner} tyre": "{corner} 轮胎",
  "Pressure gain": "胎压增量",
  "Cold temperature": "冷态胎温",
  "Hot temperature": "热态胎温",
  "Temperature gain": "胎温增量",
  Completed: "已完成",
  Yes: "是",
  No: "否",
  "Not enough data": "数据不足",
  Saved: "已保存",
  "Saving…": "正在保存…",
  Error: "错误",
  "Run comparison": "Run 对比",
  "First run": "第一个 Run",
  "Second run": "第二个 Run",
  "Fastest-lap change": "最快圈变化",
  "Differences only": "只看差异",
  Measurement: "项目",
  Run: "Run",

  // Enumerations. Values are stored in English; only the label is translated.
  Practice: "练习",
  Qualifying: "排位",
  Heat: "预赛",
  "Pre-final": "准决赛",
  Final: "决赛",
  Other: "其他",
  Test: "测试",
  Race: "比赛",
  Dry: "干地",
  Damp: "微湿",
  Wet: "湿地",
  Mixed: "混合",

  // Toasts and errors
  "Event updated": "Event 已更新",
  "Session updated": "Session 已更新",
  "Backup could not be created": "无法建立备份",
  "Full backup exported, including Track Maps": "已导出完整备份，包含 Track Maps",
  "Excel-ready CSV exported": "已导出 Excel 可用的 CSV",
  "Invalid backup": "备份无效",
  "That file is not a valid Kart Data backup": "该文件不是有效的 Kart Data 备份",
  "Backup restored": "备份已恢复",
  "Weather response did not include a temperature": "天气数据中没有温度",
  "No date": "无日期",
  "{name} deleted": "已删除 {name}",
  "{name} saved as a setup template": "已将 {name} 保存为 Setup 模板",
  "{name} applied": "已应用 {name}",
  "Tyres and setup copied from Run {number}": "已从 Run {number} 复制轮胎和 Setup",
  "Location access was denied. Allow location access in your browser settings, or enter the temperature manually.":
    "定位权限被拒绝。请在浏览器设置中允许定位，或手动填写温度。",
  "Your current location is unavailable. Check your location settings or enter the temperature manually.":
    "无法获取当前位置。请检查定位设置，或手动填写温度。",
  "Location lookup timed out. Try again, or enter the temperature manually.": "定位超时。请重试，或手动填写温度。",
  "Current temperature could not be loaded. Check your connection and try again.": "无法获取当前温度。请检查网络后重试。",

  // Track Map Notebook
  "Track maps": "Track maps",
  "Map unavailable": "地图不可用",
  "This track or layout may have been deleted.": "此赛道或 Layout 可能已被删除。",
  "This Event does not have an available saved Track Layout. Edit the Event and choose one first.":
    "此 Event 没有可用的 Track Layout。请先编辑 Event 并选择一个。",
  "TRACK MAP NOTEBOOK": "TRACK MAP NOTEBOOK",
  "Your circuits": "你的赛道",
  "Search tracks": "搜索赛道",
  "Build your first track map": "建立第一张赛道图",
  "Upload a circuit map, then place braking, turn-in, apex and exit notes directly on it.":
    "上传一张赛道图，然后直接在图上标注刹车、入弯、弯心和出弯笔记。",
  "No matching tracks": "没有匹配的赛道",
  "Try another search.": "请尝试其他搜索词。",
  "Add a built-in circuit": "添加内置赛道",
  "Create another track": "建立其他赛道",
  "Built-in": "内置",
  "Built-in circuits": "内置赛道",
  Added: "已添加",
  "Maps are drawn from OpenStreetMap geometry. You can replace any of them with your own image later.": "地图由 OpenStreetMap 几何数据绘制。之后你可以用自己的图片替换其中任意一张。",
  "This also deletes {layouts}, {markers}, their map images and every Session observation recorded on them.": "同时会删除 {layouts}、{markers}、它们的地图图片，以及记录在其上的所有 Session 观察。",
  "This also deletes its map image, {markers} and {overlays}.": "同时会删除它的地图图片、{markers} 和 {overlays}。",
  "This also deletes {observations} recorded against it.": "同时会删除记录在其上的 {observations}。",
  "This backup contains {events}, {sessions}, {runs}, {tracks}, {layouts}, {markers} and {images}. Restoring it replaces all data currently stored on this device.": "此备份包含 {events}、{sessions}、{runs}、{tracks}、{layouts}、{markers} 和 {images}。恢复后会覆盖此设备上现有的全部数据。",
  "Location not set": "未填写位置",
  "Add a full, short or alternative circuit layout.": "新增全赛道、短赛道或其他 Layout。",
  "No layouts": "还没有 Layout",
  Layouts: "Layouts",
  "TRACK NOTES": "赛道笔记",
  "Track details": "赛道信息",
  "Edit track": "编辑赛道",
  "Delete track": "删除赛道",
  "Edit layout": "编辑 Layout",
  "Delete layout": "删除 Layout",
  "Map ready": "地图已就绪",
  "Needs map image": "需要地图图片",
  "TRACK LIBRARY": "TRACK LIBRARY",
  "New track": "新建赛道",
  "e.g. PF International": "例如 PF International",
  Location: "位置",
  "Town, country": "城市，国家",
  "General track notes": "赛道总体笔记",
  "Create track": "建立赛道",
  "TRACK LAYOUT": "TRACK LAYOUT",
  "New layout": "新增 Layout",
  "Layout name": "Layout 名称",
  Direction: "方向",
  Unknown: "未知",
  Clockwise: "顺时针",
  "Anti-clockwise": "逆时针",
  "Create layout": "建立 Layout",

  // Map workspace
  "Zoom out": "缩小",
  "Zoom in": "放大",
  "Reset zoom": "重置缩放",
  "REFERENCE MAP": "参考地图",
  "EDIT MAP": "编辑地图",
  "SESSION TRACK NOTES": "SESSION 赛道笔记",
  "Edit map": "编辑地图",
  Editing: "编辑中",
  "Add marker:": "添加 Marker：",
  "Choose type": "选择类型",
  "Choose a corner, or tap the map": "选择弯角，或点击地图",
  "Choose a corner, or tap the new position": "选择弯角，或点击新位置",
  "Tap the new marker position": "点击 Marker 的新位置",
  "Tap map to place {type}": "点击地图放置 {type}",
  "Place at corner": "放到弯角",
  "At corner…": "选择弯角…",
  "Cancel marker placement": "取消放置 Marker",
  "Replace map image": "更换地图图片",
  "View licence": "查看许可",
  "Add the circuit map": "添加赛道图",
  "Choose a clear overhead layout image. It will be resized and stored only on this device.":
    "选择一张清晰的俯视赛道图。图片会被压缩并只保存在本设备。",
  "Choose map image": "选择地图图片",
  "Preparing image…": "正在处理图片…",
  "General notes": "总体笔记",
  "Anything about this layout as a whole: surface, kerbs, the wet line, gearing…":
    "关于此 Layout 的整体信息：路面、路肩、湿地走线、齿比…",
  "Overall Session track summary": "本 Session 赛道总结",
  "Overall grip, changing conditions, key lesson…": "整体抓地力、天气变化、关键收获…",
  "Saved separately from permanent Track notes": "与永久赛道笔记分开保存",
  "Tap a marker to read or edit its notes. Pinch to zoom, or hold Ctrl and scroll on a computer, then drag the map to pan.":
    "点击 Marker 查看或编辑笔记。双指缩放，电脑上按住 Ctrl 滚动，然后拖动地图平移。",
  "Switch to Edit map, choose a marker type, then tap its position on the circuit.":
    "切换到编辑地图，选择 Marker 类型，然后点击赛道上的位置。",
  "Marker deleted": "已删除 Marker",
  "Marker moved": "Marker 已移动",
  "Marker moved to {corner}": "Marker 已移动到 {corner}",
  "{type} marker added": "已添加 {type} Marker",
  "{type} marker added at {place}": "已在 {place} 添加 {type} Marker",
  "Map ready · {width} × {height}": "地图已就绪 · {width} × {height}",
  "Map upload failed": "地图上传失败",
  "Track created": "赛道已建立",
  "Track updated": "赛道已更新",
  "Layout created": "Layout 已建立",
  "Layout updated": "Layout 已更新",
  "{name} created with a built-in map": "已建立 {name}，并载入内置地图",
  "{name} created with {count} built-in layouts": "已建立 {name}，并载入 {count} 个内置 Layout",
  "{name} created — upload your map image next": "已建立 {name}，请接着上传地图图片",
  "Delete marker {name}?": "删除 Marker {name}？",
  "This also deletes {count} Session observation recorded against it.": "同时会删除与它关联的 {count} 条 Session 观察。",
  "This also deletes {count} Session observations recorded against it.": "同时会删除与它关联的 {count} 条 Session 观察。",

  // Marker sheet
  "Close marker": "关闭 Marker",
  "Untitled marker": "未命名 Marker",
  "General reference": "永久参考",
  "{condition} reference": "{condition} 参考",
  "What happened in {session}?": "本次 {session} 的情况？",
  "Grip, line, braking point, what to try next…": "抓地力、走线、刹车点、下次要尝试的…",
  Result: "结果",
  "Not rated": "未评价",
  Better: "更好",
  Same: "相同",
  Worse: "更差",
  "Session observation saves automatically": "Session 观察会自动保存",
  Label: "名称",
  "Short instruction": "简短提示",
  "e.g. Brake at marshal post": "例如 在旗手台刹车",
  "General note": "一般笔记",
  "Dry note": "干地笔记",
  "Wet note": "湿地笔记",
  Move: "移动",
  Delete: "删除",
  "Delete marker": "删除 Marker",
  "Reference marker saves automatically": "永久 Marker 会自动保存",
  General: "一般",
  "No notes on this marker yet. Switch to Edit map to add them.": "此 Marker 还没有笔记。切换到编辑地图添加。",

  // Marker types. Stored in English; only the label is translated.
  In: "入弯",
  Mid: "弯中",
  Out: "出弯",
  Brake: "刹车",
  Gas: "油门",
  Others: "其他",
};

const translations: Record<Language, Record<string, string>> = { en: {}, zh };

export type Translate = (key: string, params?: Record<string, string | number>) => string;

type LanguageContextValue = { language: Language; setLanguage: (language: Language) => void; t: Translate };

const LanguageContext = createContext<LanguageContextValue | null>(null);

function fill(template: string, params?: Record<string, string | number>) {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
}

/**
 * The choice lives in localStorage, which the build-time prerender cannot read. Rather than
 * reading it in an effect and calling setState — which cascades a render and is what
 * react-hooks/set-state-in-effect warns about — the language is exposed as an external store
 * with a server snapshot. React renders "en" for the prerendered markup, then re-renders with
 * the stored value on hydration without reporting a mismatch.
 */
let currentLanguage: Language | null = null;
const languageListeners = new Set<() => void>();

function readLanguage(): Language {
  if (currentLanguage) return currentLanguage;
  const stored = typeof localStorage === "undefined" ? null : localStorage.getItem(LANGUAGE_STORAGE_KEY);
  currentLanguage = stored === "zh" || stored === "en" ? stored : "en";
  return currentLanguage;
}

function serverLanguage(): Language {
  return "en";
}

function subscribeToLanguage(listener: () => void) {
  languageListeners.add(listener);
  return () => languageListeners.delete(listener);
}

function writeLanguage(next: Language) {
  currentLanguage = next;
  localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
  languageListeners.forEach((listener) => listener());
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const language = useSyncExternalStore(subscribeToLanguage, readLanguage, serverLanguage);

  useEffect(() => {
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
  }, [language]);

  const setLanguage = useCallback((next: Language) => writeLanguage(next), []);
  const t = useCallback<Translate>((key, params) => fill(translations[language][key] ?? key, params), [language]);

  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useTranslation() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useTranslation must be used inside LanguageProvider.");
  return context;
}

/**
 * Sits beside the theme toggle in every top bar. The label shows the language it switches to,
 * not the current one, so the button says what tapping it will do.
 */
export function LanguageToggle() {
  const { language, setLanguage, t } = useTranslation();
  const next: Language = language === "en" ? "zh" : "en";
  return (
    <button
      className="icon-button language-toggle"
      type="button"
      aria-label={next === "zh" ? t("Switch to Chinese") : t("Switch to English")}
      onClick={() => setLanguage(next)}
    >
      <span aria-hidden="true">{next === "zh" ? "中" : "EN"}</span>
    </button>
  );
}

/** Exposed for the test that checks every key used in the app has a Chinese translation. */
export const zhDictionary = zh;
