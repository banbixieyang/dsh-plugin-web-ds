export interface WebDsConfig {
  /** ds_read.py 绝对路径（复用你已有的脚本） */
  dsReadScript: string
  /** 本插件自带的发送脚本相对路径 */
  sendScript: string
  /** 轮询间隔（毫秒） */
  pollIntervalMs: number
  /** 等待回复超时（毫秒） */
  replyTimeoutMs: number
  /** 连续多少次读到一致内容才认为生成完毕 */
  stableReadsRequired: number
  /** 是否开启发送前人工审批 */
  approvalEnabled: boolean
  /** ⏳ QQ 接入开关（预留） */
  qqEnabled: boolean
  /** ⏳ QQ 配置（预留） */
  qqConfig: Record<string, unknown>
}

export const DEFAULT_CONFIG: WebDsConfig = {
  dsReadScript: '',
  sendScript: 'scripts/send_to_ds.py',
  pollIntervalMs: 3000,
  replyTimeoutMs: 240000,
  stableReadsRequired: 4,
  approvalEnabled: true,
  qqEnabled: false,
  qqConfig: {},
}
