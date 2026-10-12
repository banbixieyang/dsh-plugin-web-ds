import type { Context } from '@deepseek-ai/cordis'
import type { WebDsConfig } from '../config.js'

/**
 * 发送前人工审批。
 *
 * 当前实现：终端打印预览 + y/n 确认。
 * ⏳ 后续：如果 QQ 通道可用，同时推送到 QQ。
 */
export class SendApproval {
  static async request(
    _ctx: Context,
    exec: any,
    _config: WebDsConfig,
  ): Promise<boolean> {
    const text: string = exec.arguments?.text ?? ''
    const label: string = exec.arguments?.label ?? '消息'

    // ⏳ 预留：先问 QQ 通道
    // const qq = await QQApproval.tryApproval(text, label)
    // if (qq !== null) return qq

    return this.terminalApproval(text, label)
  }

  static async terminalApproval(text: string, label: string): Promise<boolean> {
    const readline = await import('node:readline')
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })

    console.log('\n' + '='.repeat(60))
    console.log('  📤 发送审批（' + label + '）')
    console.log('='.repeat(60))
    console.log('  长度：' + text.length + ' 字符')
    console.log('  预览：')
    const preview = text.length > 400 ? text.slice(0, 400) + '…' : text
    for (const line of preview.split('\n')) console.log('   ' + line)
    console.log('='.repeat(60))

    return new Promise<boolean>((resolve) => {
      rl.question('  是否发送？[y/n/v(查看完整)]: ', (ans) => {
        const a = ans.trim().toLowerCase()
        if (a === 'v') {
          console.log('\n----- 完整内容 -----\n' + text + '\n--------------------\n')
          rl.question('  是否发送？[y/n]: ', (ans2) => {
            rl.close()
            resolve(ans2.trim().toLowerCase() === 'y')
          })
          return
        }
        rl.close()
        resolve(a === 'y')
      })
    })
  }
}
