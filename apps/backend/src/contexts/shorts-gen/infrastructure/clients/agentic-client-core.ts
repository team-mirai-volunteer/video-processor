import type { Result } from '@shared/domain/types/result.js';
import { err, ok } from '@shared/domain/types/result.js';
import { type LanguageModel, type ModelMessage, type Tool, generateText, streamText } from 'ai';
import { z } from 'zod';
import type {
  AgenticAiGatewayError,
  ChatCompletionResult,
  ChatParams,
  StreamChunk,
  ToolCall,
  ToolDefinition,
} from '../../domain/gateways/agentic-ai.gateway.js';

/**
 * Agentic Client Core
 * Vercel AI SDKを使用した共通処理を担当するコアクラス
 * プロバイダー固有の実装（OpenAI, Anthropic等）から使用される
 */
export class AgenticClientCore {
  constructor(private readonly model: LanguageModel) {}

  /**
   * チャット完了を実行する（非ストリーミング）
   */
  async chat(params: ChatParams): Promise<Result<ChatCompletionResult, AgenticAiGatewayError>> {
    try {
      const messages = this.convertMessages(params);
      const tools = params.tools ? this.convertTools(params.tools) : undefined;

      const result = await generateText({
        model: this.model,
        messages,
        tools,
        maxOutputTokens: params.maxTokens,
        temperature: params.temperature,
      });

      const toolCalls = this.extractToolCalls(result.toolCalls);
      const inputTokens = result.usage?.inputTokens ?? 0;
      const outputTokens = result.usage?.outputTokens ?? 0;

      return ok({
        content: result.text,
        toolCalls,
        finishReason: this.mapFinishReason(result.finishReason),
        usage: result.usage
          ? {
              promptTokens: inputTokens,
              completionTokens: outputTokens,
              totalTokens: inputTokens + outputTokens,
            }
          : undefined,
      });
    } catch (error) {
      return err(this.mapError(error));
    }
  }

  /**
   * チャット完了をストリーミングで実行する
   */
  async chatStream(
    params: ChatParams
  ): Promise<Result<AsyncIterable<StreamChunk>, AgenticAiGatewayError>> {
    try {
      const messages = this.convertMessages(params);
      const tools = params.tools ? this.convertTools(params.tools) : undefined;

      const result = streamText({
        model: this.model,
        messages,
        tools,
        maxOutputTokens: params.maxTokens,
        temperature: params.temperature,
      });

      const stream = this.createStreamIterator(result);
      return ok(stream);
    } catch (error) {
      return err(this.mapError(error));
    }
  }

