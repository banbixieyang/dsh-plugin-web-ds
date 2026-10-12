import * as readline from 'node:readline'

/**
 * 终端审批：把要发送的内容打印出来，等用户输 y/n。
 *
 * 不依赖 DSH 内部审批 API，纯 Node.js readline。
 * 后续如果 DSH 有原生审批接口，可以替换这里。
 */
export function askTerminalApproval(
  text: string,
  label: string,
): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  const sep = '='.repeat(60)
  console.log('')
  console.log(sep)
  console.log('  📤 发送审批（' + label + '）')
  console.log(sep)
  console.log('  长度：' + text.length + ' 字符')
  console.log('')
  const preview = text.length > 800 ? text.slice(0, 800) + '…' : text
  for (const line of preview.split('\n')) {
    console.log('  ' + line)
  }
  console.log(sep)

  return new Promise<boolean>((resolve) => {
    rl.question('  是否发送？[y/n/v(查看完整)]: ', (ans) => {
      const a = ans.trim().toLowerCase()
      if (a === 'v') {
        console.log('')
        console.log('----- 完整内容 -----')
        console.log(text)
        console.log('--------------------')
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
