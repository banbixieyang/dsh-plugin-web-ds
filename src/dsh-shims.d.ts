/**
 * DSH 运行时提供的模块类型声明。
 *
 * 这些包在 DSH 运行时有真实实现，但本地 npm install 装不到。
 * 这里只声明编译需要的类型，运行时由 DSH 提供真实模块。
 */

declare module '@deepseek-ai/cordis' {
  export interface Context {
    get(name: string): unknown
    effect(fn: () => () => void): void
    [key: string]: unknown
  }
}

declare module '@deepseek-ai/dsh-llm' {
  export type Branded<T extends string> = string & { readonly __brand: T }
  export type ToolCallId = Branded<'ToolCallId'>

  export interface ToolSchema {
    name: string
    description: string
    parameters: Record<string, unknown>
    deferLoading?: true
  }

  export interface RequestMessage {
    role: string
    content: unknown
    [key: string]: unknown
  }

  export interface GenerateOptions {
    provider: string
    model: string
    messages: RequestMessage[]
    system?: string
    tools?: ToolSchema[]
    temperature?: number
    maxTokens?: number
    signal?: AbortSignal
    sessionId?: string
    purpose?: string
    [key: string]: unknown
  }

  export interface TokenUsage {
    inputTokens: number
    outputTokens: number
    totalTokens?: number
  }

  export interface LlmFailure {
    code: string
    message: string
    [key: string]: unknown
  }

  export type FinishReason =
    | { kind: 'stop' }
    | { kind: 'tool-calls' }
    | { kind: 'max-tokens' }
    | { kind: 'aborted'; failure: LlmFailure }
    | { kind: 'error'; failure: LlmFailure }

  export type StreamChunk =
    | { type: 'block-start'; index: number; blockType: string }
    | { type: 'text-delta'; index: number; text: string }
    | { type: 'reasoning-delta'; index: number; text: string }
    | { type: 'tool-call-delta'; index: number; id: ToolCallId; name?: string; argumentsDelta: string }
    | { type: 'block-end'; index: number; block: unknown }
    | { type: 'usage'; usage: TokenUsage }
    | { type: 'finish'; reason: FinishReason }

  export interface LlmModelInfo {
    provider: string
    id: string
    name: string
    description?: string
    inputModalities?: readonly string[]
    [key: string]: unknown
  }

  export interface LlmProviderInfo {
    id: string
    name: string
  }

  export interface LlmResolvedModelInfo extends LlmModelInfo {
    context?: { contextWindow: number }
    defaultMaxTokens?: number
    systemPromptUpdate?: 'in-history'
  }

  export abstract class LlmAdapter {
    providerInfo(provider: string): LlmProviderInfo
    providerRetryPolicy(provider: string): unknown
    listModels(provider: string): Promise<readonly LlmModelInfo[]>
    resolveModel(provider: string, model: string, signal?: AbortSignal): Promise<LlmResolvedModelInfo>
    abstract stream(options: GenerateOptions): AsyncIterable<StreamChunk>
  }

  export class LlmError extends Error {
    constructor(message: string, code: string, options?: { cause?: unknown })
    readonly code: string
  }
}