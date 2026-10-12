import type { ToolSchema } from '@deepseek-ai/dsh-llm'

/**
 * 工具协议 + 工具清单。
 *
 * 用 markdown fenced code block，而不是自定义 XML 标签——
 * 网页版 DeepSeek 对 ```...``` 非常熟悉，遵守率远高于 <tool_call>。
 */
export class ToolPromptBuilder {
  /** 前缀：协议说明 */
  buildPrefix(tools: ToolSchema[] | undefined): string {
    if (!tools || tools.length === 0) return ''

    const lines: string[] = []

    lines.push('【系统设定 · 你是外置大脑】')
    lines.push('')
    lines.push(
      '你负责思考，本地有一个执行器负责执行。你的回复会被程序自动解析。',
    )
    lines.push('需要执行任何操作时，在回复末尾附上一个 tool_call 代码块：')
    lines.push('')
    lines.push('```tool_call')
    lines.push('{"name": "工具名", "arguments": {"参数名": "值"}}')
    lines.push('```')
    lines.push('')
    lines.push('【硬性规则】')
    lines.push(
      '- 用户要求涉及文件、命令、搜索时，你必须在回复末尾附上 tool_call 块。',
    )
    lines.push(
      '- 禁止用"我将..."、"让我..."、"I will..." 这类自然语言描述动作。',
    )
    lines.push('- 可以写一两句分析，但动作必须用 tool_call 块表达。')
    lines.push('- 一次可以放多个 call 对象到一个 JSON 数组里。')
    lines.push('- 输出 tool_call 后立即停止，不要编造执行结果。')
    lines.push('- 只有纯聊天（完全不需要工具）时才输出普通文本。')
    lines.push('')
    lines.push('【示例 1】用户：创建 hello.py，内容是 print("hi")')
    lines.push('你应当回复：')
    lines.push('好的，我来创建。')
    lines.push('')
    lines.push('```tool_call')
    lines.push(
      '{"name": "write", "arguments": {"file_path": "hello.py", "content": "print(\\"hi\\")"}}',
    )
    lines.push('```')
    lines.push('')
    lines.push('【示例 2】用户：看看当前目录有什么文件')
    lines.push('你应当回复：')
    lines.push('')
    lines.push('```tool_call')
    lines.push('{"name": "glob", "arguments": {"pattern": "*"}}')
    lines.push('```')
    lines.push('')
    lines.push('【示例 3】用户：运行 hello.py')
    lines.push('你应当回复：')
    lines.push('')
    lines.push('```tool_call')
    lines.push('{"name": "pwsh", "arguments": {"command": "python hello.py", "description": "Run hello.py"}}')
    lines.push('```')
    lines.push('')

    return lines.join('\n')
  }

  /** 后缀：工具清单 */
  buildSuffix(tools: ToolSchema[] | undefined): string {
    if (!tools || tools.length === 0) return ''

    const lines: string[] = []
    lines.push('【本次会话可用的工具】')
    for (const t of tools) {
      if (!t.name) continue
      const firstLine = (t.description ?? '').split('\n')[0]
      lines.push('- ' + t.name + '：' + firstLine)
    }
    return lines.join('\n')
  }

  /** 兼容旧调用 */
  build(tools: ToolSchema[] | undefined): string {
    const p = this.buildPrefix(tools)
    const s = this.buildSuffix(tools)
    if (!p && !s) return ''
    return p + '\n\n' + s
  }
}