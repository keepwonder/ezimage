# EzImage

![EzImage Logo](https://images.flashnote.top/2026/02/icon.png)

**EzImage** 是一款为 VS Code 打造的极简、高效多平台图床上传插件。它可以帮助你在编辑 Markdown 时，无缝地将剪贴板图片、本地文件或通过拖拽的方式上传到云端存储（如 Cloudflare R2），并自动插入 Markdown 链接。

## ✨ 特性

-   🚀 **多平台支持**: 灵活架构，目前支持 Cloudflare R2，未来将接入 S3, 阿里云 OSS, 腾讯云 COS 等。
-   📸 **剪贴板上传**: 快捷键 `Cmd+Alt+V` (Mac) 或 `Ctrl+Alt+V` (Windows/Linux) 瞬间完成贴图。
-   🖱️ **拖拽上传**: 直接将图片文件拖入编辑器，自动完成上传并插入链接。
-   📉 **智能压缩**: 内置 `sharp` 引擎，支持自动转 WebP、调整尺寸及质量优化，极致节省空间。
-   📂 **自定义路径**: 支持 `{yyyy}/{MM}/{timestamp}` 等动态变量。
-   📋 **右键集成**: 深度集成编辑器菜单，操作极其自然。

## 📦 安装

1.  下载最新的 `.vsix` 文件。
2.  在 VS Code 中执行 `Extensions: Install from VSIX...`。
3.  或者使用命令行: `code --install-extension ezimage-1.0.0.vsix`。

## ⚙️ 配置

安装后，请按 `Cmd+Shift+P` 运行 **`EzImage: Configure Settings`**。

你需要配置以下信息（以 R2 为例）：

-   **Provider**: 选择 `r2`。
-   **Account ID**: 你的 Cloudflare 账户 ID。
-   **Access Key ID**: R2 的访问密钥 ID。
-   **Secret Access Key**: R2 的秘钥。
-   **Bucket Name**: 存储桶名称。
-   **Public URL**: 你的自定义域名或 R2 公网地址。

## ⌨️ 快捷键

-   **上传剪贴板图片**: `Cmd+Alt+V` (Mac) / `Ctrl+Alt+V` (Win/Linux)
-   - **上传本地文件**: 搜索命令 `EzImage: Upload Image File`

## 🤝 贡献与反馈

如果你有任何建议，欢迎在 GitHub 提交 Issue。

---

Developed with ❤️ by Kiang

---

## 📞 联系与支持

如果你觉得这个插件对你有帮助，欢迎通过以下方式联系我或给予支持。

### 💬 交流反馈

扫描下方二维码添加作者微信，请备注 **"EzImage"** 以便通过：

<div align="center">
  <img src="https://images.flashnote.top/contact/wechat_qr.png" width="200" alt="WeChat Contact" />
  <p>微信联系方式</p>
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