import type { AiGateway } from '../../domain/gateways/ai.gateway.js';

/**
 * Mock AI client for E2E tests.
 * Returns pre-configured responses without hitting the real API.
 */
export class MockAiClient implements AiGateway {
  async generate(prompt: string): Promise<string> {
    // クリップ抽出用のプロンプトに対するモックレスポンス
    if (prompt.includes('切り抜き') || prompt.includes('clip')) {
      return JSON.stringify([
        {
          title: 'モックテストクリップ1',
          startTime: 0,
          endTime: 30,
          reason: 'テスト用の切り抜き箇所',
        },
        {
          title: 'モックテストクリップ2',
          startTime: 60,
          endTime: 120,
          reason: 'テスト用の切り抜き箇所2',
        },
      ]);
    }

    // 文字起こし精製用のプロンプトに対するモックレスポンス
    if (prompt.includes('精製') || prompt.includes('refine') || prompt.includes('校正')) {
      return JSON.stringify({
        fullText: 'これはモックで精製された文字起こしです。',
        sentences: [
          { start: 0, end: 5, text: 'これはモックで' },
          { start: 5, end: 10, text: '精製された文字起こしです。' },
        ],
      });
    }

    // デフォルトのモックレスポンス
    return 'Mock AI response for testing purposes.';
  }
}