  /**
   * ストリーミング結果をAsyncIterableに変換する
   */
  private async *createStreamIterator(
    // biome-ignore lint/suspicious/noExplicitAny: streamText generic type requires any for flexible tool typing
    result: ReturnType<typeof streamText<any>>
  ): AsyncIterable<StreamChunk> {
    try {
      for await (const part of result.fullStream) {
        if (part.type === 'text-delta') {
          yield {
            type: 'text_delta',
            textDelta: part.text,
          };
        } else if (part.type === 'tool-call') {
          yield {
            type: 'tool_call',
            toolCall: {
              id: part.toolCallId,
              name: part.toolName,
              arguments: part.input as Record<string, unknown>,
            },
          };
        } else if (part.type === 'finish') {
          yield {
            type: 'done',
            finishReason: this.mapFinishReason(part.finishReason),
          };
        } else if (part.type === 'error') {
          yield {
            type: 'error',
            error: String(part.error),
          };
        }
      }
    } catch (error) {
      yield {
        type: 'error',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * ChatParamsのメッセージをModelMessage形式に変換する
   */
  private convertMessages(params: ChatParams): ModelMessage[] {
    const messages: ModelMessage[] = [];

    // システムプロンプトがあれば先頭に追加
    if (params.systemPrompt) {
      messages.push({
        role: 'system',
        content: params.systemPrompt,
      });
    }

    // 通常のメッセージを変換
    for (const msg of params.messages) {
      if (msg.role === 'system') {
        messages.push({
          role: 'system',
          content: msg.content,
        });
      } else if (msg.role === 'user') {
        messages.push({
          role: 'user',
          content: msg.content,
        });
      } else if (msg.role === 'assistant') {
        // tool-callがある場合はcontent配列形式で構築
        if (msg.toolCalls && msg.toolCalls.length > 0) {
          const contentParts: Array<
            | { type: 'text'; text: string }
            | { type: 'tool-call'; toolCallId: string; toolName: string; input: unknown }
          > = [];

          // テキスト部分があれば追加
          if (msg.content) {
            contentParts.push({ type: 'text', text: msg.content });
          }

          // tool-call部分を追加
          for (const tc of msg.toolCalls) {
            contentParts.push({
              type: 'tool-call',
              toolCallId: tc.id,
              toolName: tc.name,
              input: tc.arguments,
            });
          }

          messages.push({
            role: 'assistant',
            content: contentParts,
          });
        } else {
          messages.push({
            role: 'assistant',
            content: msg.content,
          });
        }
      } else if (msg.role === 'tool' && msg.toolCallId && msg.toolName) {
        messages.push({
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: msg.toolCallId,
              toolName: msg.toolName,
              output: { type: 'text', value: msg.content },
            },
          ],
        });
      }
    }

    return messages;
  }

  /**
   * ToolDefinition配列をVercel AI SDK形式に変換する
   */
  private convertTools(tools: ToolDefinition[]): Record<string, Tool> {
    const result: Record<string, Tool> = {};

    for (const t of tools) {
      result[t.name] = {
        description: t.description,
        inputSchema: this.convertParametersToZod(t.parameters),
      };
    }

    return result;
  }

  /**
   * JSON Schema形式のパラメータをZodスキーマに変換する
   */
  private convertParametersToZod(
    params: ToolDefinition['parameters']
  ): z.ZodObject<Record<string, z.ZodTypeAny>> {
    const shape: Record<string, z.ZodTypeAny> = {};
    const required = params.required ?? [];

    for (const [key, prop] of Object.entries(params.properties)) {
      let zodType = this.convertPropertyToZod(prop);

      if (prop.description) {
        zodType = zodType.describe(prop.description);
      }

      if (!required.includes(key)) {
        zodType = zodType.optional();
      }

      shape[key] = zodType;
    }

    return z.object(shape);
  }

  /**
   * 単一のプロパティスキーマをZod型に変換する（再帰対応）
   */
  private convertPropertyToZod(prop: {
    type: string;
    description?: string;
    enum?: string[];
    items?: {
      type: string;
      properties?: Record<string, unknown>;
      required?: string[];
    };
    properties?: Record<string, unknown>;
    required?: string[];
  }): z.ZodTypeAny {
    switch (prop.type) {
      case 'string':
        return prop.enum ? z.enum(prop.enum as [string, ...string[]]) : z.string();
      case 'number':
        return z.number();
      case 'boolean':
        return z.boolean();
      case 'array': {
        if (!prop.items) {
          return z.array(z.unknown());
        }
        const itemType = this.convertPropertyToZod(
          prop.items as Parameters<typeof this.convertPropertyToZod>[0]
        );
        return z.array(itemType);
      }
      case 'object': {
        if (!prop.properties) {
          return z.record(z.string(), z.unknown());
        }
        const objShape: Record<string, z.ZodTypeAny> = {};
        const objRequired = prop.required ?? [];

        for (const [k, v] of Object.entries(prop.properties)) {
          let fieldType = this.convertPropertyToZod(
            v as Parameters<typeof this.convertPropertyToZod>[0]
          );
          const fieldProp = v as { description?: string };
          if (fieldProp.description) {
            fieldType = fieldType.describe(fieldProp.description);
          }
          if (!objRequired.includes(k)) {
            fieldType = fieldType.optional();
          }
          objShape[k] = fieldType;
        }
        return z.object(objShape);
      }
      default:
        return z.unknown();
    }
  }

  /**
   * ToolCalls配列を抽出する
   */
  private extractToolCalls(
    toolCalls: Array<{ toolCallId: string; toolName: string; input: unknown }> | undefined
  ): ToolCall[] {
    if (!toolCalls) {
      return [];
    }

    return toolCalls.map((tc) => ({
      id: tc.toolCallId,
      name: tc.toolName,
      arguments: tc.input as Record<string, unknown>,
    }));
  }

  /**
   * Vercel AI SDKのfinishReasonをgatewayの形式にマップする
   */
  private mapFinishReason(
    reason: string | undefined
  ): 'stop' | 'tool_calls' | 'length' | 'content_filter' {
    switch (reason) {
      case 'stop':
        return 'stop';
      case 'tool-calls':
        return 'tool_calls';
      case 'length':
        return 'length';
      case 'content-filter':
        return 'content_filter';
      default:
        return 'stop';
    }
  }

  /**
   * エラーをAgenticAiGatewayErrorにマップする
   */
  private mapError(error: unknown): AgenticAiGatewayError {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      // Rate limit errors
      if (message.includes('rate limit') || message.includes('429')) {
        return { type: 'RATE_LIMIT_EXCEEDED' };
      }

      // Context length errors
      if (
        message.includes('context length') ||
        message.includes('maximum context') ||
        message.includes('token limit')
      ) {
        return {
          type: 'CONTEXT_LENGTH_EXCEEDED',
          message: error.message,
        };
      }

      // Content policy violations
      if (
        message.includes('content policy') ||
        message.includes('content_policy') ||
        message.includes('flagged')
      ) {
        return {
          type: 'CONTENT_POLICY_VIOLATION',
          message: error.message,
        };
      }

      // API errors with status codes
      const statusMatch = message.match(/status[:\s]*(\d{3})/i);
      if (statusMatch?.[1]) {
        return {
          type: 'API_ERROR',
          statusCode: Number.parseInt(statusMatch[1], 10),
          message: error.message,
        };
      }

      // Generic generation failed
      return {
        type: 'GENERATION_FAILED',
        message: error.message,
      };
    }

    return {
      type: 'GENERATION_FAILED',
      message: String(error),
    };
  }
}
