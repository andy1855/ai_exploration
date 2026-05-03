# Todo List — 产品设计稿

本文档描述待办清单 Web 应用的视觉规范、信息架构、交互状态与可配置参数，供设计与开发对齐。

---

## 1. 产品定位与范围

| 项目 | 说明 |
|------|------|
| 产品名 | Todo List（工作代号） |
| 核心场景 | 个人/小团队任务收集、分类、截止提醒、完成归档 |
| 非目标（v1） | 多人实时协作、复杂项目管理（甘特）、附件存储 |

---

## 2. 信息架构

```
┌─────────────────────────────────────────────────────────┐
│ App Shell（顶栏 + 可选侧栏 + 主内容）                      │
├──────────────┬──────────────────────────────────────────┤
│ 侧栏（可选）   │ 主区：任务列表 / 空状态 / 设置抽屉           │
│ · 收件箱      │                                          │
│ · 今天        │                                          │
│ · 即将到期    │                                          │
│ · 标签筛选    │                                          │
│ · 已完成归档  │                                          │
└──────────────┴──────────────────────────────────────────┘
```

**页面/视图**

1. **列表页**：默认视图，展示当前筛选下的任务卡片列表。
2. **任务详情抽屉**（或侧滑面板）：标题、描述、截止日期、优先级、标签、子任务（可选）。
3. **设置/配置**：主题、语言、默认排序、提醒行为等（与 `config` 一一对应）。

---

## 3. 设计令牌（Design Tokens）

### 3.1 色彩（浅色主题，默认）

| Token | 值 | 用途 |
|-------|-----|------|
| `--color-bg-app` | `#F4F5F7` | 应用背景 |
| `--color-bg-surface` | `#FFFFFF` | 卡片、顶栏、侧栏表面 |
| `--color-bg-muted` | `#ECEEF2` | 悬停行、分割线弱背景 |
| `--color-border` | `#E1E4EA` | 边框、分割线 |
| `--color-text-primary` | `#1B1F26` | 主文案 |
| `--color-text-secondary` | `#5C6370` | 次要说明、元数据 |
| `--color-text-tertiary` | `#8B919A` | 占位符、禁用 |
| `--color-accent` | `#2563EB` | 主按钮、链接、焦点环 |
| `--color-accent-hover` | `#1D4ED8` | 主按钮悬停 |
| `--color-success` | `#16A34A` | 完成态、成功提示 |
| `--color-warning` | `#D97706` | 即将逾期 |
| `--color-danger` | `#DC2626` | 已逾期、删除 |
| `--color-priority-high` | `#B91C1C` | 高优先级指示 |
| `--color-priority-medium` | `#CA8A04` | 中优先级 |
| `--color-priority-low` | `#64748B` | 低优先级 |

### 3.2 色彩（深色主题）

| Token | 值 |
|-------|-----|
| `--color-bg-app` | `#0F1218` |
| `--color-bg-surface` | `#171B24` |
| `--color-bg-muted` | `#222836` |
| `--color-border` | `#2E3444` |
| `--color-text-primary` | `#F1F3F7` |
| `--color-text-secondary` | `#A8B0BD` |
| `--color-text-tertiary` | `#6B7280` |
| `--color-accent` | `#3B82F6` |
| `--color-accent-hover` | `#60A5FA` |

### 3.3 排版

| Token | 值 |
|-------|-----|
| 字体栈 | `system-ui, -apple-system, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif` |
| `--font-size-xs` | `12px` |
| `--font-size-sm` | `13px` |
| `--font-size-base` | `15px` |
| `--font-size-lg` | `18px` |
| `--font-size-xl` | `22px` |
| `--font-weight-regular` | `400` |
| `--font-weight-medium` | `500` |
| `--font-weight-semibold` | `600` |
| `--line-height-tight` | `1.25` |
| `--line-height-normal` | `1.5` |

### 3.4 间距与圆角

| Token | 值 |
|-------|-----|
| `--space-1` ~ `--space-6` | `4, 8, 12, 16, 24, 32px` |
| `--radius-sm` | `6px` |
| `--radius-md` | `10px` |
| `--radius-lg` | `14px` |
| `--radius-full` | `9999px` |

### 3.5 阴影与层级

