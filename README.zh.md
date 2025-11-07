# TITAN FORGE SF IG/FB Engagement Extension（中文指南）

## 项目简介
- 这是一款基于 Chrome Manifest V3 与 TypeScript 的弹窗式扩展，帮助社媒团队在 IG/FB 上生成符合品牌调性的评论或私信回复。
- 插件只运行在本地：截图、模式/语料选择、API Key 输入、候选内容生成都在浏览器弹窗内完成。
- 支持 3 个候选回复一键插入编辑器，再复制到原帖或对话框。

## 核心特性
- **多模式语料**：针对不同互动场景（如评论、DM 等）加载默认语料，可手动覆盖为自定义 JSON。
- **截图上下文**：弹窗内最多保存 8 张最新截图，超宽图自动等比压缩至 2000px 内。
- **模型级联**：默认调用 `gpt-5`，失败时依次回退到 `gpt-5-mini`、`gpt-4o`，并在 UI 中提示。
- **隐私友好**：所有数据仅存在本地 IndexedDB，截图可选模糊化；不包含遥测或额外网络请求。
- **长度与内容安全**：评论自动限制 220 字符，私信限制 600 字符；如用户未主动要求，系统提示会避免输出价格信息。

## 目录结构速览
- `src/manifest.json`：MV3 主清单。
- `src/popup/`：弹窗 UI（`popup.html`、`popup.ts`、`styles.css`）。
- `src/state/`：IndexedDB 封装与每标签页会话管理。
- `src/capture/`：截图及压缩工具函数。
- `src/openai/`：OpenAI 客户端，规范调用参数与候选整形。
- `src/corpora/loader.ts`：语料 JSON 加载&校验逻辑，含默认映射。
- `corpus/`：可编辑的 5 份示例语料。
- `dist/`：构建输出，供 Chrome “加载已解压的扩展程序”。

## 快速开始
1. **安装依赖**
   ```bash
   npm install
   ```
2. **构建产物**
   ```bash
   npm run build
   ```
   - 构建脚本会复制 manifest、HTML/CSS、语料，并将 TypeScript 编译为 `dist/` 目录下的 JS。
3. **加载扩展**
   - 打开 `chrome://extensions`，右上角开启开发者模式。
   - 点击“加载已解压的扩展程序”，选择仓库中的 `dist/` 目录。

## 使用流程
1. **打开弹窗**：在任一 IG/FB 页面点击扩展图标，弹出主界面。
2. **选择模式 & 模型**：
   - 模式用于匹配默认语料，每次只能选择一个。
   - 模型默认 `gpt-5`，如需更低成本可改为其他选项。
3. **管理语料**：保持默认语料或输入自定义 JSON 路径/URL；无效 JSON 会在 UI 中报错。
4. **手动提示词**：可在“Manual Prompt”区域补充额外写作指令，提升定制度。
5. **截图上下文**：
   - 点击“Capture”抓取当前标签页视图，最多 8 张，可拖动排序或删除。
   - 宽度超过 2000px 的截图会自动压缩，以减少请求体积。
   - 可勾选“Blur”在上传前套用轻度模糊保护隐私。
6. **填写 OpenAI API Key**：
   - 仅存活于当前弹窗内存，不写入磁盘；关闭弹窗后需重新输入。
7. **生成候选**：
   - 点击“Send”后同一标签页仅允许一个并发请求。
   - 失败时自动尝试回退模型，UI 会提示当前使用的模型。
8. **采纳结果**：
   - 返回 3 条候选；可点击“Insert to composer”插入到合成器中做二次编辑。
   - 完成后点击“Copy”复制粘贴到 IG/FB。

## 常见问题与排查
- **网络/鉴权失败**：确认 API Key 有效且组织允许访问 `https://api.openai.com`；如企业网限制，可在浏览器/代理层放行。
- **语料无效**：自定义 JSON 需符合 `src/corpora/loader.ts` 中的 schema，格式错误会直接在 UI 显示。
- **超长文本被截断**：UI 会在发送前自动裁剪至评论 220 字符、私信 600 字符，必要时适当缩短提示和截图数量。
- **截图过多/过大**：超过 8 张会提示删除；若出现 payload 过大警告，请删除或压缩部分截图。
- **OpenAI 接口变更**：当前使用 `/v1/responses`。若组织使用其他端点/参数，请在 `src/openai/client.ts` 中调整 `callOpenAI` 实现。

## 隐私与权限
- 所需权限：`activeTab`、`tabs`、`storage`、`scripting`、`clipboardWrite` 以及 `https://api.openai.com/*` Host 权限。
- Content Security Policy 仅允许对 OpenAI 的 `connect-src`，无额外外联。
- 不收集遥测数据；截图、语料配置及 API Key 均留在浏览器本地。

## 开发者提示
- 修改代码后重新执行 `npm run build`，再在扩展管理页点击“重新加载”。
- 若需扩展 IndexedDB 结构，可在 `src/state` 中调整 `PerTabSession`，但建议保持“每标签页隔离”策略。
- Chrome 的 Activity Log 能帮助调试截图、脚本与网络请求。
- 贡献自定义语料时，建议将 JSON 存于 `corpus/` 并保持与模式命名一致，以免 UI 中难以区分。

