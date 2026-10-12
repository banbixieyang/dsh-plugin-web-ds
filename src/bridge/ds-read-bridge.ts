import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

/**
 * 封装对 ds_read.py 的调用。
 * 只做一件事：把网页版 DeepSeek 的会话和回复取回来。
 */
export class DsReadBridge {
  constructor(
    private scriptPath: string,
    private pythonCommand: string = 'python',
  ) {}

  async checkConnection(): Promise<boolean> {
    try {
      const { stdout } = await execFileAsync(
        this.pythonCommand,
        [this.scriptPath, '--token-only'],
        { timeout: 60_000, encoding: 'utf-8' },
      )
      return stdout.includes('[+]')
    } catch {
      return false
    }
  }

  async detectSessionId(): Promise<string | null> {
    try {
      const { stdout } = await execFileAsync(
        this.pythonCommand,
        [this.scriptPath, '--list', '--limit', '20', '--raw'],
        { timeout: 60_000, encoding: 'utf-8' },
      )
      const sessions = JSON.parse(stdout)
      if (!Array.isArray(sessions) || sessions.length === 0) return null
      sessions.sort(
        (a: any, b: any) => (b.updated_at ?? 0) - (a.updated_at ?? 0),
      )
      return sessions[0].id ?? null
    } catch {
      return null
    }
  }

  async getLatestReplyId(sessionId: string | null): Promise<string | null> {
    const { mid } = await this.readLatest(sessionId)
    return mid
  }

  async waitForReply(
    sessionId: string | null,
    prevReplyId: string | null,
    signal: AbortSignal,
    opts: { pollIntervalMs: number; stableReadsRequired: number; timeoutMs: number },
  ): Promise<string> {
    const start = Date.now()
    let stable = 0
    let lastText = ''
    let lastMid: string | null = null

    while (!signal.aborted) {
      if (Date.now() - start > opts.timeoutMs) {
        throw new Error('等待回复超时')
      }
      await new Promise((r) => setTimeout(r, opts.pollIntervalMs))

      const { text, mid } = await this.readLatest(sessionId)
      if (!text || !mid) continue
      if (prevReplyId && mid === prevReplyId) continue

      if (text === lastText && mid === lastMid) {
        stable++
        if (stable >= opts.stableReadsRequired) return text
      } else {
        stable = 0
        lastText = text
        lastMid = mid
      }
    }
    throw new Error('等待回复被中断')
  }

  private async readLatest(
    sessionId: string | null,
  ): Promise<{ text: string; mid: string | null }> {
    const args = sessionId
      ? ['--session', sessionId, '--raw']
      : ['--latest', '--raw']

    const { stdout } = await execFileAsync(
      this.pythonCommand,
      [this.scriptPath, ...args],
      { timeout: 120_000, encoding: 'utf-8' },
    )
    const data = JSON.parse(stdout)
    return this.extractLatestReply(data)
  }

  private extractLatestReply(data: any): { text: string; mid: string | null } {
    const messages: any[] = data.chat_messages ?? []
    if (messages.length === 0) return { text: '', mid: null }

    const byId: Record<string, any> = {}
    for (const m of messages) byId[m.message_id] = m

    const session = data.chat_session ?? {}
    let cur = session.current_message_id
    const chain: any[] = []
    const seen = new Set<string>()
    while (cur && byId[cur] && !seen.has(cur)) {
      seen.add(cur)
      chain.push(byId[cur])
      cur = byId[cur].parent_id
    }
    chain.reverse()

    const ordered = chain.length ? chain : messages
    for (let i = ordered.length - 1; i >= 0; i--) {
      const msg = ordered[i]
      for (const fr of msg.fragments ?? []) {
        if (fr.type === 'RESPONSE' && fr.content && fr.content.trim()) {
          return { text: fr.content.trim(), mid: msg.message_id }
        }
      }
    }
    return { text: '', mid: null }
  }
}