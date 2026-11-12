# 社会第一课

面向大学生的就业与生活辅导网页应用，以西邮为样例校。核心能力是签约前的**合同 / 协议自检**。

纯静态实现：HTML + CSS + 原生 JS，无框架、无构建、无外部 CDN，断网可演示。

## 当前进度

| 模块 | 状态 | 说明 |
|---|---|---|
| 页面骨架 | 完成 | 四个标签：问答 / 合同自检 / 办事清单 / 关于 |
| 场景问答 | 完成（示例数据） | 领域切换、分类筛选、关键词搜索、来源与生效时间 |
| 合同自检 | 完成（示例规则） | 三方协议 / 劳动合同 / 租房合同，风险表 + 签前必问 3 问 |
| 办事清单 | 完成（示例步骤） | 医保报销 / 退租交接 / 入职报到，勾选进度本地保存 |
| 部署配置 | 完成 | `start.bat`、`start.sh`、本 README |

## 目录结构

```
.
├── index.html
├── css/style.css
├── js/app.js
├── data/
│   ├── config.json       # 应用基本信息、模型开关（默认关闭）
│   ├── qa.json           # 问答条目
│   ├── rules.json        # 合同检查器与检查项
│   ├── sources.json      # 来源清单
│   └── checklists.json   # 办事清单（新增，schema 待确认）
├── start.bat
├── start.sh
└── README.md
```

## 本地运行

必须通过 HTTP 访问，直接双击 `index.html` 会被浏览器拦截 `fetch` 本地 JSON。

Windows：

```
start.bat
```

macOS / Linux：

```
bash start.sh
```

或手动：

```
python -m http.server 8000
```

浏览器打开 `http://localhost:8000/`。

预期结果：首页显示「社会第一课」，四个标签可切换；问答默认展示「求职知识」条目，搜索「三方」有结果；合同自检生成风险表；办事清单可勾选且刷新后保留进度。

其他端口：Windows 用 `set PORT=8001` 后再运行，Unix 用 `PORT=8001 bash start.sh`。

## 规则口径

| 项 | 说明 |
|---|---|
| 计分权重 | `high`=3、`medium`=2、`low`=1 |
| 回答折算 | 否 = 满分；不清楚 = 半分；是 = 0 |
| 风险分 | 已作答项得分之和，分母为已作答项满分之和（未答项不计入） |
| 风险等级 | 比例 ≥ 0.6 高风险；≥ 0.3 中风险；> 0 低风险；0 未见明显风险 |
| 风险表 | 仅列出「否 / 不清楚」的条目，按分值降序 |
| 签前必问 3 问 | 取风险表前 3 条建议；不足 3 条时补一条核对提醒 |

## 数据文件

字段结构与项目概要一致：

- `qa.json`：`id / domain / category / question / answer / source_ids / effective_date / audience / keywords`，可选 `sample: true` 标记示例条目。
- `rules.json`：`checkers[]` 内含 `items[]`，每项含 `risk_if_no / advice / source_ids`。
- `sources.json`：`url` 为空时前端只渲染文字，不生成链接（避免出现失效或臆造链接）。
- `checklists.json`：**新增文件**，字段为 `id / name / desc / steps[]`，`steps` 每项含 `id / text / tip`。该 schema 未经内容团队确认。

内容团队直接替换 `data/` 下文件即可，前端无需改动；新增条目只要 `id` 唯一即可。

## 部署

### Cloudflare Pages

1. 把本目录推送到 Git 仓库（GitHub / GitLab）。
2. Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git，选择该仓库。
3. 构建命令留空，输出目录填 `/`（站点根目录即当前目录）。
4. 保存后等待部署，平台会给出 `*.pages.dev` 域名。
5. 无需环境变量；`data/config.json` 中模型开关保持 `false` 即为纯本地模式。

### GitHub Pages

1. 推送仓库到 GitHub。
2. 仓库 Settings → Pages → Build and deployment → Source 选 `Deploy from a branch`。
3. 分支选 `main`，目录选 `/ (root)`，保存。
4. 等待 Actions 完成，访问 `https://<用户名>.github.io/<仓库名>/`。

注意：GitHub Pages 部署在子路径下，本项目使用相对路径（`css/`、`js/`、`data/`），无需改配置。

## 待确认项

| 编号 | 事项 | 影响 |
|---|---|---|
| 1 | `data/` 下全部内容为**示例数据**，正式文案待内容团队替换 | 上线前必须替换，避免被当作正式口径 |
| 2 | `sources.json` 中 `url` 全部为空 | 需要官方链接后才能生成可点击来源 |
| 3 | 华为云 MaaS 代理接口地址、鉴权方式 | 标注「待确认」，当前 `model.enabled=false`，不发起请求 |
| 4 | `checklists.json` 的 schema 是否被采纳 | 若内容团队另行定义，需同步改 `js/app.js` 的读取字段 |
| 5 | 问答目标 36 条，当前示例 13 条 | 内容补充中 |
| 6 | 是否需要 PWA / 离线缓存 | 当前断网演示依赖先加载一次页面，未做 Service Worker |

## 安全与边界

- 前端不含任何密钥；如后续接入模型，密钥必须放在服务端代理，通过环境变量注入。
- 所有数据判断在浏览器本地完成，不向第三方发送用户输入。
- 用户勾选与自检答案仅存于浏览器 `localStorage`，不上传。