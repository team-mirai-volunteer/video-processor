import { anthropic } from '@ai-sdk/anthropic';
import type { AiGateway } from '@shared/domain/gateways/ai.gateway.js';
import { generateText } from 'ai';

/**
 * Anthropic Claude client implementation
 */
export class AnthropicClient implements AiGateway {
  private readonly model: ReturnType<typeof anthropic>;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }

    const modelName = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-20250514';
    this.model = anthropic(modelName);
  }

  async generate(prompt: string): Promise<string> {
    const { text } = await generateText({
      model: this.model,
      prompt,
    });

    if (!text) {
      throw new Error('No response content from Anthropic');
    }

    return text;
  }
}
