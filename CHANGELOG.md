# CHANGELOG

## 0.2.5 - 2026-06-13

### Added

- 添加 AI GIF 生成功能，支持完整的动画生成工作流。
  - 自动优化用户提示词，生成适合序列帧的专业英文描述。
  - 使用图像模型生成网格布局的序列帧图片。
  - 智能切割图片，提取单独的动画帧。
  - 使用 gif.js 合成最终 GIF 动画。
  - 支持 3-16 帧可调，使用滑块直观控制。
  - 支持上传参考图片。
- 添加 GIF 生成历史记录功能。
  - 使用 IndexedDB 本地存储 GIF 文件和元数据。
  - 显示历史 GIF 网格，包含预览图、提示词和帧数。
  - 支持查看和删除历史记录。
  - 自动限制保留最近 30 条记录。
- 新增左右布局展示 GIF 生成过程和最终结果。
  - 左侧显示优化后的提示词、序列帧图片和切割后的帧。
  - 右侧固定显示最终 GIF 和操作按钮。
- GIF 支持一键复制到剪贴板和下载。

### Changed

- 数据库版本升级到 v2，新增 `gifGenerations` 和 `gifBlobs` 存储。
- 历史统计功能包含 GIF 数据。

### Fixed

- 修复 GIF 生成中的异步消息通道错误。
  - 将流式 `chat:stream` 改为同步 `chat:send` 请求。
  - 优化错误处理，提供清晰的错误提示。

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
