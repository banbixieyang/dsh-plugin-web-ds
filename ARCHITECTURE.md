# 架构说明（精简版）

## 核心结论

**只做一件事：替换模型层。工具执行全部交给 DSH 内置工具。**

## 为什么不需要 local-tools

DSH 出厂已内置完善的本地操作工具链：

| 类别 | 内置工具 |
|---|---|
| 文件 | `read` / `write` / `edit` / `glob` / `grep` |
| 命令 | `bash` / `pwsh` |
| 网络 | `web_search` / `web_fetch` |
| 协作 | `ask_user_question` / `todo_write` / `job_*` |
| 智能体 | `subagent` / `workflow` / `skill` |

这些工具比原 `filesystem.py` / `shell.py` 更完善，且由 DSH 统一管理按需加载。
用户做插件的目的是**省 token**，不是补 DSH 的短板，所以不需要重造工具层。

## 数据流

```
用户消息
   ↓
DSH Agent Loop
   ↓
[web-ds 适配器] ← 接收 options.messages 和 options.tools
   ↓ 增量：只发最后一条 user 消息 + 上轮工具结果 + 工具列表文本
   ↓ 发送审批（每次必过）
   ↓
Firefox → chat.deepseek.com
   ↓ 轮询 ds_read.py 取回复
   ↓ 解析 <tool_call> 标记
   ↓
tool-call 分片 → DSH
   ↓
DSH 内置工具执行（read / write / bash / ...）
   ↓
工具结果 → 回灌适配器
   ↓
下一轮增量发送
```

## 协议：为什么不用 ds-agent

原 `app.py` 定义了一套 `ds-agent` 协议。现在不用了，原因：

1. **DSH 有自己的工具调用格式**：`{ type: 'tool-call', id, name, arguments }`
2. **DSH 的工具名是内置的**：`read` / `write` / `bash` / `glob` / ...
3. **适配器的职责是把 DSH 的工具 schema 透传给 DeepSeek**，让 DeepSeek 用 DSH 的工具名和参数输出 tool-call

所以新协议是：

```
<tool_call>
{"name": "read", "arguments": {"file_path": "foo.py"}}
</tool_call>
```

比 ds-agent 更简单，也更贴合 DSH 原生语义。

## 审批

只有一处审批：**发送到网页版之前**。

- 工具执行不审批（DSH 内置工具自带权限模型）
- 文件写入不审批（不需要额外备份，DSH 有自己的机制）

## 与旧 app.py 的对应

| 旧模块 | 现状 |
|---|---|
| `bridge/deepseek.py` | → `src/bridge/ds-read-bridge.ts` + `scripts/send_to_ds.py` |
| `executor/protocol.py` | 废弃，改用 `<tool_call>` 标记 |
| `executor/runner.py` | 废弃，DSH 内置工具接管 |
| `executor/loop.py` | 废弃，DSH Agent Loop 接管 |
| `tools/filesystem.py` | 废弃，DSH 内置 `read` / `write` / `edit` / `glob` / `grep` |
| `tools/shell.py` | 废弃，DSH 内置 `bash` / `pwsh` |
| `core/approval.py` | → `src/approval/send-approval.ts`（只保留发送审批） |

## 文件清单

- `src/index.ts` —— 插件入口，注册适配器
- `src/adapter/web-ds-adapter.ts` —— 核心：流式产出 StreamChunk
- `src/adapter/incremental-sender.ts` —— 增量发送
- `src/adapter/tool-prompt-builder.ts` —— 工具列表 → 文本提示
- `src/bridge/ds-read-bridge.ts` —— 封装 ds_read.py
- `src/bridge/click-sender.ts` —— 封装 send_to_ds.py
- `src/approval/send-approval.ts` —— 终端发送审批（兜底）
- `src/qq/qq-bridge.ts` —— ⏳ QQ 接入预留
- `scripts/send_to_ds.py` —— pyautogui 模拟点击发送
