<div align="center">
  <img src="https://images.flashnote.top/2026/02/icon.png" width="128" alt="EzImage Logo" />
  <h1>EzImage</h1>
  <p><b>A Minimalist, Efficient Multi-Platform Image Uploader for VS Code & AI-first IDEs</b></p>

  <p>
    <img src="https://img.shields.io/badge/Version-1.0.0-blue.svg" alt="Version" />
    <img src="https://img.shields.io/badge/Platform-macOS%20%7C%20Windows%20%7C%20Linux-brightgreen.svg" alt="Platform" />
    <img src="https://img.shields.io/badge/IDE-VS%20Code%20%7C%20Antigravity%20%7C%20Cursor%20%7C%20Windsurf%20%7C%20Trae-blueviolet.svg" alt="IDEs" />
    <img src="https://img.shields.io/badge/License-MIT-orange.svg" alt="License" />
  </p>

  <p>
    <b>English</b> | <a href="README_CN.md">简体中文</a>
  </p>

  <p>
    <a href="#features">Features</a> •
    <a href="#ides">Supporting IDEs</a> •
    <a href="#install">Installation</a> •
    <a href="#config">Configuration</a> •
    <a href="#hotkeys">Hotkeys</a> •
    <a href="#roadmap">Roadmap</a> •
    <a href="#feedback">Feedback</a>
  </p>
</div>

---

**EzImage** is a image uploader tool deeply customized for VS Code. It is designed to solve the pain points of "hard to save, annoying to paste" in Markdown creation, helping you upload images and insert Markdown links in the most natural way (clipboard paste, drag and drop, context menu).

## <span id="features"></span>✨ Features

-   **🚀 Multi-Platform Support**: Pluggable architecture, starting with Cloudflare R2, with AWS S3, Aliyun OSS, and Tencent COS coming soon.
-   **📸 Ultimate Pasting Experience**:
    *   **Clipboard Upload**: Press `Cmd+Alt+V` (Mac) or `Ctrl+Alt+V` (Win/Linux) to instantly upload and insert.
    *   **Smooth Drag & Drop**: Drag images directly from your folder into the editor for automatic uploading.
-   **📉 Intelligent Image Engine**: Powered by the industrial-grade `sharp` engine.
    *   Automatically convert images to **WebP** for maximum compression while maintaining quality.
    *   Supports automatic resizing (Max Width) and quality control.
-   **📂 Flexible Naming**: Support rich template variables like `{yyyy}/{MM}/{timestamp}-{random}.{ext}` to avoid file name conflicts.
-   **📋 Deep Integration**: Provides editor context menus for a natural workflow.

## <span id="ides"></span>🚀 Multi-IDE Support

EzImage not only supports standard **VS Code**, but also perfectly adapts to current mainstream AI code editors:

-   **Antigravity**: Deeply adapted, the preferred environment for AI-assisted development.
-   **Cursor**: Native compatibility with excellent performance.
-   **Windsurf**: Full feature support.
-   **Trae**: Perfectly compatible, powered by ByteDance.
-   **VSCodium**: Also works for the open-source version of VS Code.

## <span id="install"></span>📦 Installation

### Method A: Install from VSIX (Recommended)

1.  Download the latest `.vsix` file from [GitHub Releases](https://github.com/keepwonder/ezimage/releases).
2.  Press `Cmd+Shift+P` (Mac) / `Ctrl+Shift+P` (Win) in your editor and search for `Install from VSIX`.
3.  Or use the command line:

| IDE / Environment | Command |
| :--- | :--- |
| **VS Code** | `code --install-extension ezimage-1.0.0.vsix` |
| **Antigravity** | `antigravity --install-extension ezimage-1.0.0.vsix` |
| **Cursor** | `cursor --install-extension ezimage-1.0.0.vsix` |
| **Windsurf** | `windsurf --install-extension ezimage-1.0.0.vsix` |
| **Trae** | `trae --install-extension ezimage-1.0.0.vsix` |

### Method B: From Marketplace (Coming Soon)

1.  Search for `EzImage` in the extension marketplace and install it with one click.
2.  Currently under review, stay tuned.

## <span id="config"></span>⚙️ Configuration

After installation, follow these steps to configure:

1. Press `Cmd+Shift+P` (Mac) / `Ctrl+Shift+P` (Win) to open the command palette.
2. Search and run **`EzImage: Configure Settings`**.
3. Configure your storage service (e.g., Cloudflare R2):
   - **Provider**: `r2`
   - **Account ID**: Your Cloudflare Account ID
   - **Bucket Name**: Your storage bucket name
   - **Access Key ID / Secret Access Key**: R2 API credentials
   - **Public URL**: Your bucket's public distribution URL

## <span id="hotkeys"></span>⌨️ Hotkeys

| Action | Mac Hotkey | Windows/Linux Hotkey |
| :--- | :--- | :--- |
| **Upload Clipboard Image** | `Cmd + Alt + V` | `Ctrl + Alt + V` |
| **Upload Local File** | Search command `EzImage: Upload Image File` |

## <span id="roadmap"></span>🗺️ Roadmap

- [x] Cloudflare R2 basic support
- [x] Multi-format auto-conversion to WebP compression
- [ ] Universal AWS S3 protocol support
- [ ] Aliyun OSS & Tencent COS support
- [ ] Gitee/GitHub image hosting mode
- [ ] Upload history and statistics preview

## <span id="feedback"></span>🤝 Contribution & Feedback

If you encounter any issues or have feature suggestions, please:
- Submit an issue on [GitHub Issues](https://github.com/keepwonder/ezimage/issues).
- Join our discussion group for deep conversations.

---

## 📞 Contact & Support

### 💬 Feedback
Scan the QR code below to add the author on WeChat, please mention **"EzImage"**:

<div align="center">
  <img src="https://images.flashnote.top/contact/wechat_qr.png" width="200" alt="WeChat Contact" />
  <p><i>Scan to get technical support</i></p>
</div>

### ☕ Support the Author
If EzImage has improved your efficiency, feel free to buy me a coffee! Your support is my greatest motivation for optimization and maintenance.

<div align="center">
  <table border="0">
    <tr>
      <td align="center">
        <img src="https://images.flashnote.top/donate/wechat_pay.png" width="200" alt="WeChat Pay" />
        <br />
        <b>WeChat Pay</b>
      </td>
      <td align="center">
        <img src="https://images.flashnote.top/donate/alipay_pay.png" width="200" alt="Alipay Pay" />
        <br />
        <b>Alipay Pay</b>
      </td>
    </tr>
  </table>
</div>

---

<p align="center">Developed with ❤️ by <b>Kiang</b></p>
