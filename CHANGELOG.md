# Changelog

All notable changes to EzImage are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

### [1.0.3](https://github.com/keepwonder/ezimage/compare/v1.0.1...v1.0.3) (2026-09-09)


### 📚 Documentation

* add comprehensive extensions marketplace publishing guide ([338fe81](https://github.com/keepwonder/ezimage/commit/338fe8171e2905ca45f459b7df9b9c7ededce670))
* add direct organization management URL to avoid portal redirect ([1fe56d6](https://github.com/keepwonder/ezimage/commit/1fe56d6da805f349f897fa4341b3121af370458e))
* add link to author's website in footer ([77ea1c7](https://github.com/keepwonder/ezimage/commit/77ea1c7face1d227c8d92795f798efdfa4531504))
* clear distinction between Azure Portal and dev.azure.com ([983a12d](https://github.com/keepwonder/ezimage/commit/983a12d1e3920365b8d5c151d15c3c1f74a76265))
* improve Azure DevOps organization creation steps ([6b2c42b](https://github.com/keepwonder/ezimage/commit/6b2c42bfc11e29d65f75a43dbed89a8d31551eb7))
* sync user's feedback on Azure DevOps subscription and add screenshots ([71059fb](https://github.com/keepwonder/ezimage/commit/71059fbfbbfeafe804127f07423813f8c6197cd2))
* update README to reflect official Marketplace launch ([22d9112](https://github.com/keepwonder/ezimage/commit/22d9112b2214f24e5f96f23c4794792d214f400a))


### 🐛 Bug Fixes

* handle copied Finder image files on macOS ([0a52525](https://github.com/keepwonder/ezimage/commit/0a52525d90308007049afe8e59201ccf72df8e96))
* surface sharp load errors, auto-install on first use, and shrink VSIX 92% ([626bc09](https://github.com/keepwonder/ezimage/commit/626bc09d3565730db5a74c1fb4ca31f22098f849))


### 🔧 Continuous Integration

* **release:** extract release notes from CHANGELOG.md instead of auto-generating ([d333b18](https://github.com/keepwonder/ezimage/commit/d333b18fdb710f6e2a2784f10341447ce66283bf))

## 1.0.2

- Fixed Finder-copied image files being uploaded as generic file icons on macOS.
- Added support for resolving macOS file-reference URLs such as `file:///.file/id=...`.
- Preserved clipboard screenshot and plain-text image path uploads.

## 1.0.1

- Improved documentation and extension metadata.
