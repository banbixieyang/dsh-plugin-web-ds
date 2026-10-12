import { spawn } from 'node:child_process'
import * as path from 'node:path'

/**
 * 调用本插件自带的 scripts/send_to_ds.py，
 * 用 pyautogui 在 Firefox 里模拟点击、粘贴、回车。
 *
 * 用 spawn 而非 execFile：需要手动写 stdin 并关闭，
 * 让 Python 侧 sys.stdin.read() 能读到 EOF 返回。
 */
export class ClickSender {
  private scriptPath: string

  constructor(
    pluginRoot: string,
    sendScriptRel: string,
    private pythonCommand: string = 'python',
  ) {
    this.scriptPath = path.resolve(pluginRoot, sendScriptRel)
  }

  send(text: string, isNewSession: boolean): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const child = spawn(
        this.pythonCommand,
        [this.scriptPath, '--new-session', isNewSession ? '1' : '0'],
        { stdio: ['pipe', 'pipe', 'pipe'] },
      )

      let stdout = ''
      let stderr = ''

      child.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString('utf-8')
      })
      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString('utf-8')
      })

      child.on('error', (err) => {
        reject(err)
      })

      child.on('close', (code, signal) => {
        if (code === 0) {
          resolve()
          return
        }
        const parts = [
          `send_to_ds.py exited with code=${code} signal=${signal ?? 'none'}`,
          stderr ? 'STDERR:\n' + stderr.slice(-2000) : '',
          stdout ? 'STDOUT:\n' + stdout.slice(-2000) : '',
        ].filter(Boolean)
        reject(new Error(parts.join('\n')))
      })

      // 写入文本后立刻关闭 stdin，让 Python 的 sys.stdin.read() 读到 EOF
      child.stdin.write(text, 'utf-8')
      child.stdin.end()
    })
  }

  dispose() {
    // 目前无需清理
  }
}