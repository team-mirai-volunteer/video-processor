import type { Result } from '@shared/domain/types/result.js';

/**
 * チャットメッセージの役割
 */
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

/**
 * チャットメッセージ
 */
export interface ChatMessage {
  /** メッセージの役割 */
  role: MessageRole;
  /** メッセージ内容 */
  content: string;
  /** ツールコールID（roleがtoolの場合） */
  toolCallId?: string;
  /** ツールの名前（roleがtoolの場合） */
  toolName?: string;
  /** ツールコール一覧（roleがassistantでツールを呼び出した場合） */
  toolCalls?: ToolCall[];
}

/**
 * ツール定義のパラメータスキーマ（JSON Schema形式）
 */
/**
 * ツールパラメータのプロパティ定義
 */
export interface ToolPropertySchema {
  type: string;
  description?: string;
  enum?: string[];
  items?: ToolPropertySchema;
  properties?: Record<string, ToolPropertySchema>;
  required?: string[];
}

export interface ToolParameterSchema {
  type: 'object';
  properties: Record<string, ToolPropertySchema>;
  required?: string[];
}

/**
 * ツール定義
 */
export interface ToolDefinition {
  /** ツール名 */
  name: string;
  /** ツールの説明 */
  description: string;
  /** パラメータスキーマ */
  parameters: ToolParameterSchema;
}

/**
 * ツールコール（AIがツールを呼び出す要求）
 */
export interface ToolCall {
  /** ツールコールID */
  id: string;
  /** ツール名 */
  name: string;
  /** 引数（JSON文字列からパースされたオブジェクト） */
  arguments: Record<string, unknown>;
}

/**
 * ストリーミングチャンクの種類
 */
export type StreamChunkType = 'text_delta' | 'tool_call' | 'error' | 'done';

/**
 * ストリーミングチャンク
 */
export interface StreamChunk {
  /** チャンクの種類 */
  type: StreamChunkType;
  /** テキストデルタ（type === 'text_delta'の場合） */
  textDelta?: string;
  /** ツールコール（type === 'tool_call'の場合） */
  toolCall?: ToolCall;
  /** エラーメッセージ（type === 'error'の場合） */
  error?: string;
  /** 終了理由（type === 'done'の場合） */
  finishReason?: 'stop' | 'tool_calls' | 'length' | 'content_filter';
}

/**
 * チャット完了結果（非ストリーミング）
 */
export interface ChatCompletionResult {
  /** 生成されたメッセージ内容 */
  content: string;
  /** ツールコール一覧 */
  toolCalls: ToolCall[];
  /** 終了理由 */
  finishReason: 'stop' | 'tool_calls' | 'length' | 'content_filter';
  /** 使用トークン数 */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * チャットリクエストパラメータ
 */
export interface ChatParams {
  /** メッセージ履歴 */
  messages: ChatMessage[];
  /** 利用可能なツール一覧 */
  tools?: ToolDefinition[];
  /** 最大生成トークン数 */
  maxTokens?: number;
  /** 温度（創造性の度合い、0-2） */
  temperature?: number;
  /** システムプロンプト */
  systemPrompt?: string;
}

/**
 * Agentic AI Gateway エラー
 */
export type AgenticAiGatewayError =
  | { type: 'INVALID_MESSAGES'; message: string }
  | { type: 'INVALID_TOOL_DEFINITION'; message: string }
  | { type: 'CONTEXT_LENGTH_EXCEEDED'; message: string }
  | { type: 'CONTENT_POLICY_VIOLATION'; message: string }
  | { type: 'GENERATION_FAILED'; message: string }
  | { type: 'RATE_LIMIT_EXCEEDED'; retryAfterMs?: number }
  | { type: 'API_ERROR'; statusCode: number; message: string };

/**
 * Agentic AI Gateway
 * ツールユース（function calling）対応のAIチャットインターフェース
 * Vercel AI SDKを使用した実装を想定
 */
export interface AgenticAiGateway {
  /**
   * チャット完了を実行する（非ストリーミング）
   * @param params チャットパラメータ
   * @returns 完了結果またはエラー
   */
  chat(params: ChatParams): Promise<Result<ChatCompletionResult, AgenticAiGatewayError>>;

  /**
   * チャット完了をストリーミングで実行する
   * SSE対応で、チャンクを逐次返す
   * @param params チャットパラメータ
   * @returns ストリーミングチャンクのAsyncIterableまたはエラー
   */
  chatStream(
    params: ChatParams
  ): Promise<Result<AsyncIterable<StreamChunk>, AgenticAiGatewayError>>;
}
