import { anthropic } from '@ai-sdk/anthropic';
import type { Result } from '@shared/domain/types/result.js';
import type {
  AgenticAiGateway,
  AgenticAiGatewayError,
  ChatCompletionResult,
  ChatParams,
  StreamChunk,
} from '../../domain/gateways/agentic-ai.gateway.js';
import { AgenticClientCore } from './agentic-client-core.js';

/**
 * Anthropic Agentic Client
 * Anthropic Claude モデルを使用するファサードクラス
 * 共通処理はAgenticClientCoreに委譲
 */
export class AnthropicAgenticClient implements AgenticAiGateway {
  private readonly core: AgenticClientCore;

  /**
   * @param model Anthropicモデル名（省略時は環境変数または'claude-sonnet-4-20250514'）
   */
  constructor(model?: string) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }

    const modelName = model ?? process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-20250514';
    this.core = new AgenticClientCore(anthropic(modelName));
  }

  /**
   * チャット完了を実行する（非ストリーミング）
   */
  chat(params: ChatParams): Promise<Result<ChatCompletionResult, AgenticAiGatewayError>> {
    return this.core.chat(params);
  }

  /**
   * チャット完了をストリーミングで実行する
   */
  chatStream(
    params: ChatParams
  ): Promise<Result<AsyncIterable<StreamChunk>, AgenticAiGatewayError>> {
    return this.core.chatStream(params);
  }
}
