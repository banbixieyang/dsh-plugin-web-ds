/**
 * 通过 DSH 原生审批通道请求用户确认发送。
 *
 * 这个模块不 import 任何 @deepseek-ai/* 包。全部走 duck typing。
 * 如果 DSH 没有 compose approval 服务，按 failClosed 决定。
 */

interface ApprovalService {
  request(req: {
    agent: unknown
    toolName: string
    reason?: string
    signal?: AbortSignal
  }): Promise<'allowed-once' | 'rejected' | 'cancelled' | 'unavailable'>
}

interface AgentRegistry {
  get(id: string): unknown
}

export interface SendApprovalOptions {
  heading: string
  previewChars: number
  failClosedWithoutApproval: boolean
}

/**
 * @returns true 允许发送，false 拒绝发送
 */
export async function requestSendApproval(
  ctx: any,
  text: string,
  sessionId: string | undefined,
  options: SendApprovalOptions,
): Promise<boolean> {
  const log = (...args: unknown[]) => console.log('[web-ds]', ...args)

  const approval = ctx?.get ? (ctx.get('approval') as ApprovalService | undefined) : undefined
  const agents = ctx?.get ? (ctx.get('agents') as AgentRegistry | undefined) : undefined

  if (!approval || typeof approval.request !== 'function') {
    if (options.failClosedWithoutApproval) {
      log('无审批通道，fail-closed，拒绝发送')
      return false
    }
    log('无审批通道，自动放行')
    return true
  }

  if (!agents || typeof agents.get !== 'function') {
    if (options.failClosedWithoutApproval) {
      log('无 agent 注册表，fail-closed，拒绝发送')
      return false
    }
    log('无 agent 注册表，自动放行')
    return true
  }

  if (!sessionId) {
    if (options.failClosedWithoutApproval) {
      log('无 sessionId，fail-closed，拒绝发送')
      return false
    }
    log('无 sessionId，自动放行')
    return true
  }

  const agent = agents.get(sessionId)
  if (!agent) {
    if (options.failClosedWithoutApproval) {
      log('sessionId ' + sessionId + ' 无对应 agent，拒绝发送')
      return false
    }
    log('sessionId ' + sessionId + ' 无对应 agent，自动放行')
    return true
  }

  const preview =
    text.length > options.previewChars
      ? text.slice(0, options.previewChars) +
        '\n\n…（还有 ' + (text.length - options.previewChars) + ' 字符未显示）'
      : text

  const reason = options.heading + '\n\n' + preview

  try {
    const outcome = await approval.request({
      agent,
      toolName: 'web-ds: 发送到网页版',
      reason,
    })
    log('审批结果：' + outcome)
    return outcome === 'allowed-once'
  } catch (err) {
    log('审批请求失败：' + String((err as Error)?.message ?? err))
    return false
  }
}