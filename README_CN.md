<div align="center">
  <img src="https://images.flashnote.top/2026/02/icon.png" width="128" alt="EzImage Logo" />
  <h1>EzImage</h1>
  <p><b>为 VS Code & AI-first IDEs 打造的极简、高效、支持多平台的图床上传插件</b></p>

  <p>
    <img src="https://img.shields.io/github/v/release/keepwonder/ezimage?display_version=1.0.4&include_prereleases" alt="Version" />
    <img src="https://img.shields.io/badge/Platform-macOS%20%7C%20Windows%20%7C%20Linux-brightgreen.svg" alt="Platform" />
    <img src="https://img.shields.io/badge/IDE-VS%20Code%20%7C%20Antigravity%20%7C%20Cursor%20%7C%20Windsurf%20%7C%20Trae-blueviolet.svg" alt="IDEs" />
    <img src="https://img.shields.io/badge/License-MIT-orange.svg" alt="License" />
  </p>

  <p>
    <a href="README.md">English</a> | <b>简体中文</b>
  </p>

  <p>
    <a href="#features">特性</a> •
    <a href="#ides">支持</a> •
    <a href="#install">安装</a> •
    <a href="#config">配置</a> •
    <a href="#hotkeys">快捷键</a> •
    <a href="#troubleshooting">问题排查</a> •
    <a href="#i18n">多语言</a> •
    <a href="#roadmap">蓝图</a> •
    <a href="#feedback">反馈</a>
  </p>
</div>

---

**EzImage** 是一款专为 VS Code 深度定制的图床工具。它旨在解决 Markdown 创作中“存图难、贴图烦”的痛点，帮助你以最自然的方式（剪贴板粘贴、拖拽、右键菜单）完成图片上传并将 Markdown 链接一键插入文档。

