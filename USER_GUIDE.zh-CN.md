# Kart Data 用户操作手册

**适用版本：** v0.6
**更新日期：** 2026-08-14

Kart Data 是一款用于竞赛卡丁车练习和比赛现场的数据记录工具。它可以记录胎压、胎温、车架 Setup、圈速和车手反馈，不需要注册账号。

## 立即打开网站

**[点击这里打开 Kart Data 正式网站 →](https://karting-data-recording-website.vercel.app)**

正式网址：<https://karting-data-recording-website.vercel.app>

> [!IMPORTANT]
> 记录默认只保存在当前设备和当前浏览器中。更换手机或浏览器、清除网站数据或使用无痕模式，都可能导致原有记录不可用。请定期使用 **Export full backup** 导出 JSON 备份。

## 目录

1. [认识数据结构](#1-认识数据结构)
2. [快速开始](#2-快速开始)
3. [创建和管理 Event](#3-创建和管理-event)
4. [创建和管理 Session](#4-创建和管理-session)
5. [创建 Run](#5-创建-run)
6. [填写 Run 数据](#6-填写-run-数据)
7. [使用 Setup 模板](#7-使用-setup-模板)
8. [比较两个 Runs](#8-比较两个-runs)
9. [导出、备份和恢复](#9-导出备份和恢复)
10. [安装到 iPhone 主屏幕](#10-安装到-iphone-主屏幕)
11. [编辑和删除记录](#11-编辑和删除记录)
12. [常见问题](#12-常见问题)

## 1. 认识数据结构

所有记录按照以下层级组织：

```text
Event
└── Session
    └── Run
```

- **Event**：一次比赛周末、测试日或练习日，例如 `PF International Test`。
- **Session**：Event 中的一个具体阶段，例如 `Practice 1`、`Qualifying` 或 `Final`。
- **Run**：一次实际出场。胎压、胎温、Setup、圈速和驾驶反馈都记录在 Run 中。

## 2. 快速开始

第一次使用时，按照以下顺序操作：

1. 点击 **New event**，建立当天的 Event。
2. 点击 **Add session**，建立 `Practice 1` 或其他 Session。
3. 点击 **Add blank Run 01**，建立第一次出场记录。
4. 出场前填写冷态胎压、冷态胎温和 Chassis setup。
5. 回场后填写热态胎压、热态胎温、圈速和 Driver feedback。
6. 点击 **Complete Run 01** 完成记录。
7. 下一次出场前，可以使用 **Duplicate last run** 复制上一次数据，只修改发生变化的部分。

所有输入都会自动保存。Run 页面右上角显示绿色 **Saved** 时，表示最新修改已写入当前设备。

<img src="docs/images/user-guide/01-home.png" alt="Kart Data 首页" width="390">

首页中的主要入口：

- **Resume recording**：回到当前 Event。
- **New event**：建立新的 Event。
- **Recent events**：打开最近使用过的 Event。
- 右上角齿轮：进入 **Data & settings**。

## 3. 创建和管理 Event

点击首页的 **New event**，可以填写：

- Event name：Event 名称。
- Track：赛道名称。
- Start date / End date：开始和结束日期。
- Event type：Practice、Test、Race 或 Other。
- Track condition：Dry、Damp、Wet 或 Mixed。
- Weather：天气描述。
- Ambient temperature：环境温度。
- Track temperature：赛道温度。
- Notes：Event 备注。

建立后，Event 页面会显示环境信息以及其下的所有 Sessions。

### 自动获取环境温度

在新建或编辑 Event 时，点击 **Get current temperature**：

1. 首次使用时允许浏览器访问当前位置。
2. 网站会读取当前位置附近的当前气温，并自动填入 **Ambient temperature**。
3. 检查数值后保存 Event；必要时仍可手动修改。

天气数据来自 Open-Meteo，是当前位置附近的天气模型数据，不等同于围场温度计或赛道表面温度。网络不可用、定位关闭或拒绝定位权限时，仍可继续手动填写。

<img src="docs/images/user-guide/02-event-sessions.png" alt="Event 页面和 Session 列表" width="390">

Event 页面右上角：

- 铅笔图标：编辑 Event 名称和 conditions 等信息。
- 垃圾桶图标：删除 Event。

## 4. 创建和管理 Session

在 Event 页面点击 **Add session**，然后填写：

- Session name：例如 `Practice 1`、`Heat 2` 或 `Final`。
- Type：Practice、Qualifying、Heat、Pre-final、Final 或 Other。
- Start time：开始时间。
- Notes：Session 备注。

打开 Session 后，右上角铅笔图标可以修改名称、类型、时间和备注。修改 Session 不会删除或重置其中已有的 Runs。

<img src="docs/images/user-guide/03-session-runs.png" alt="Session 页面和 Run 列表" width="390">

## 5. 创建 Run

Session 页面提供三种创建方式：

### Add blank Run

建立一个完全空白的 Run。适合第一次出场，或者 Setup 与之前完全不同的情况。

### Duplicate last run

复制当前 Session 中最后一个 Run 的：

- 四条轮胎的冷热胎压和胎温。
- 全部 Chassis setup。

新 Run 的圈速、圈数、完成状态和 Driver feedback 会保持空白，避免把上一次的比赛结果误认为本次结果。

### Copy a historical run

从任意 Event 和 Session 中选择一个旧 Run 作为来源。适合重新使用某条赛道或某种天气下的历史 Setup。

## 6. 填写 Run 数据

Run 页面分成四个区域。点击区域标题可以展开或收起。

### Tyres

四条轮胎按照实际位置排列：

```text
Front Left (FL)     Front Right (FR)
Rear Left (RL)      Rear Right (RR)
```

每条轮胎可以填写：

- Cold pressure：冷态胎压，单位 PSI。
- Hot pressure：热态胎压，单位 PSI。
- Cold temp：冷态胎温，单位 °C。
- Hot temp：热态胎温，单位 °C。

<img src="docs/images/user-guide/04-run-tyres.png" alt="Run 的轮胎数据输入页面" width="390">

### Chassis setup

这里记录前后轮距、车高、前束、前轮外倾角、Caster、Axle、Rear hub、Torsion bar、Seat stays、轮圈和齿盘等设置。

<img src="docs/images/user-guide/05-run-setup.png" alt="Run 的 Chassis setup 输入页面" width="390">

### Performance

- Run label：可选名称，例如 `Baseline` 或 `Pressure adjustment`。
- Number of laps：圈数。
- Fastest lap：最快圈。
- Average lap：平均圈速。
- Position：名次。

### Driver feedback

- Balance：Understeer、Neutral 或 Oversteer。
- Grip：Low、Medium 或 High。
- Braking：Poor、Acceptable 或 Good。
- Corner entry、Mid-corner、Corner exit：不同弯道阶段的反馈。
- General comments：其他驾驶感受。

填写完成后点击页面底部的 **Complete Run**。已完成的 Run 仍然可以重新打开和修改。

## 7. 使用 Setup 模板

Setup 模板用于重复使用一套 Chassis setup。

### 保存模板

1. 打开一个已经填写 Setup 的 Run。
2. 展开 **Chassis setup**。
3. 点击 **Save as template**。
4. 输入模板名称，例如 `PFI Dry Baseline`。
5. 点击 **Save template**。

### 应用模板

1. 打开需要填写 Setup 的 Run。
2. 展开 **Chassis setup**。
3. 点击 **Apply template**。
4. 选择模板并确认。

应用模板会替换当前 Run 中所有 Chassis setup 字段，但不会修改轮胎、圈速和 Driver feedback。

在 **Data & settings** 中可以查看和删除已经保存的模板。

## 8. 比较两个 Runs

当一个 Session 至少有两个 Runs 时，点击 **Compare runs**。

1. 在 **First run** 和 **Second run** 中选择需要比较的 Runs。
2. 页面会按照 Performance、每条轮胎、Chassis setup 和 Driver feedback 分组显示数据。
3. 蓝色背景表示两次 Run 的数据不同。
4. 勾选 **Differences only**，只显示发生变化的项目。
5. **Fastest-lap change** 显示第二个 Run 相对第一个 Run 的最快圈差值；负数代表第二个 Run 更快。

<img src="docs/images/user-guide/06-run-compare.png" alt="两个 Runs 的对比页面" width="390">

## 9. 导出、备份和恢复

点击首页右上角齿轮，进入 **Data & settings**。

<img src="docs/images/user-guide/07-data-settings.png" alt="数据备份、Setup 模板和 iPhone 安装页面" width="390">

### Export full backup

导出完整 JSON 备份，包括所有 Events、Sessions、Runs 和 Setup 模板。

JSON 是可以恢复回网站的备份格式。建议在每个赛道日结束后导出一次，并保存到 iCloud Drive、OneDrive 或其他安全位置。

### Export Excel-ready CSV

导出适合在 Excel 中查看和分析的 CSV 文件，包括：

- Event 和 Session 信息。
- Run 圈速和反馈。
- 四条轮胎的冷热胎压、胎温及自动计算的增量。
- 全部 Chassis setup 字段。

CSV 用于分析和查看，不能用于恢复网站数据。需要恢复时必须使用 JSON 备份。

### Restore JSON backup

1. 点击 **Restore JSON backup**。
2. 选择之前导出的 `.json` 文件。
3. 检查确认窗口中显示的 Events、Sessions 和 Runs 数量。
4. 点击 **Restore backup**。

> [!WARNING]
> 恢复备份会替换当前浏览器中已有的全部 Kart Data 记录。恢复前建议先导出一份当前备份。

## 10. 安装到 iPhone 主屏幕

1. 在 iPhone 的 Chrome 或 Safari 中打开网站。
2. 点击浏览器的 **Share**（分享）按钮。
3. 选择 **Add to Home Screen**（添加到主屏幕）。
4. 点击 **Add**。

安装后，Kart Data 会像普通 App 一样从主屏幕全屏打开。网站成功加载或安装后，核心页面也可以在赛道网络不稳定时继续使用。

如果 Chrome 的分享菜单中没有 **Add to Home Screen**，可以改用 Safari 打开同一个网址后再操作。

## 11. 编辑和删除记录

### 编辑

- Event 页面右上角铅笔：编辑 Event。
- Session 页面右上角铅笔：编辑 Session。
- Run：直接打开并修改，系统会自动保存。

### 删除

- 删除 Event 会同时删除其中所有 Sessions 和 Runs。
- 删除 Session 会同时删除其中所有 Runs。
- 删除 Run 只删除当前 Run。
- 删除 Setup 模板不会影响已经使用该模板建立的 Runs。

系统会在删除前显示确认窗口。删除完成后目前无法撤销，因此请谨慎操作。

## 12. 常见问题

### 为什么换了一台手机后没有数据？

网站目前没有账号和云同步。数据只属于创建它的设备和浏览器。请在旧设备导出 JSON，再在新设备使用 **Restore JSON backup**。

### Chrome 和 Safari 中的数据互通吗？

不会自动互通。即使在同一台 iPhone 上，不同浏览器也有各自的网站存储。要转移数据，需要导出和恢复 JSON。

### 删除 App 图标会删除数据吗？

通常移除主屏幕图标不等于清除网站数据，但不要把它当作备份。重新安装、清理浏览器或系统存储操作仍可能影响数据。

### 可以使用无痕模式吗？

不建议。无痕模式中的网站数据可能在关闭会话后被删除。

### CSV 和 JSON 应该选哪一个？

- 想在 Excel 中分析：使用 CSV。
- 想备份并在以后恢复：使用 JSON。
- 最稳妥的做法：两种都导出。

### 如何确认数据已经保存？

在 Run 页面查看右上角状态。绿色 **Saved** 表示当前修改已经保存到设备；如果显示 **Saving…**，请等待它变成 **Saved** 后再关闭页面。

---

本手册中的截图使用演示数据制作，不包含真实比赛记录。
