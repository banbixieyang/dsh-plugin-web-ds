import type { RequestMessage } from '@deepseek-ai/dsh-llm'

/**
 * DSH 内部上下文消息的标记。这些不是真实用户输入，不该发给网页版。
 */
const INTERNAL_MARKERS = [
  'Current runtime context. This snapshot supersedes',
  '<system-reminder>',
  'A skill is a reusable set of task-specific instructions',
  'Generate the session title from this JSON array',
  'Generate a concise title',
  '<available_skills>',
]

function isInternalMessage(text: string): boolean {
  if (!text) return false
  for (const marker of INTERNAL_MARKERS) {
    if (text.includes(marker)) return true
  }
  return false
}

/**
 * 增量发送器。
 *
 * DSH 每次 stream 传入的 messages 包含整个会话历史。我们只发**新增**的部分，
 * 并且过滤掉 DSH 内部注入的上下文消息。
 */
export class IncrementalSender {
  build(
    messages: readonly RequestMessage[],
    lastMessageId: string | null,
    sentCount: number,
    isFirstTurn: boolean,
  ): string {
    if (!messages || messages.length === 0) return ''

    let newStart = 0
    if (!isFirstTurn) {
      if (lastMessageId) {
        const idx = messages.findIndex((m: any) => m?.id === lastMessageId)
        if (idx >= 0) {
          newStart = idx + 1
        } else {
          newStart = Math.min(sentCount, messages.length)
        }
      } else {
        newStart = Math.min(sentCount, messages.length)
      }
    }

    const newMessages = messages.slice(newStart)
    if (newMessages.length === 0) return ''

    const parts: string[] = []
    for (const m of newMessages) {
      const role = (m as any)?.role ?? 'unknown'
      if (role !== 'user' && role !== 'tool' && role !== 'assistant') continue
      const text = this.textOf(m)
      if (!text) continue
      if (isInternalMessage(text)) continue
      parts.push('[' + role + ']\n' + text)
    }
    return parts.join('\n\n')
  }

  private textOf(m: RequestMessage): string {
    const content: any = (m as any).content
    if (typeof content === 'string') return content
    if (!Array.isArray(content)) return ''

    const out: string[] = []
    for (const b of content) {
      if (!b || typeof b !== 'object') continue
      const block = b as any
      if (typeof block.text === 'string') {
        out.push(block.text)
      } else if (block.type === 'tool-call') {
        out.push(
          'tool_call: ' +
            JSON.stringify({ name: block.name, arguments: block.arguments }),
        )
      } else if (block.type === 'tool-result') {
        out.push('tool_result: ' + JSON.stringify(block.content ?? block))
      } else {
        out.push(JSON.stringify(block))
      }
    }
    return out.join('\n')
  }
}