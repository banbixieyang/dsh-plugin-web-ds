# dsh-plugin-web-ds

把 **DeepSeek 网页版**（chat.deepseek.com）注册为 [DeepSeek Harness](https://github.com/deepseek-ai) 的一个 LLM provider（`web-ds`），让你在 DSH 里用网页版跑 Agent Loop，**不消耗官方 API token**。

## 它是怎么工作的

```
DSH Agent Loop
    ↓ ctx.llm.stream()
web-ds 适配器（本插件）
    ↓ 组装 prompt + 每次发送前审批
scripts/send_to_ds.py（pyautogui 模拟点击）
    ↓
Firefox → chat.deepseek.com
    ↓
ds_read.py 轮询读取回复
    ↓
解析 ```tool_call 块 → DSH tool-call chunks
    ↓
DSH 执行内置工具（read / write / pwsh / ...）
    ↓
工具结果回传，下一轮
```

设计要点：

- **复用你已有的 `ds_read.py`**（只负责读取，不发送）
- **自带发送脚本**，用 `pyautogui` 操作 Firefox
- **增量发送**：网页版自带会话记忆，每轮只发新增内容，不重发历史
- **一会话一映射**：DSH 每个 session 对应网页版一个独立对话
- **每次发送前审批**：通过 DSH 原生审批面板确认，避免误发和封号风险

## 前置条件

| 依赖 | 要求 |
|---|---|
| 系统 | **Windows**（依赖 pyautogui + pygetwindow） |
| DSH | 桌面客户端已安装 |
| 浏览器 | Firefox 已打开并登录 <https://chat.deepseek.com> |
| Python | 3.10+，且安装了 `pyautogui`、`pyperclip`、`pygetwindow` |
| Node.js | 18+，用于编译插件 |
| ds_read.py | 来自 [SKILL_web-ds-read](https://github.com/VZService/SKILL_web-ds-read) |

安装 Python 依赖：

```powershell
pip install pyautogui pyperclip pygetwindow
```

## 安装

### 1. 编译打包

```powershell
git clone https://github.com/banbixieyang/dsh-plugin-web-ds.git
cd dsh-plugin-web-ds
npm install
npm run build
npm pack
```

会生成 `dsh-plugin-web-ds-0.1.0.tgz`。

### 2. 修改 `cordis.patch.yml`

打开项目根目录的 `cordis.patch.yml`，把两个路径改成你自己的：

- `dsReadScript` → 你的 `ds_read.py` 绝对路径
- `pythonCommand` → 你的 Python 解释器绝对路径

### 3. 装进 DSH

**先完全关闭 DSH 桌面客户端。**

```powershell
& "C:\Users\<你>\AppData\Local\Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd" plugin --profile desktop add "C:\path\to\dsh-plugin-web-ds-0.1.0.tgz"
```

### 4. 合并 patch 到 profile

编辑 `%USERPROFILE%\.dsh\profiles\desktop\cordis.patch.yml`，把项目里 `cordis.patch.yml` 的内容追加进去，**同时**把默认模型改成 web-ds：

```yaml
- id: agent-default-model
  name: "@deepseek-ai/dsh-agent-default-model"
  config:
    provider: web-ds
    model: web-ds
```

### 5. 启动

打开 Firefox → 登录 chat.deepseek.com → 保持窗口可见 → 打开 DSH。

模型选择器里应该能看到 `web-ds`。选它，发一条消息测试。

## 配置项

在 `cordis.patch.yml` 的插件 `config` 里：

| 字段 | 默认 | 说明 |
|---|---|---|
| `dsReadScript` | 必填 | `ds_read.py` 绝对路径 |
| `sendScript` | `scripts/send_to_ds.py` | 发送脚本相对路径 |
| `pythonCommand` | `python` | Python 解释器绝对路径 |
| `pollIntervalMs` | `3000` | 轮询间隔（毫秒） |
| `replyTimeoutMs` | `240000` | 等待回复超时（毫秒） |
| `stableReadsRequired` | `4` | 连续几次读到一致内容才算回复完成 |
| `approvalEnabled` | `true` | 是否在发送前弹审批 |
| `approvalHeading` | `About to send...` | 审批卡片标题 |
| `approvalPreviewChars` | `2000` | 审批卡片预览字符数上限 |
| `failClosedWithoutApproval` | `true` | 无审批通道时拒绝发送 |

## 关于响应速度（重要）

**默认配置下，每条回复会有 10–30 秒的额外延迟**，即使网页版早已生成完毕。

原因：插件用的是**轮询**模式，需要连续读到相同内容才认为生成结束。

- `pollIntervalMs: 3000` × `stableReadsRequired: 4` = 至少 **12 秒**才认稳定
- 加上 Python 启动、pyautogui 模拟点击、页面渲染等待，实际每条 15–30 秒

### 这是有意为之

慢一点反而更安全 —— 大幅降低被网页版风控标记的概率。

### 想加速的话，调这两个参数

在 `cordis.patch.yml` 里改：

```yaml
pollIntervalMs: 1000        # 从 3000 改成 1000
stableReadsRequired: 2      # 从 4 改成 2
```

这两个一改，延迟从约 12 秒降到约 2 秒。

**风险**：轮询太快可能读到未生成完的片段；稳定次数太少可能把中间状态当成最终回复。**不建议低于 1000ms / 2 次**。

另外 `scripts/send_to_ds.py` 里也有一段等待（渲染时间）：

```python
wait = min(6.0, 1.2 + len(text) / 1000.0 * 0.4)
time.sleep(wait)
```

这一段控制"粘贴到输入框后等多久按回车"。如果网页版经常收到**残缺消息**，把这里的基数 `1.2` 调大。

## 已知限制

- **仅支持 Windows**（`pyautogui` + `pygetwindow` 依赖）
- **无 token 级流式**：整段回复一次性返回
- **单浏览器实例**：不能并发，两个会话同时发会排队
- **网页版有时不遵守工具协议**：会输出自然语言而非 ` ```tool_call ` 块，此时该轮会当成普通文本结束
- **图像输入不支持**
- **web_search 不可用**（依赖官方 API，需要单独配置）
- 每次发送需要人工审批，交互成本不低

## 免责声明

本项目是**非官方第三方插件**，与 DeepSeek 无关联。

通过浏览器自动化操作 DeepSeek 网页版**可能违反其服务条款**。请自行评估使用风险，包括但不限于账号限流或封禁。

## License

[MIT](LICENSE)

## 后续 TODO

- [ ] 按 DSH 实际 `LlmAdapter` / `StreamChunk` 类型微调 `web-ds-adapter.ts`。
- [ ] 把 ds-agent 协议解析为 tool-call 分片。
- [ ] 把本地文件/Shell 工具迁入 DSH。
- [ ] 接入 QQ（等你的作品）。
