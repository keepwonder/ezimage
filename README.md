<div align="center">
  <img src="https://images.flashnote.top/2026/02/icon.png" width="128" alt="EzImage Logo" />
  <h1>EzImage</h1>
  <p><b>A Minimalist, Efficient Multi-Platform Image Uploader for VS Code & AI-first IDEs</b></p>

  <p>
    <img src="https://img.shields.io/github/v/release/keepwonder/ezimage?display_version=1.0.4&include_prereleases" alt="Version" />
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
    <a href="#troubleshooting">Troubleshooting</a> •
    <a href="#i18n">Languages</a> •
    <a href="#roadmap">Roadmap</a> •
    <a href="#feedback">Feedback</a>
  </p>
</div>

---

**EzImage** is a image uploader tool deeply customized for VS Code. It is designed to solve the pain points of "hard to save, annoying to paste" in Markdown creation, helping you upload images and insert Markdown links in the most natural way (clipboard paste, drag and drop, context menu).

> ⚠️ **Compression not working or upload looks broken?** Check the [🔧 Troubleshooting](#troubleshooting) section — most reported issues (sharp failing to load, public URL 404, missing R2 fields) have a known fix there.

## <span id="features"></span>✨ Features

-   **🚀 Multi-Platform Support**: Pluggable architecture, starting with Cloudflare R2, with AWS S3, Aliyun OSS, and Tencent COS coming soon.
-   **📸 Ultimate Pasting Experience**:
    *   **Clipboard Upload**: Press `Cmd+Alt+V` (Mac) or `Ctrl+Alt+V` (Win/Linux) to instantly upload and insert.
    *   **Smooth Drag & Drop**: Drag images directly from your folder into the editor for automatic uploading.
-   **📉 Intelligent Image Engine**: Powered by the industrial-grade `sharp` engine.
    *   Automatically convert images to **WebP** for maximum compression while maintaining quality.
    *   Supports automatic resizing (Max Width) and quality control.
    *   **Zero-config setup**: on first use, EzImage detects whether `sharp` is available and offers a one-click install of the native binary that matches your OS and Node.js ABI. If you prefer to skip compression, just toggle `ezimage.compress` off.
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

1.  Download the latest `.vsix` file from [GitHub Releases](https://github.com/keepwonder/ezimage/releases). Look for the file named `ezimage-X.Y.Z.vsix` under the latest release.
2.  Press `Cmd+Shift+P` (Mac) / `Ctrl+Shift+P` (Win) in your editor and search for `Install from VSIX`.
3.  Or use the command line, replacing `ezimage-X.Y.Z.vsix` with the actual filename you downloaded:

| IDE / Environment | Command |
| :--- | :--- |
| **VS Code** | `code --install-extension ezimage-X.Y.Z.vsix` |
| **Antigravity** | `antigravity --install-extension ezimage-X.Y.Z.vsix` |
| **Cursor** | `cursor --install-extension ezimage-X.Y.Z.vsix` |
| **Windsurf** | `windsurf --install-extension ezimage-X.Y.Z.vsix` |
| **Trae** | `trae --install-extension ezimage-X.Y.Z.vsix` |

### Method B: From Marketplace

1.  Search for `EzImage` in the extension marketplace and install it with one click.
2.  Or visit the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=kiang.ezimage) to install.

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

### All settings

Settings are listed in the order they appear in VS Code's Settings panel, which follows an explicit `order` property in `package.json`. Within each group, the read order matches the most common user workflow.

**Storage** — where uploaded images go
| Key | Default | Description |
| :--- | :--- | :--- |
| `ezimage.provider` | `r2` | Storage provider. Currently only `r2` is wired in; S3/OSS/COS are roadmap items. |
| `ezimage.r2.accountId` | `""` | Cloudflare Account ID. |
| `ezimage.r2.accessKeyId` | `""` | R2 access key ID. |
| `ezimage.r2.secretAccessKey` | `""` | R2 secret access key. |
| `ezimage.r2.bucketName` | `""` | R2 bucket name. |
| `ezimage.r2.publicUrl` | `""` | Public distribution URL, e.g. `https://pub-xxxx.r2.dev`. |
| `ezimage.pathTemplate` | `{yyyy}/{MM}/{timestamp}-{random}.{ext}` | Path template for uploaded objects. Available variables: `{yyyy}` `{MM}` `{dd}` `{hh}` `{mm}` `{ss}` `{timestamp}` `{random}` `{name}` `{ext}`. |

**Compression** — what happens to images before upload
| Key | Default | Description |
| :--- | :--- | :--- |
| `ezimage.compress` | `true` | Enable WebP compression before upload. |
| `ezimage.maxWidth` | `1920` | Maximum width in pixels; images wider than this are downscaled before encoding. Set to `0` to keep original dimensions. |
| `ezimage.quality` | `85` | WebP quality (1–100). Higher = larger files, better fidelity. |
| `ezimage.autoInstallSharp` | `true` | When `sharp` is missing, prompt to install the native binary on first use. Requires Node.js ≥ 18.17 and `npm` on `PATH`. |
| `ezimage.disableCompressionNotice` | `false` | Suppress the warning shown when the sharp compression engine is unavailable. |

**Insert format** — how the snippet appears in your Markdown
| Key | Default | Description |
| :--- | :--- | :--- |
| `ezimage.insertFormat` | `markdown` | How to render the inserted snippet. One of `markdown` / `html-wrap` / `html-figure` / `custom`. See [Insert format templates](#insert-format-templates). |
| `ezimage.insertWidth` | `100%` | Width attribute used in HTML templates (`{width}`). e.g. `65%`, `600px`, `auto`. Empty string omits the attribute. |
| `ezimage.insertAlign` | `none` | Alignment for HTML templates. `none` skips the wrapper `<div>`. |
| `ezimage.insertCustomTemplate` | `""` | Custom template used when `insertFormat = custom`. Variables: `{url}` `{filename}` `{name}` `{ext}` `{width}` `{align}` `{alt}`. |
| `ezimage.insertIncludeName` | `true` | Use the source filename as alt text / figcaption. |

**Language** — display language of prompts and info messages
| Key | Default | Description |
| :--- | :--- | :--- |
| `ezimage.language` | `auto` | Display language for EzImage prompts, errors, and info messages. `auto` follows VS Code's display language. Settings panel labels themselves always follow VS Code (not this setting). |

### Insert format templates

Three built-in presets cover the most common shapes:

| Format | With `insertAlign = center`, `insertWidth = 100%` | `insertAlign = none` |
| :--- | :--- | :--- |
| `markdown` | `![photo](https://pub.example.com/2026/09/photo-abc123.webp)` | *(same)* |
| `html-wrap` | `<div align="center"><img src="…" alt="photo" width="100%"></div>` | `<img src="…" alt="photo" width="100%">` (no wrapper) |
| `html-figure` | `<figure><img src="…" alt="photo" width="100%"><figcaption>photo</figcaption></figure>` | *(same — figure ignores `insertAlign`)* |

For full control, set `ezimage.insertFormat = custom` and define `ezimage.insertCustomTemplate` with any combination of variables:

| Variable | Resolves to |
| :--- | :--- |
| `{url}` | Public R2 URL after upload |
| `{filename}` | Full filename including extension, e.g. `photo.png` |
| `{name}` | Filename without extension, e.g. `photo` |
| `{ext}` | Extension without dot, e.g. `png` |
| `{width}` | `ezimage.insertWidth` value (empty → no width attribute) |
| `{align}` | `ezimage.insertAlign` value |
| `{alt}` | Alt text (filename, or `insertCustomAlt` when set) |

Unknown placeholders are left in place so a typo in your template stays visible instead of being silently dropped.

**One-shot override**: the command `EzImage: Upload Clipboard Image As…` lets you pick a different format for a single upload without changing the default. Bind it to a shortcut via *File → Preferences → Keyboard Shortcuts → search "ezimage.uploadClipboardAs"* if you want a dedicated key (e.g. `Ctrl+Alt+Shift+V`) for HTML-centered inserts.

### R2 setup walkthrough

For a step-by-step guide with screenshots covering Cloudflare R2 token creation, bucket configuration, and connecting it to EzImage, see [📘 Cloudflare R2 Setup Guide](docs/R2_GUIDE_CN.md).

For path template variables in detail, see [📝 Path Variables Manual](docs/VARIABLES_CN.md).

## <span id="hotkeys"></span>⌨️ Hotkeys

| Action | Mac Hotkey | Windows/Linux Hotkey |
| :--- | :--- | :--- |
| **Upload Clipboard Image** | `Cmd + Alt + V` | `Ctrl + Alt + V` |
| **Upload Local File** | Search command `EzImage: Upload Image File` |

## <span id="i18n"></span>🌐 Languages

EzImage ships with English and Simplified Chinese translations. The display language is controlled by `ezimage.language`:

| Value | Behaviour |
| :--- | :--- |
| `auto` (default) | Follows VS Code's display language. Chinese-locale users see 简体中文; everyone else sees English. |
| `en` | Force English regardless of VS Code locale. |
| `zh-CN` | Force Simplified Chinese. |

Language changes take effect immediately — no reload needed.

### What gets translated

Only the **runtime UI** that EzImage generates itself — prompts, error dialogs, the Output channel, the format-picker menu. Concretely:

- ✅ All `vscode.window.showErrorMessage` / `showWarningMessage` / `showInformationMessage` text
- ✅ All `vscode.window.showQuickPick` labels and descriptions (e.g. the "Insert this upload as…" picker)
- ✅ All text written to the Output → EzImage channel
- ✅ `vscode.window.withProgress` titles and progress messages
- ❌ The labels and descriptions in the **Settings panel** itself

### Why the Settings panel stays in English (or VS Code's language)

VS Code reads those strings from `package.json` and picks a translation only from the VS Code Marketplace's own `package.nls.<locale>.json` files, keyed by the VS Code **display language**, not the per-extension setting. There is no public API for an extension to override those strings at runtime.

In practice this is fine: the Settings panel labels describe *what* a setting does ("Maximum width for compressed images"), not *when* something failed. The user-facing runtime messages — which the user actually sees while uploading — are what `ezimage.language` controls.

If you want the *entire* VS Code UI in Chinese (including EzImage's settings panel), run `Configure Display Language` from the command palette and pick `中文 (简体)`. That's a VS Code-level switch, not EzImage's.

### Adding a new translation

1. Copy `l10n/bundle.json` to `l10n/<locale>.bundle.json` and translate the values (not the keys).
2. In `src/i18n.ts`, add the new locale code to `SupportedLocale` and `BUNDLES`.
3. Update `src/types.ts` / `package.json` enum so the language setting surfaces in the UI.
4. CI validates key parity automatically — `npm test` catches drift between bundles.

Translations are JSON, so no special tooling is needed. PRs welcome.

## <span id="troubleshooting"></span>🔧 Troubleshooting

### Images upload as the original file (WebP compression not working)

This is the most common issue and almost always means the `sharp` native module failed to load inside VS Code's bundled Node.js. Open the **Output → EzImage** panel (View → Output → EzImage) and look for one of these lines:

- `Compression engine unavailable: <error>` — `sharp` was found on disk but couldn't be loaded. The most likely cause is an **Electron/Node ABI mismatch**: VS Code ships with its own Node.js version, and the prebuilt binary you have may not match it. Click **"Reload Window"** after `npm install sharp` succeeds, or set `ezimage.autoInstallSharp: false` and reinstall manually with `npm rebuild sharp`.
- `Could not find npm on PATH` — `sharp` could not be auto-installed because `npm` isn't available. Install Node.js ≥ 18.17 from [nodejs.org](https://nodejs.org) (which includes `npm`), then click **"Install sharp"** again.
- `Auto-install exited with code N` — `npm install` itself failed. The Output panel will include a hint tailored to the failure (network/permissions/proxy). Common fixes:
  - **Corporate proxy**: set `NPM_CONFIG_REGISTRY` in your environment to your internal mirror.
  - **Permission denied**: the extension folder may be read-only. Reinstall the VSIX or move VS Code's extensions directory to a writable location.
  - **Network timeout**: run `npm install sharp` manually in a terminal from inside the extension folder (`~/.vscode/extensions/kiang.ezimage-X.Y.Z/`) and reload VS Code when it finishes.

If you previously chose **"不再提示"** (don't ask again), reset the flag with `ezimage.autoInstallSharp: true` in settings, then trigger any upload command.

If you just want to keep working without compression, set `ezimage.compress: false` — uploads will continue to work, just without WebP conversion.

### Upload succeeds but image URL returns 404

The object was uploaded but `ezimage.r2.publicUrl` doesn't match the bucket's actual public distribution URL. Check the **Custom Domains** tab of your R2 bucket and copy the **Public Bucket URL** (`https://pub-xxxx.r2.dev`) into the setting. Make sure the bucket itself has public access enabled.

### `Missing R2 Access Key ID` (or another "Missing R2 …" error)

Run `EzImage: Configure Settings` and fill in the field mentioned in the error. All five R2 fields (`accountId`, `accessKeyId`, `secretAccessKey`, `bucketName`, `publicUrl`) are required.

### Cmd/Ctrl+Alt+V doesn't paste anything

The command only fires inside Markdown files. Open a `.md` document, place the cursor where you want the image link, then press the shortcut. If you're still on macOS but pasted a Finder file (not a screenshot), the helper should detect the file reference and offer it; if it doesn't, check the **Output → EzImage** channel for the line `Using image path from clipboard text` or `Unable to read clipboard file reference`.

## <span id="roadmap"></span>🗺️ Roadmap

- [x] Cloudflare R2 basic support
- [x] Multi-format auto-conversion to WebP compression (with one-click `sharp` install since 1.0.3)
- [ ] Universal AWS S3 protocol support
- [ ] Aliyun OSS & Tencent COS support
- [ ] Gitee/GitHub image hosting mode
- [ ] Upload history and statistics preview

## <span id="development"></span>🛠️ Development

### Building from source

```bash
npm install            # install dependencies
npm run compile        # compile TypeScript to ./out/
npm run verify         # package a dev VSIX + run smoke tests
npm run package        # same as verify but keeps the .vsix on disk
npm run vsce:package   # package using the official @vscode/vsce
```

### Commit message conventions

This project follows [Conventional Commits](https://www.conventionalcommits.org/) so that
[`standard-version`](https://github.com/conventional-changelog/standard-version) can
auto-generate the changelog and pick the next version number:

| Type | Triggers version bump | Section in CHANGELOG |
| :--- | :--- | :--- |
| `feat:` | minor | ✨ Features |
| `fix:` | patch | 🐛 Bug Fixes |
| `perf:` | patch | ⚡ Performance |
| `refactor:` | — | ♻️ Refactors |
| `docs:` | — | 📚 Documentation |
| `build:` | — | 📦 Build System |
| `ci:` | — | 🔧 Continuous Integration |
| `chore:` / `style:` | — | hidden |

Breaking changes: append `!` after the type, e.g. `feat!: rewrite upload pipeline`. This
will bump the major version.

### Release process

```bash
# 1. Make sure conventional commits are in place since the last release
git log v1.0.3..HEAD --oneline

# 2. Run the release script — this bumps package.json, regenerates CHANGELOG.md,
#    and creates a single chore(release): X.Y.Z commit. Tag is NOT created yet
#    so you can review the diff first.
./scripts/release.sh patch      # or minor / major

# 3. Inspect the changes, push the commit, then tag and push the tag
git push
git tag v1.0.4
git push origin v1.0.4

# 4. The GitHub Actions release workflow automatically:
#    - packages the VSIX with the official @vscode/vsce
#    - smoke-tests it (AWS SDK must require correctly)
#    - extracts release notes from CHANGELOG.md
#    - attaches the .vsix to a GitHub Release
#    - if VSCE_PAT is configured, also publishes to the VS Code Marketplace
```

A dry run is available without modifying anything:

```bash
./scripts/release.sh --dry
```

#### Publishing to the VS Code Marketplace

The release workflow calls `vsce publish` automatically — but only if a `VSCE_PAT` secret is configured in the repo (Settings → Secrets and variables → Actions). Without it the VSIX is still attached to the GitHub Release, just not pushed to the Marketplace.

To enable automatic Marketplace publishing:

1. Sign in to [dev.azure.com](https://dev.azure.com) using the same Microsoft account that owns the `kiang` publisher on the Marketplace.
2. User settings → Personal Access Tokens → New Token.
3. Scopes: **Marketplace (Manage)** — this is the only scope publish needs.
4. Copy the token, then in this repo go to Settings → Secrets and variables → Actions → New repository secret:
   - Name: `VSCE_PAT`
   - Value: the token
5. The next tagged release will publish automatically.

If the secret is missing the release workflow logs a warning and the GitHub Release still goes out — so you can also publish manually afterward with:

```bash
npx @vscode/vsce publish --packagePath ezimage-1.0.4.vsix
```

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

<p align="center">Developed with ❤️ by <a href="https://keepwonder.top"><b>Kiang</b></a></p>