> ⚠️ **压缩没生效 / 上传看着不对劲？** 请先看 [🔧 问题排查](#troubleshooting) 章节 —— 大部分常见问题（sharp 加载失败、公网 URL 404、配置字段缺失）都能在那里直接找到解决方案。

## <span id="features"></span>✨ 特性

-   **🚀 多平台支持**: 采用 Provider 插件化架构，首发支持 Cloudflare R2，即将接入 AWS S3、阿里云 OSS、腾讯云 COS 等。
-   **📸 极致贴图体验**:
    *   **剪贴板上传**: `Cmd+Alt+V` (Mac) 或 `Ctrl+Alt+V` (Win/Linux) 瞬间完成上传并插入。
    *   **丝滑拖拽**: 直接从系统文件夹拖入图片，自动处理并生成链接。
-   **🔄 本地图片一键上云**: 在 Markdown 编辑器中右键 → **EzImage: 把本地图片路径转成云端 URL**，扫描当前文档里的 `![alt](./本地.png)`，批量上传到云端并原地替换路径——整个过程是**一次原子编辑**，按一次 `Cmd+Z` 即可整体撤销。
-   **📉 智能图片引擎**: 内置 `sharp` 工业级处理引擎。
    *   自动转换为 **WebP** 格式，极致压缩体积且保持画质。
    *   支持自动尺寸调整（Max Width）和质量控制。
    *   **零配置开箱即用**：首次上传时自动检测 `sharp` 是否就绪，缺失会引导一键安装匹配当前操作系统与 Node ABI 的原生模块；不想压缩也可以随时关闭 `ezimage.compress`。
-   **📂 灵活的文件命名**: 支持丰富的变量模板，如 `{yyyy}/{MM}/{timestamp}-{random}.{ext}`，告别文件名冲突。
-   **📋 深度集成**: 提供编辑器右键上下文菜单，无需记忆复杂指令。

## <span id="ides"></span>🚀 多编辑器支持

EzImage 不仅支持标准的 **VS Code**，还完美适配目前主流的 AI 代码编辑器及 VS Code 定制版：

-   **Antigravity**: 深度适配，AI 辅助开发的首选环境。
-   **Cursor**: 直接兼容，性能卓越。
-   **Windsurf**: 全功能支持。
-   **Trae**: 字节跳动出品，完美适配。
-   **VSCodium**: 开源版 VS Code 同样适用。

## <span id="install"></span>📦 安装

### 方式 A：从 VSIX 安装（所有 IDE 通用）

1.  从 [GitHub Releases](https://github.com/keepwonder/ezimage/releases) 下载最新的 `.vsix` 文件（文件名形如 `ezimage-X.Y.Z.vsix`）。
2.  在您的编辑器中按 `Cmd+Shift+P` (Mac) / `Ctrl+Shift+P` (Win)，搜索 `Install from VSIX`。
3.  或者使用命令行安装，把 `ezimage-X.Y.Z.vsix` 替换为实际下载的文件名：

| IDE / Environment | 命令行指令 |
| :--- | :--- |
| **VS Code** | `code --install-extension ezimage-X.Y.Z.vsix` |
| **Antigravity** | `antigravity --install-extension ezimage-X.Y.Z.vsix` |
| **Cursor** | `cursor --install-extension ezimage-X.Y.Z.vsix` |
| **Windsurf** | `windsurf --install-extension ezimage-X.Y.Z.vsix` |
| **Trae** | `trae --install-extension ezimage-X.Y.Z.vsix` |

### 方式 B：从 Marketplace

1.  在扩展市场中搜索 `EzImage` 即可一键安装。
2.  或者直接访问 [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=kiang.ezimage) 进行在线安装。

## <span id="config"></span>⚙️ 配置

安装完成后，建议进行如下基础操作：

1. 按 `Cmd+Shift+P` (Mac) / `Ctrl+Shift+P` (Win) 唤起命令面板。
2. 搜索并运行 **`EzImage: 打开设置`**。
3. 配置您的存储服务（以 Cloudflare R2 为例）：
   - **Provider**: `r2`
   - **Account ID**: 您的 API 令牌关联账户 ID
   - **Bucket Name**: 存储桶名称
   - **Access Key ID / Secret Access Key**: R2 访问密钥对
   - **Public URL**: 您的 Bucket 公网分发地址

### 全部配置项

按 VS Code 设置面板的展示顺序排列，每个分组对应一组语义相关的设置。`order` 字段显式定义在 `package.json` 里，避免 VS Code 按字母序排序把组打乱。

**Storage** — 上传目标
| 配置键 | 默认值 | 说明 |
| :--- | :--- | :--- |
| `ezimage.provider` | `r2` | 存储 Provider。当前仅 `r2` 已实现；S3/OSS/COS 在 Roadmap 中。 |
| `ezimage.r2.accountId` | `""` | Cloudflare Account ID。 |
| `ezimage.r2.accessKeyId` | `""` | R2 访问密钥 ID。 |
| `ezimage.r2.secretAccessKey` | `""` | R2 访问密钥 Secret。 |
| `ezimage.r2.bucketName` | `""` | R2 存储桶名称。 |
| `ezimage.r2.publicUrl` | `""` | 公开分发地址，例如 `https://pub-xxxx.r2.dev`。 |
| `ezimage.pathTemplate` | `{yyyy}/{MM}/{timestamp}-{random}.{ext}` | 对象路径模板。可用变量：`{yyyy}` `{MM}` `{dd}` `{hh}` `{mm}` `{ss}` `{timestamp}` `{random}` `{name}` `{ext}`。 |

**Compression** — 上传前对图片的处理
| 配置键 | 默认值 | 说明 |
| :--- | :--- | :--- |
| `ezimage.compress` | `true` | 是否在上传前压缩为 WebP。 |
| `ezimage.maxWidth` | `1920` | 最大宽度（像素），超过此值会先等比缩放再压缩。设为 `0` 表示保持原图尺寸。 |
| `ezimage.quality` | `85` | WebP 质量（1–100），数值越高画质越好、体积越大。 |
| `ezimage.autoInstallSharp` | `true` | 当 `sharp` 缺失时，首次上传会引导一键安装。需要 Node.js ≥ 18.17 且 `npm` 在 `PATH` 上。 |
| `ezimage.disableCompressionNotice` | `false` | 当 sharp 加载失败时是否静默（默认会提示一次）。 |

**Insert format** — 片段在 Markdown 里的样子
| 配置键 | 默认值 | 说明 |
| :--- | :--- | :--- |
| `ezimage.insertFormat` | `markdown` | 插入到编辑器的片段格式。`markdown` / `html-wrap` / `html-figure` / `custom`。详见 [插入格式模板](#插入格式模板)。 |
| `ezimage.insertWidth` | `100%` | HTML 模板里 `{width}` 渲染的值。例如 `65%`、`600px`、`auto`。空字符串表示不输出 width 属性。 |
| `ezimage.insertAlign` | `none` | HTML 模板的对齐方式。`none` 不包 `<div>` 包裹层。 |
| `ezimage.insertCustomTemplate` | `""` | `insertFormat = custom` 时使用的模板字符串。可用变量：`{url}` `{filename}` `{name}` `{ext}` `{width}` `{align}` `{alt}`。 |
| `ezimage.insertIncludeName` | `true` | 是否用源文件名作为 alt 文本 / figcaption。 |

**Language** — 弹窗、错误、提示信息的语言
| 配置键 | 默认值 | 说明 |
| :--- | :--- | :--- |
| `ezimage.language` | `auto` | EzImage 弹窗、错误、提示信息的显示语言。`auto` 跟随 VS Code 的界面语言。设置面板的 label 仍跟随 VS Code 主语言（这是 VS Code 的限制）。 |

### 插入格式模板

三个内置预设覆盖最常见场景。`insertAlign` 和 `insertWidth` 是独立设置——`insertAlign = none` 时 `html-wrap` 直接输出 `<img>`，不加 `<div>` 包裹：

| 格式 | `align = center`、`width = 100%` | `align = none` |
| :--- | :--- | :--- |
| `markdown` | `![photo](https://pub.example.com/2026/09/photo-abc123.webp)` | *(相同)* |
| `html-wrap` | `<div align="center"><img src="…" alt="photo" width="100%"></div>` | `<img src="…" alt="photo" width="100%">`（无包裹） |
| `html-figure` | `<figure><img src="…" alt="photo" width="100%"><figcaption>photo</figcaption></figure>` | *(相同 — figure 忽略 `insertAlign`)* |

想要完全自定义？把 `ezimage.insertFormat` 设为 `custom`，再在 `ezimage.insertCustomTemplate` 里写自己的模板，变量如下：

| 变量 | 解析为 |
| :--- | :--- |
| `{url}` | 上传后的公开 R2 URL |
| `{filename}` | 完整文件名（含扩展名），例如 `photo.png` |
| `{name}` | 不含扩展名的文件名，例如 `photo` |
| `{ext}` | 不带点号的扩展名，例如 `png` |
| `{width}` | `ezimage.insertWidth` 的值（空 → 不输出 width） |
| `{align}` | `ezimage.insertAlign` 的值 |
| `{alt}` | alt 文本（默认用文件名，可被 `insertCustomAlt` 覆盖） |

未识别的占位符会**原样保留**——你写错时不会被悄悄吞掉，方便排查。

**单次覆盖**：命令 `EzImage: Upload Clipboard Image As…` 允许每次上传时选不同格式，不影响默认设置。如果想绑快捷键（比如 `Ctrl+Alt+Shift+V` 专用于 HTML 居中），去 *File → Preferences → Keyboard Shortcuts* 搜 `ezimage.uploadClipboardAs`。

> [!TIP]
> **觉得配置太复杂？** 我们准备了 [📘 Cloudflare R2 手把手配置指南](docs/R2_GUIDE_CN.md)，包含截图和报错排查。
>
> **想要自定义图片路径？** 请参考 [📝 路径变量手册](docs/VARIABLES_CN.md)。

## <span id="local-images"></span>🔄 本地图片一键上云

本地写稿、准备发布时，不用再一张张手动上传。EzImage 可以扫描 Markdown 文档，把所有本地图片引用上传到云端，并把路径原地替换成云端 URL——一次性搞定。

### 快速开始

1. 打开 `Settings`（`Cmd+,` / `Ctrl+,`），搜索 `EzImage`。
2. 启用 **`ezimage.localImageUpload.enabled`**。启用后，编辑器右键菜单的 **Modification** 分组里会多出两项：
    - **EzImage: 把本地图片路径转成云端 URL**：扫描整个文档。
    - **EzImage: 把选中区域里的本地图片转成云端 URL**：只扫描当前选中的部分（仅在有选中时出现）。
3. 右键 Markdown 文件任意位置 → **EzImage: 把本地图片路径转成云端 URL**。
4. EzImage 找到所有 `![alt](./path.png)`，弹出确认：*"找到 5 张本地图片（2 张已跳过）。是否上传并就地替换？"* 然后串行上传，顶部进度条提示进度。
5. 整个转换作为**一次原子编辑**落地，按一次 `Cmd+Z` 就能整体回滚。

### 扫描范围

- ✅ Markdown 行内图片：`![alt](./relative.png)`、`![alt](/绝对路径.jpg)`、`![alt](<./带空格.webp>)`、`![alt](./x.png "title")`。
- ✅ 相对路径（基于 Markdown 文件所在目录解析）和绝对路径。
- ✅ 同一图片被多次引用：每处独立处理（因为 `ezimage.pathTemplate` 会随机化云端 key，所以可能产生多个云端 URL）。

### 跳过规则

| 跳过原因 | 示例 | 行为 |
| :--- | :--- | :--- |
| 远程 URL | `![alt](https://cdn.example.com/x.png)` | 静默跳过。 |
| Data URI | `![alt](data:image/png;base64,…)` | 静默跳过。 |
| 非图片文件 | `![alt](./notes.txt)` | 静默跳过。 |
| 本地文件不存在 | `![alt](./已删除.png)` | 默认静默跳过。把 `ezimage.localImageUpload.skipNonExistent` 设为 `false` 可以让它们成为错误。 |

确认弹窗会告知跳过的数量，所以不会有"静默漏改"的尴尬。

### 第一版的限制

- 只识别 Markdown 行内图片。引用式 `![alt][ref]` 和 HTML `<img>` 标签暂不支持（v1 范围之外）。
- 仅支持本地 workspace（file scheme）。远程 workspace（WSL / SSH / Dev Containers）暂不支持。
- 未保存（untitled）文档会被拒绝——请先保存文件，这样相对路径才能被解析。
- **完全手动触发**：不会在保存时、粘贴时、或任何"自动"时机偷偷跑。打开菜单项 → 主动触发 → 看它工作 → 不满意就撤销。

### 配置项

| 配置 | 默认值 | 说明 |
| :--- | :--- | :--- |
| `ezimage.localImageUpload.enabled` | `false` | 在编辑器右键菜单里显示「EzImage: 把本地图片路径转成云端 URL」。默认关闭——开一次就行。 |
| `ezimage.localImageUpload.skipNonExistent` | `true` | 跳过本地文件不存在的图片（通常是因为已被删除）。设为 `false` 时把它们当成错误处理。 |

## <span id="hotkeys"></span>⌨️ 快捷键

| 功能 | Mac 快捷键 | Windows/Linux 快捷键 |
| :--- | :--- | :--- |
| **EzImage: 上传剪贴板图片** | `Cmd + Alt + V` | `Ctrl + Alt + V` |
| **EzImage: 选择并上传图片文件** | 命令面板搜索 `EzImage: 选择并上传图片文件` |

## <span id="i18n"></span>🌐 多语言

EzImage 自带英文和简体中文翻译。显示语言由 `ezimage.language` 控制：

| 取值 | 行为 |
| :--- | :--- |
| `auto`（默认） | 跟随 VS Code 的界面语言。中文环境下显示简体中文，其他语言显示英文。 |
| `en` | 强制英文。 |
| `zh-CN` | 强制简体中文。 |

语言切换**即时生效**，无需重启窗口。

### 哪些文案会被翻译

只有 **EzImage 自己弹出的运行时界面**：

- ✅ `vscode.window.showErrorMessage` / `showWarningMessage` / `showInformationMessage` 的所有文案
- ✅ `vscode.window.showQuickPick` 的 label 和 description（比如「上传为…」选择菜单）
- ✅ 输出频道里所有日志
- ✅ `vscode.window.withProgress` 的进度标题
- ❌ **设置面板里的 label 和 description**

### 为什么设置面板不能跟随扩展设置

VS Code 设置面板的 label/description 直接从 `package.json` 读，而 VS Code 用它**自己**的 `package.nls.<locale>.json`（这个机制受 Marketplace 控制）来翻译，并且只跟 VS Code 的**主语言**走——不接受扩展在运行时覆盖。

这其实是合理的：设置面板的文案描述的是「这个选项是干嘛的」，用户看到的时间很短；扩展运行时弹窗才是用户长时间面对的——这才是 `ezimage.language` 控制的真正场景。

如果你**真的**想让设置面板也变中文，那就用命令面板的 `Configure Display Language` 把 VS Code 整个切到中文——这是 VS Code 层级的设置，不是 EzImage 的。

### 添加新翻译

1. 复制 `l10n/bundle.json` 为 `l10n/<locale>.bundle.json`，翻译所有 value（不要动 key）。
2. 在 `src/i18n.ts` 的 `SupportedLocale` 和 `BUNDLES` 里加入新 locale。
3. 在 `src/types.ts` 和 `package.json` 的 enum 里同步加进去，让设置面板能选。
4. CI 自动验证 key 一致性 — `npm test` 会捕捉两边的漂移。

翻译文件是 JSON 格式，无需特殊工具。欢迎提 PR。

## <span id="troubleshooting"></span>🔧 问题排查

### 上传后还是原图（WebP 压缩没生效）

这是最常见的问题，几乎都是因为 `sharp` 原生模块在 VS Code 内嵌的 Node 里加载失败。打开 **视图 → 输出 → EzImage** 面板，查看其中是否包含以下行：

- `Compression engine unavailable: <error>` — 找到了 `sharp` 但加载失败。最常见原因是 **Electron/Node ABI 不匹配**：VS Code 自带的 Node 版本与现成的预编译二进制不兼容。在 `npm install sharp` 成功后请按 `Ctrl/Cmd+Shift+P` 搜索 **"Developer: Reload Window"** 重启窗口；如果用 `ezimage.autoInstallSharp: false` 关闭了自动安装，则需手动执行 `npm rebuild sharp`。
- `Could not find npm on PATH` — 因为 `npm` 不在环境变量里，无法自动安装 sharp。请先安装 Node.js ≥ 18.17（自带 `npm`，从 [nodejs.org](https://nodejs.org) 获取），然后再次点击 **"立即安装"**。
- `Auto-install exited with code N` — `npm install` 执行失败。Output 面板会附带针对错误类型的提示，常见处理：
  - **企业代理**：在环境变量里设置 `NPM_CONFIG_REGISTRY` 指向内部镜像。
  - **权限被拒**：扩展目录不可写。请重装 VSIX 或调整 VS Code 扩展目录权限。
  - **网络超时**：手动 cd 到扩展目录（`~/.vscode/extensions/kiang.ezimage-X.Y.Z/`）跑一次 `npm install sharp`，完成后重启 VS Code。

如果之前点过 **"不再提示"**，把 `ezimage.autoInstallSharp` 改回 `true` 后再次触发上传即可重新弹窗。

如果不想折腾压缩，直接把 `ezimage.compress` 设为 `false` —— 上传功能照常工作，只是不再做 WebP 转码。

### 上传成功但图片链接 404

R2 公开访问没有配好。打开 R2 控制台的 **Settings → Public Access**，确认存储桶已开启公共访问，然后把页面显示的 **Public Bucket URL**（形如 `https://pub-xxxx.r2.dev`）填到 `ezimage.r2.publicUrl` 即可。

### 提示 `Missing R2 Access Key ID`（或其它 "Missing R2 ..." 错误）

运行 `EzImage: 打开设置`，按错误信息把对应字段填好。`accountId`、`accessKeyId`、`secretAccessKey`、`bucketName`、`publicUrl` 五项缺一不可。

### `Cmd/Ctrl + Alt + V` 按了没反应

命令只在 Markdown 文件里生效。请确保当前打开的是 `.md` 文件，光标停在要插入图片的位置，然后再按快捷键。如果你粘贴的是 Finder 文件（不是截图），扩展会自动识别；仍然没生效时请查看 **输出 → EzImage** 面板里的 `Using image path from clipboard text` 或 `Unable to read clipboard file reference` 行排查。

## <span id="roadmap"></span>🗺️ 发展蓝图 (Roadmap)

- [x] Cloudflare R2 基础上传支持
- [x] 多格式图片自动转 WebP 压缩（自 1.0.3 起附带一键安装 sharp 引导）
- [ ] AWS S3 通用协议支持
- [ ] 阿里云 OSS、腾讯云 COS 接入
- [ ] Gitee/GitHub 图床模式
- [ ] 图片上传历史记录统计预览

## <span id="development"></span>🛠️ 开发指南

### 从源码构建

```bash
npm install            # 安装依赖
npm run compile        # 编译 TypeScript 到 ./out/
npm run verify         # 打 dev VSIX + 跑 smoke test
npm run package        # 同 verify，但保留 .vsix 在项目根
npm run vsce:package   # 用官方 @vscode/vsce 打包
```

### Commit 消息规范

本项目遵循 [Conventional Commits](https://www.conventionalcommits.org/)，
由 [`standard-version`](https://github.com/conventional-changelog/standard-version)
自动生成 CHANGELOG 并选择下一个版本号：

| 类型 | 触发版本号变更 | CHANGELOG 分类 |
| :--- | :--- | :--- |
| `feat:` | minor | ✨ Features |
| `fix:` | patch | 🐛 Bug Fixes |
| `perf:` | patch | ⚡ Performance |
| `refactor:` | — | ♻️ Refactors |
| `docs:` | — | 📚 Documentation |
| `build:` | — | 📦 Build System |
| `ci:` | — | 🔧 Continuous Integration |
| `chore:` / `style:` | — | 不显示 |

破坏性变更：在类型后加 `!`，例如 `feat!: 重写上传管线`，会触发 major 版本号变更。

### 发布流程

```bash
# 1. 确认自上次发布以来的 commit 都符合 conventional 规范
git log v1.0.3..HEAD --oneline

# 2. 运行发布脚本 — 自动 bump package.json、重生 CHANGELOG.md、
#    并创建单个 chore(release): X.Y.Z commit。先不打 tag，方便你 review 改动。
./scripts/release.sh patch      # 也可以是 minor / major

# 3. 检视改动后推送 commit，然后打 tag 并推送 tag
git push
git tag v1.0.4
git push origin v1.0.4

# 4. GitHub Actions release workflow 会自动：
#    - 用官方 @vscode/vsce 打包 VSIX
#    - 跑 smoke test（验证 AWS SDK 能正常 require）
#    - 从 CHANGELOG.md 提取 release notes
#    - 把 .vsix 附加到 GitHub Release
#    - 如果配置了 VSCE_PAT，则一并发布到 VS Code Marketplace
```

仅预览不修改：

```bash
./scripts/release.sh --dry
```

#### 发布到 VS Code Marketplace

发布工作流会自动调用 `vsce publish`，但前提是仓库里配置了 `VSCE_PAT` secret（Settings → Secrets and variables → Actions）。没配置的话 VSIX 仍会附在 GitHub Release，只是不会推送到 Marketplace。

启用自动发布的步骤：

1. 用拥有 Marketplace `kiang` publisher 的微软账号登录 [dev.azure.com](https://dev.azure.com)。
2. User settings → Personal Access Tokens → New Token。
3. Scopes 选 **Marketplace (Manage)** — 这一个 scope 就够了。
4. 拷贝 token，然后在本仓库 Settings → Secrets and variables → Actions → New repository secret：
   - Name: `VSCE_PAT`
   - Value: 上面拷贝的 token
5. 下次 tag 发布时就会自动推到 Marketplace。

如果 secret 缺失，workflow 会打印 warning 但 GitHub Release 照常发出。所以你也可以事后手动补发：

```bash
npx @vscode/vsce publish --packagePath ezimage-1.0.4.vsix
```

## <span id="feedback"></span>🤝 贡献与反馈

如果您在使用过程中遇到任何问题，或者有功能建议，欢迎：
- 在 [GitHub Issue](https://github.com/keepwonder/ezimage/issues) 提交反馈。
- 加入我们的交流群进行深度讨论。

---

## 📞 联系与支持

### 💬 交流反馈
扫描下方二维码添加作者微信，请备注 **"EzImage"** 以便通过：

<div align="center">
  <img src="https://images.flashnote.top/contact/wechat_qr.png" width="200" alt="WeChat Contact" />
  <p><i>微信扫一扫，获取技术支持</i></p>
</div>

### ☕ 赞赏支持
如果 EzImage 提升了你的工作效率，欢迎请作者喝杯咖啡 ☕️！你的支持是我持续优化和维护的最大动力。

<div align="center">
  <table border="0">
    <tr>
      <td align="center">
        <img src="https://images.flashnote.top/donate/wechat_pay.png" width="200" alt="WeChat Pay" />
        <br />
        <b>微信打赏</b>
      </td>
      <td align="center">
        <img src="https://images.flashnote.top/donate/alipay_pay.png" width="200" alt="Alipay Pay" />
        <br />
        <b>支付宝打赏</b>
      </td>
    </tr>
  </table>
</div>

---

<p align="center">Developed with ❤️ by <a href="https://keepwonder.top"><b>Kiang</b></a></p>
