interface Context {
  get(name: string): unknown
  effect(fn: () => () => void): void
  [key: string]: unknown
}
import { WebDsAdapter } from './adapter/web-ds-adapter.js'

export const name = 'dsh-plugin-web-ds'
export const inject = ['llm']

export interface Config {
  dsReadScript: string
  sendScript: string
  pythonCommand?: string
  pollIntervalMs?: number
  replyTimeoutMs?: number
  stableReadsRequired?: number
  approvalEnabled?: boolean
  qqEnabled?: boolean
  qqConfig?: Record<string, unknown>
}

const DEFAULT_CONFIG: Required<Config> = {
  dsReadScript: '',
  sendScript: 'scripts/send_to_ds.py',
  pythonCommand: '',
  pollIntervalMs: 3000,
  replyTimeoutMs: 240000,
  stableReadsRequired: 4,
  approvalEnabled: true,
  qqEnabled: false,
  qqConfig: {},
}

export function apply(ctx: Context, config: Config) {
  console.log('[dsh-plugin-web-ds] apply 被调用')

  const merged: Required<Config> = { ...DEFAULT_CONFIG, ...config }

  if (!merged.dsReadScript) {
    console.error('[dsh-plugin-web-ds] 缺少 dsReadScript 配置，插件未注册')
    return
  }

  // 用 ctx.get('llm') 拿服务，避开 inject 识别问题
  const llm = typeof (ctx as any).get === 'function'
    ? (ctx as any).get('llm')
    : (ctx as any).llm

  console.log('[dsh-plugin-web-ds] llm 服务 =', typeof llm)

  if (!llm || typeof llm.registerAdapter !== 'function') {
    console.error('[dsh-plugin-web-ds] 无法获取 ctx.llm 服务，插件未注册')
    return
  }

  console.log('[dsh-plugin-web-ds] config =', JSON.stringify(merged))

  const adapter = new WebDsAdapter(ctx, merged)
  const registration = llm.registerAdapter(['web-ds'], adapter)
  console.log(
    '[dsh-plugin-web-ds] 已注册 provider: web-ds，registration =',
    typeof registration,
  )

  if (registration && typeof registration.dispose === 'function') {
    ctx.effect(() => () => registration.dispose())
  }
}