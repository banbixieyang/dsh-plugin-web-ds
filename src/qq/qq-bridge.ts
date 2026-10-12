import type { Context } from '@deepseek-ai/cordis'
import type { WebDsConfig } from '../config.js'

/**
 * ⏳ QQ 接入模块（预留）。
 *
 * 后续目标：
 *  1. 启动后连接 QQ（go-cqhttp / OneBot / NapCat 等）
 *  2. 接收 QQ 消息 → 作为新的用户输入源
 *  3. 发送审批 → 推送到 QQ，等 QQ 端回 y/n
 *  4. 执行结果 → 推送到 QQ
 *
 * 你后续提供接入作品后，把逻辑填进 start() / stop() 即可。
 */
export class QQBridge {
  private running = false

  constructor(private ctx: Context, private config: WebDsConfig) {}

  async start(): Promise<void> {
    console.log('[QQBridge] QQ 接入模块尚未实现（预留位）')
    // TODO: 等后续接入作品
    this.running = true
  }

  async stop(): Promise<void> {
    this.running = false
  }

  get isRunning(): boolean {
    return this.running
  }
}
