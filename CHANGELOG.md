# Changelog

All notable changes to EzImage are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

本文件记录 EzImage 的所有重要变更。格式遵循 [Keep a Changelog](https://keepachangelog.com/zh-cn/1.1.0/) ，本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/spec/v2.0.0.html)。

### [1.1.1](https://github.com/keepwonder/ezimage/compare/v1.1.0...v1.1.1) (2026-09-10)


### 🐛 Bug Fixes / 问题修复

* **drop,sharp:** rewrite drag-and-drop flow + cancel upload when sharp installs ([2f9bbcb](https://github.com/keepwonder/ezimage/commit/2f9bbcbcdb4ea8a54d3703bf076c86bebf866d14))

## [1.1.0](https://github.com/keepwonder/ezimage/compare/v1.0.4...v1.1.0) (2026-09-10)


### ✨ Features / 新功能

* **local-upload:** convert local image paths to cloud URLs in Markdown ([b7f00ca](https://github.com/keepwonder/ezimage/commit/b7f00ca32ef3453482f2f7db5932c224e8870f7e))


### 📚 Documentation / 文档

* **readme:** document local-image conversion + rename commands ([6e26f07](https://github.com/keepwonder/ezimage/commit/6e26f0761e607c2c4331dd44b325cac58d182b81))
* **readme:** sync version badge to 1.0.4 + use GitHub release API ([785ef09](https://github.com/keepwonder/ezimage/commit/785ef0931e2b96889acb4184fbc31b36b291ecff))

## [1.0.4] - 2026-09-09

### ✨ Features / 新功能

- **insert:** configurable insert format templates — Markdown / HTML wrap / HTML figure / custom ([923631b](https://github.com/keepwonder/ezimage/commit/923631b1d92b4731d67243d292104b0cb764e2c4))
- **insert:** rename `html-center` preset to `html-wrap` to reflect that alignment is no longer hard-coded to center, and is now controlled by `ezimage.insertAlign`. The old value `html-center` continues to work as a deprecated alias. ([d695c97](https://github.com/keepwonder/ezimage/commit/d695c97cf4c9f6f5c0c439d9b4a914a0ad6bf737))
- **i18n:** runtime translation infrastructure — prompts, errors, and Output channel messages follow `ezimage.language` (default: `auto` → tracks VS Code display language). English and Simplified Chinese bundles ship in `l10n/`. ([fe305a9](https://github.com/keepwonder/ezimage/commit/fe305a9a5b2a22823aabe744f0a018fe08afb537))

### 🔄 Changed / 行为变更

- **settings:** settings panel re-organised into four logical groups (Storage → Compression → Insert format → Language), with explicit `order` properties so VS Code respects the intended reading order (it falls back to lexicographic sort otherwise). ([89952a0](https://github.com/keepwonder/ezimage/commit/89952a01bc3e7fa5962c9e79d5f5b5037374e586), [f784e6f](https://github.com/keepwonder/ezimage/commit/f784e6f4cfafab1cf461877c90e7257efeebba2d), [ae9f965](https://github.com/keepwonder/ezimage/commit/ae9f965ecd7f627aa9c664202a3b756318b95e4a), [2cb0793](https://github.com/keepwonder/ezimage/commit/2cb07930eb6fba62aee173bc55d9f112f4662b59))
- **insert:** `html-wrap` + `align: none` now produces a bare `<img>` with no `<div>` wrapper, instead of the previous nonsensical `<div align="none">`. The preset is now decoupled from alignment: pick the format for structure, pick `insertAlign` for layout.

### 🐛 Bug Fixes / 问题修复

- **i18n:** language setting changes now take effect immediately on the next message instead of requiring a window reload. ([4ca3068](https://github.com/keepwonder/ezimage/commit/4ca3068378c0d3a2c866289858f40884a207968f))
- **i18n:** reverted the VS Code NLS bundle approach — settings panel labels cannot follow a per-extension setting in VS Code, so the `package.nls.*` files were removed and only the runtime `l10n/` bundle remains. ([1c01475](https://github.com/keepwonder/ezimage/commit/1c01475e85f455f939c174a7d81a86c6d40af144))

### ♻️ Refactors / 重构

- **insert:** dropped the `html-center` deprecated alias entirely — no users were relying on it, the alias added dead code and noise to the settings UI. ([bec8ccc](https://github.com/keepwonder/ezimage/commit/bec8ccc1cd0b356cdd08f886244a889369652e19))

### 📚 Documentation / 文档

- **readme:** synced with v1.0.3 features and added Troubleshooting section. ([e031616](https://github.com/keepwonder/ezimage/commit/e031616091be8c0ffdbf0d044e8631589ee89004))

### 🔧 Continuous Integration / CI

- VS Code NLS bundle validation step.
- macOS / Windows Python3 shim for cross-platform smoke tests.

---

## [1.0.3] - 2026-09-09

### 📚 Documentation

- add comprehensive extensions marketplace publishing guide ([338fe81](https://github.com/keepwonder/ezimage/commit/338fe8171e2905ca45f459b7df9b9c7ededce670))
- add direct organization management URL to avoid portal redirect ([1fe56d6](https://github.com/keepwonder/ezimage/commit/1fe56d6da805f349f897fa4341b3121af370458e))
- add link to author's website in footer ([77ea1c7](https://github.com/keepwonder/ezimage/commit/77ea1c7face1d227c8d92795f798efdfa4531504))
- clear distinction between Azure Portal and dev.azure.com ([983a12d](https://github.com/keepwonder/ezimage/commit/983a12d1e3920365b8d5c151d15c3c1f74a76265))
- improve Azure DevOps organization creation steps ([6b2c42b](https://github.com/keepwonder/ezimage/commit/6b2c42bfc11e29d65f75a43dbed89a8d31551eb7))
- sync user's feedback on Azure DevOps subscription and add screenshots ([71059fb](https://github.com/keepwonder/ezimage/commit/71059fbfbbfeafe804127f07423813f8c6197cd2))
- update README to reflect official Marketplace launch ([22d9112](https://github.com/keepwonder/ezimage/commit/22d9112b2214f24e5f96f23c4794792d214f400a))

### 🐛 Bug Fixes

- handle copied Finder image files on macOS ([0a52525](https://github.com/keepwonder/ezimage/commit/0a52525d90308007049afe8e59201ccf72df8e96))
- surface sharp load errors, auto-install on first use, and shrink VSIX 92% ([626bc09](https://github.com/keepwonder/ezimage/commit/626bc09d3565730db5a74c1fb4ca31f22098f849))

### 🔧 Continuous Integration

- **release:** extract release notes from CHANGELOG.md instead of auto-generating ([d333b18](https://github.com/keepwonder/ezimage/commit/d333b18fdb710f6e2a2784f10341447ce66283bf))

---

## 1.0.2

- Fixed Finder-copied image files being uploaded as generic file icons on macOS.
- Added support for resolving macOS file-reference URLs such as `file:///.file/id=...`.
- Preserved clipboard screenshot and plain-text image path uploads.

## 1.0.1

- Improved documentation and extension metadata.
