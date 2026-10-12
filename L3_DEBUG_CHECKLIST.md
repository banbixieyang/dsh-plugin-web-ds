# L3 调试信息收集清单

跑一次纯文本对话（L3），把下面这些东西收集齐，我才能把适配器从「推测」变成「确定」。

---

## 一、启动阶段

### 1. 桌面客户端用哪个 profile？

打开 PowerShell，运行：

```powershell
ls $env:USERPROFILE\.dsh\profiles\
```

期望看到 `desktop` 和（可能）`web` 两个目录。

**要贴给我的**：这个目录列表。

### 2. 插件是否挂载到 desktop profile？

```powershell
cat $env:USERPROFILE\.dsh\profiles\desktop\cordis.patch.yml
ls $env:USERPROFILE\.dsh\profiles\desktop\node_modules\ | Select-String dsh
```

**要贴给我的**：
- `cordis.patch.yml` 的完整内容
- `node_modules` 里跟 dsh 相关的条目

---

## 二、启动后的控制台输出

桌面客户端启动时，通常有一个「开发者控制台」或「日志」窗口。找到它，把从启动到第一次发送之间的全部输出复制下来。

**特别关注这几类行**：

- 包含 `[web-ds]` 或 `[tool-prompt-builder]` 的行
- 包含 `ERR_` 开头的行（比如 `ERR_REQUIRE_ESM`）
- 包含 `cannot get property` 的行（常见于 inject 缺失）
- 包含 `Cannot find module` 的行

**要贴给我的**：完整输出，不要筛选。

---

## 三、发送一次消息后

在 DSH UI 里发一条：

```
你好，只回复"收到"两个字。
```

### 1. 终端/控制台新出现的输出

期望看到：

- `[tool-prompt-builder] 第一次收到 tools，数量=N`
- `[tool-prompt-builder] 第一个工具的原始结构：{...}`
- `[tool-prompt-builder] 所有工具名：read, write, bash, ...`

**要贴给我的**：这三行的完整内容。

**如果没看到这三行**，说明适配器的 `stream()` 没有被调用，或者 `console.log` 被吞了。这时贴：
- 从发送到超时的完整控制台输出
- DSH UI 里显示的错误信息（如果有）

### 2. 审批是否弹出？

**如果弹了**：贴审批 UI 的截图或文字描述。

**如果没弹**：贴控制台里跟 `web_ds_send` 或 `pre-execute` 相关的行。

### 3. Firefox 有没有被激活并发送？

**如果发送成功**：Firefox 里能看到你发的内容。

**如果没发送**：在 PowerShell 里手动跑一次：

```powershell
echo "测试" | python C:\path\to\dsh-plugin-web-ds\scripts\send_to_ds.py --new-session 1
```

**要贴给我的**：这条命令的完整 stdout 和 stderr。

---

## 四、Trajectory 视图

在 DSH UI 里找到 Trajectory / 轨迹视图，导出这次会话的事件日志。

**要贴给我的**：
- 每个事件的类型和来源
- 特别是来自 `web-ds` 适配器的事件

---

## 五、报错分级

把收集到的信息按下面分级，方便我判断优先级：

| 级别 | 症状 | 说明 |
|---|---|---|
| A | 桌面客户端根本起不来 | profile 或挂载问题 |
| B | 起来了但模型选择器里没有 `web-ds` | 适配器注册失败 |
| C | 有 `web-ds` 但发送时崩 | `stream()` 签名或 chunk 格式不对 |
| D | 发送成功但收不到回复 | ds_read 轮询问题 |
| E | 收到回复但 DSH 不识别 tool-call | chunk 格式或工具名不对 |
| F | 全都跑通 | 🎉 |

---

## 六、如果连 L3 都过不去

有一个退路：**先不挂 web-ds 适配器，改用 DSH 的 OpenAI 兼容端点配置**。

如果你能确认 DSH 桌面客户端支持自定义「OpenAI 兼容 API 地址」，那我们可以写一个几十行的本地 HTTP 服务，把 `/v1/chat/completions` 请求翻译成「模拟点击 Firefox + 读 ds_read」，然后让 DSH 把它当成一个普通 OpenAI 供应商。这样就不用碰 `LlmAdapter` 抽象类的内部细节。

**要确认的**：桌面客户端的「模型设置」里，有没有「自定义 API 地址」或「OpenAI Compatible」这样的选项？
