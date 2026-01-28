/**
 * チャットメッセージの送信者
 */
export type ChatRole = 'user' | 'assistant' | 'system';

/**
 * チャットメッセージ
 */
export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: Date;
  isStreaming?: boolean;
}

/**
 * SSEイベントのタイプ
 */
export type SSEEventType =
  | 'message_start'
  | 'content_delta'
  | 'content_done'
  | 'tool_call'
  | 'tool_result'
  | 'error'
  | 'done';

/**
 * SSEイベントのペイロード
 */
export interface SSEEvent {
  type: SSEEventType;
  data?: {
    content?: string;
    toolName?: string;
    toolArgs?: Record<string, unknown>;
    toolResult?: unknown;
    error?: string;
  };
}

/**
 * ツール呼び出し情報
 */
export interface ToolCall {
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
  status: 'pending' | 'running' | 'completed' | 'error';
}

/**
 * チャットの状態
 */
export type ChatStatus = 'idle' | 'connecting' | 'streaming' | 'error';

/**
 * useSSEChatフックの戻り値
 */
export interface UseSSEChatReturn {
  messages: ChatMessage[];
  status: ChatStatus;
  error: string | null;
  toolCalls: ToolCall[];
  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => void;
  abort: () => void;
}

/**
 * useSSEChatフックのオプション
 */
export interface UseSSEChatOptions {
  endpoint: string;
  onToolCall?: (toolCall: ToolCall) => void;
  onComplete?: () => void;
  onError?: (error: string) => void;
  initialMessages?: ChatMessage[];
  headers?: Record<string, string>;
}

/**
 * ChatUIコンポーネントのProps
 */
export interface ChatUIProps {
  endpoint: string;
  title?: string;
  placeholder?: string;
  initialMessages?: ChatMessage[];
  onToolCall?: (toolCall: ToolCall) => void;
  onComplete?: () => void;
  className?: string;
  disabled?: boolean;
  headers?: Record<string, string>;
}
