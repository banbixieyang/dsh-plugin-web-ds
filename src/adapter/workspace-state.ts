import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'

export interface WorkspaceState {
  sessionId: string | null
  lastMessageId: string | null
  sentCount: number
  lastReplyId: string | null
  updatedAt: string
}

const STATE_DIR = path.join(os.homedir(), '.dsh-web-ds')
const STATE_FILE = path.join(STATE_DIR, 'workspaces.json')

let cached: Record<string, WorkspaceState> | null = null

function load(): Record<string, WorkspaceState> {
  if (cached) return cached
  try {
    if (!fs.existsSync(STATE_FILE)) {
      cached = {}
      return cached
    }
    const raw = fs.readFileSync(STATE_FILE, 'utf-8')
    cached = JSON.parse(raw)
    return cached!
  } catch (e) {
    console.error('[web-ds] 状态文件读取失败:', e)
    cached = {}
    return cached
  }
}

function save(state: Record<string, WorkspaceState>): void {
  try {
    fs.mkdirSync(STATE_DIR, { recursive: true })
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8')
  } catch (e) {
    console.error('[web-ds] 状态文件写入失败:', e)
  }
}

/**
 * 每个 DSH 会话对应一个 key，key → 网页版会话状态。
 * 首选 DSH 的 sessionId；缺失时退回工作区路径。
 */
export function getWorkspaceKey(options: any): string {
  const sid = options?.sessionId
  if (typeof sid === 'string' && sid.trim().length > 0) {
    return 'session:' + sid
  }

  const candidates = [
    options?.workspace,
    options?.workspacePath,
    options?.workingDirectory,
    options?.cwd,
    options?.workdir,
  ]
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim().length > 0) {
      try {
        return 'workspace:' + path.resolve(c)
      } catch {
        return 'workspace:' + c
      }
    }
  }
  return '__default__'
}

export function getWorkspaceState(key: string): WorkspaceState {
  const state = load()
  return (
    state[key] ?? {
      sessionId: null,
      lastMessageId: null,
      sentCount: 0,
      lastReplyId: null,
      updatedAt: new Date().toISOString(),
    }
  )
}

export function updateWorkspaceState(
  key: string,
  patch: Partial<WorkspaceState>,
): void {
  const state = load()
  const current = state[key] ?? {
    sessionId: null,
    lastMessageId: null,
    sentCount: 0,
    lastReplyId: null,
    updatedAt: new Date().toISOString(),
  }
  state[key] = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  }
  save(state)
}

export function resetAllState(): void {
  cached = {}
  save({})
}