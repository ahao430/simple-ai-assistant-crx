# 简洁AI助手（Simple AI Assistant）

简洁AI助手 是一个 Chrome Manifest V3 扩展，以 Side Panel 形式提供页面感知的 AI 聊天能力，并针对语雀、大业管和海星页面提供站点增强操作。

## 主要能力

- Side Panel AI 聊天面板。
- 读取当前页面标题、URL、选中文本和正文内容，并结合页面上下文对话。
- 支持配置多个大模型，并在聊天页按能力切换模型。
- 支持文本、视觉、图片生成和图片编辑能力标签。
- 支持 OpenAI-compatible 文本聊天接口。
- 支持 OpenAI-compatible 图片生成和图片编辑接口，例如 `gpt-image-2`。
- 支持配置页管理模型配置。
- 支持 WebDAV 手动备份和恢复模型配置。
- 支持扩展图标和工具栏图标。

## 站点增强

### 语雀

支持公司语雀和公有语雀域名：

- `https://gy19pay.yuque.com/*`
- `https://www.yuque.com/*`

当前能力：

- 识别语雀编辑状态。
- 读取编辑器内容。
- 替换编辑器内容。
- 尝试插入生成或编辑后的图片。

### 大业管 / 海星

大业管域名：

- `https://fmanage-dev.19ego.cn/*`
- `https://fmanage-test.19ego.cn/*`
- `https://fmanage.19ego.cn/*`

海星 iframe 域名：

- `https://haixing-admin-v2-dev.19ego.cn/*`
- `https://haixing-admin-v2-test.19ego.cn/*`
- `https://haixing-admin-v2.19ego.cn/*`

当前能力：

- 识别大业管页面中的海星 iframe。
- 在海星页面读取可能的 schema/config JSON 内容。
- 尝试写回首个可识别的 JSON 配置区域。
- 图片上传能力已预留，后续需要接入真实上传接口或页面上传控件。

## 配置与数据存储

模型配置保存在扩展自己的 `chrome.storage.local` 中，不是网页 `localStorage`。

模型配置包含：

- 显示名称
- Provider
- 模型 ID
- Base URL
- API Key
- 能力标签
- 默认模型设置
- 启用状态

WebDAV 配置也保存在 `chrome.storage.local` 中。WebDAV 备份文件会包含模型配置和 API Key，请确认 WebDAV 服务可信且账号安全。

## WebDAV 备份

配置页支持：

- 保存 WebDAV 地址、用户名、密码和备份文件路径。
- 测试 WebDAV 连接。
- 手动立即备份当前模型配置。
- 从备份恢复并覆盖本地模型配置。

默认备份路径：

```text
/gy-ai-crx/model-configs.json
```

## 开发

安装依赖：

```bash
npm install
```

开发模式：

```bash
npm run dev
```

构建扩展：

```bash
npm run build
```

构建产物输出到 `dist/`，可在 Chrome 扩展管理页加载该目录。

## 项目结构

```text
src/
  background/      Background service worker、模型配置存储、WebDAV、Provider 调度
  content/         通用页面、语雀、大业管、海星 content scripts
  options/         配置页
  providers/       AI Provider adapters
  shared/          共享类型、消息协议、工具函数
  sidepanel/       Side Panel 聊天 UI
  sites/           站点适配定义
public/
  manifest.json    Chrome 扩展 manifest
  icons/           扩展图标
```

## 注意事项

- 当前语雀编辑器写入和图片插入依赖页面 DOM 行为，需要在真实语雀页面继续联调。
- 当前海星配置读取和写回是基于页面中可识别 JSON 内容的初版实现，后续应接入真实页面状态或接口。
- Anthropic provider 已预留，但尚未实现真实 API 调用。
- WebDAV 备份不会自动创建不存在的父目录。