| Token | 用途 |
|-------|------|
| `--shadow-sm` | 卡片默认：`0 1px 2px rgba(15, 18, 24, 0.06)` |
| `--shadow-md` | 下拉、抽屉：`0 8px 24px rgba(15, 18, 24, 0.12)` |
| `--z-sticky` | 顶栏 `100` |
| `--z-drawer` | 抽屉遮罩 `200` / 面板 `201` |

---

## 4. 组件规范

### 4.1 顶栏（App Header）

- 高度 `56px`，背景 `--color-bg-surface`，底边 `1px solid var(--color-border)`。
- 左侧：产品名/Logo（`--font-size-lg`，`--font-weight-semibold`）。
- 右侧：主题切换、设置入口、主操作「新建任务」（`--color-accent` 填充按钮，`--radius-md`，高度 `36px`，左右 padding `16px`）。

### 4.2 侧栏导航项

- 每项高度 `40px`，圆角 `--radius-sm`，左对齐图标+文案。
- 默认：`--color-text-secondary`；悬停：`--color-bg-muted`；选中：`--color-accent` 左侧 `3px` 条 + 文字 `--color-text-primary` + 背景弱 tint。

### 4.3 任务行 / 卡片

- 卡片：`--color-bg-surface`，`--radius-md`，`--shadow-sm`，内边距 `16px`，项间距 `12px`。
- 左侧：圆形复选框 `20px`，未完成边框 `--color-border`，完成填充 `--color-success` + 白色对勾。
- 标题：`--font-size-base`，完成态 `text-decoration: line-through`，`--color-text-tertiary`。
- 元数据行：`--font-size-xs`，截止日期、标签 chips；逾期用 `--color-danger`，今日用 `--color-warning`。

### 4.4 标签 Chip

- 高度 `24px`，`--radius-full`，背景 `--color-bg-muted`，文字 `--font-size-xs`。
- 可配置最多展示数量（见配置 `ui.maxVisibleTags`）。

### 4.5 空状态

- 居中插画区（可用占位几何图形）+ 主文案「暂无任务」+ 次文案「点击新建任务开始」+ 次按钮。

### 4.6 设置抽屉

- 宽度桌面 `400px` / 移动端全屏；分组标题 `--font-size-xs`，大写或字间距略增，`--color-text-tertiary`。
- 表单项：开关、下拉、数字输入与 `config` 字段绑定。

### 4.7 焦点与无障碍

- 可见焦点环：`2px solid var(--color-accent)`，`outline-offset: 2px`。
- 复选框、按钮需 `aria-label`；列表容器 `role="list"`。

---

## 5. 交互与状态

| 状态 | 表现 |
|------|------|
| 加载中 | 列表骨架屏（3～5 条灰色脉冲条） |
| 错误 | 顶栏下横幅或行内文案，`--color-danger` |
| 拖拽排序（可选） | 拖动时卡片 `--shadow-md`，插入位置虚线 |
| 筛选无结果 | 空状态副本改为「该筛选下没有任务」 |

---

## 6. 响应式断点

| 断点 | 宽度 | 行为 |
|------|------|------|
| `sm` | `< 640px` | 侧栏收进抽屉汉堡菜单；任务卡片全宽 |
| `md` | `640px–1024px` | 侧栏可折叠为图标栏 |
| `lg` | `≥ 1024px` | 固定侧栏 `240px`，主内容区自适应 |

---

## 7. 配置参数说明

所有运行时可调参数见根目录 `config.schema.json`（JSON Schema）与 `config.defaults.json`（默认值）。

**摘要：**

- **theme**：`light` | `dark` | `system`
- **locale**：`zh-CN` | `en-US`
- **features**：子任务、提醒、拖拽排序等开关
- **defaults**：新建任务默认优先级、默认截止日期偏移天数
- **storage**：本地存储 key 前缀、是否同步远端（占位）
- **ui**：侧栏默认展开、每页条数、动画时长 ms

实现时建议：启动读取 `config.defaults.json`，用户改动写入 `localStorage` 或用户配置接口，合并策略为「默认值 < 持久化覆盖」。

---

## 8. 与原型对应关系

浏览器打开 `prototype/index.html` 可查看静态高保真布局（含浅色/深色切换演示）。原型使用与上文一致的 CSS 变量名，便于迁移到 React/Vue 等框架。

---

## 9. 版本

| 版本 | 日期 | 说明 |
|------|------|------|
| 0.1.0 | 2026-05-03 | 初稿：令牌、组件、配置 Schema、HTML 原型 |
