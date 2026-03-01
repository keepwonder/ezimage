<div align="center">
  <img src="https://images.flashnote.top/2026/02/icon.png" width="128" alt="EzImage Logo" />
  <h1>EzImage</h1>
  <p><b>为 VS Code & AI-first IDEs 打造的极简、高效、支持多平台的图床上传插件</b></p>

  <p>
    <img src="https://img.shields.io/badge/Version-1.0.0-blue.svg" alt="Version" />
    <img src="https://img.shields.io/badge/Platform-macOS%20%7C%20Windows%20%7C%20Linux-brightgreen.svg" alt="Platform" />
    <img src="https://img.shields.io/badge/IDE-VS%20Code%20%7C%20Cursor%20%7C%20Windsurf%20%7C%20Trae-blueviolet.svg" alt="IDEs" />
    <img src="https://img.shields.io/badge/License-MIT-orange.svg" alt="License" />
  </p>

  <p>
    <a href="#✨-特性">特性</a> •
    <a href="#📦-安装">安装</a> •
    <a href="#⚙️-配置">配置</a> •
    <a href="#⌨️-快捷键">快捷键</a> •
    <a href="#🤝-贡献与反馈">反馈</a>
  </p>
</div>

---

**EzImage** 是一款专为 VS Code 深度定制的图床工具。它旨在解决 Markdown 创作中“存图难、贴图烦”的痛点，帮助你以最自然的方式（剪贴板粘贴、拖拽、右键菜单）完成图片上传并将 Markdown 链接一键插入文档。

## ✨ 特性

-   **🚀 多平台支持**: 采用 Provider 插件化架构，首发支持 Cloudflare R2，即将接入 AWS S3、阿里云 OSS、腾讯云 COS 等。
-   **📸 极致贴图体验**:
    *   **剪贴板上传**: `Cmd+Alt+V` (Mac) 或 `Ctrl+Alt+V` (Win/Linux) 瞬间完成上传并插入。
    *   **丝滑拖拽**: 直接从系统文件夹拖入图片，自动处理并生成链接。
-   **📉 智能图片引擎**: 内置 `sharp` 工业级处理引擎。
    *   自动转换为 **WebP** 格式，极致压缩体积且保持画质。
    *   支持自动尺寸调整（Max Width）和质量控制。
-   **📂 灵活的文件命名**: 支持丰富的变量模板，如 `{yyyy}/{MM}/{timestamp}-{random}.{ext}`，告别文件名冲突。
-   **📋 深度集成**: 提供编辑器右键上下文菜单，无需记忆复杂指令。

## 🚀 多编辑器支持

EzImage 不仅支持标准的 **VS Code**，还完美适配目前主流的 AI 代码编辑器及 VS Code 定制版：

-   **Cursor**: 直接兼容，性能卓越。
-   **Windsurf**: 全功能支持。
-   **Trae**: 字节跳动出品，完美适配。
-   **VSCodium**: 开源版 VS Code 同样适用。

## 📦 安装

### 方式 A：从 VSIX 安装（所有 IDE 通用）

1.  从 [GitHub Releases](https://github.com/keepwonder/ezimage/releases) 下载最新的 `.vsix` 文件。
2.  在您的编辑器中按 `Cmd+Shift+P` (Mac) / `Ctrl+Shift+P` (Win)，搜索 `Install from VSIX`。
3.  或者使用命令行安装：

| IDE | 命令行指令 |
| :--- | :--- |
| **VS Code** | `code --install-extension ezimage-1.0.0.vsix` |
| **Cursor** | `cursor --install-extension ezimage-1.0.0.vsix` |
| **Windsurf** | `windsurf --install-extension ezimage-1.0.0.vsix` |
| **Trae** | `trae --install-extension ezimage-1.0.0.vsix` |

### 方式 B：从 Marketplace

1.  在扩展市场中搜索 `EzImage` 即可一键安装（目前支持 VS Code Marketplace, Cursor Marketplace 等）。

## ⚙️ 配置

安装完成后，建议进行如下基础操作：

1. 按 `Cmd+Shift+P` (Mac) / `Ctrl+Shift+P` (Win) 唤起命令面板。
2. 搜索并运行 **`EzImage: Configure Settings`**。
3. 配置您的存储服务（以 Cloudflare R2 为例）：
   - **Provider**: `r2`
   - **Account ID**: 您的 API 令牌关联账户 ID
   - **Bucket Name**: 存储桶名称
   - **Access Key ID / Secret Access Key**: R2 访问密钥对
   - **Public URL**: 您的 Bucket 公网分发地址

## ⌨️ 快捷键

| 功能 | Mac 快捷键 | Windows/Linux 快捷键 |
| :--- | :--- | :--- |
| **上传剪贴板图片** | `Cmd + Alt + V` | `Ctrl + Alt + V` |
| **上传本地文件** | 命令面板搜索 `EzImage: Upload Image File` |

## 🗺️ 发展蓝图 (Roadmap)

- [x] Cloudflare R2 基础上传支持
- [x] 多格式图片自动转 WebP 压缩
- [ ] AWS S3 通用协议支持
- [ ] 阿里云 OSS、腾讯云 COS 接入
- [ ] Gitee/GitHub 图床模式
- [ ] 图片上传历史记录统计预览

## 🤝 贡献与反馈

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

<p align="center">Developed with ❤️ by <b>Kiang</b></p>