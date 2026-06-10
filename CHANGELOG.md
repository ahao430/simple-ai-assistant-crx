# CHANGELOG

## 0.2.4 - 2026-06-10

### Added

- 添加聊天、文案生成和图片生成输入框快捷键提示。
- 添加输入快捷键设置，可选择 `Enter` 发送或 `Command/Ctrl + Enter` 发送。
- WebDAV 备份和恢复支持同步 Agents 预设和应用设置。

### Fixed

- 修复聊天、文案生成和图片生成输入框中 `Command/Ctrl + Enter` 不换行的问题。
- 修复切换输入快捷键设置后侧边栏快捷键监听未立即刷新的问题。

## 0.1.0 - 2026-06-03

### Added

- 初始化 Chrome Manifest V3 扩展项目。
- 添加 Side Panel AI 聊天面板。
- 添加当前页面读取能力，支持读取标题、URL、选中文本和正文内容。
- 添加配置页，支持新增、编辑、删除多个大模型配置。
- 支持按能力配置模型：文本对话、视觉理解、图片生成、图片编辑。
- 支持聊天页切换文本模型和图片模型。
- 添加 OpenAI-compatible 文本聊天 Provider。
- 添加 OpenAI-compatible 图片生成和图片编辑 Provider，支持 `gpt-image-2` 等图片模型配置。
- 添加语雀 content script，支持编辑状态识别、编辑器读取、内容替换和图片插入尝试。
- 添加通用 content script，并改为按需动态注入以读取普通网页内容。
- 添加站点能力模型，为后续扩展更多网站预留适配架构。
- 添加 WebDAV 手动备份和恢复模型配置能力。
- WebDAV 备份支持包含 API Key，并在配置页提示安全风险。
- 添加扩展图标和 toolbar action 图标。

### Changed

- 构建配置使用 Vite 多入口输出 background、content scripts、sidepanel 和 options 页面。
- TypeScript module resolution 调整为 `Bundler`。
- Manifest 中 side panel 和 options page 路径调整为 Vite 实际输出路径。
- 通用页面读取脚本从 manifest 默认注入调整为 background 按需注入。

### Fixed

- 修复 TypeScript 构建中 `Array.prototype.with` 与 ES2022 lib 不兼容的问题。
- 修复 CSS side-effect import 类型声明缺失问题。
- 修复 Vite config 中 Node 类型缺失问题。
- 修复添加 WebDAV 类型时模型 Provider label 丢失的问题。
