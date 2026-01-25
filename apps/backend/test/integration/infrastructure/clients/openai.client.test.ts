import { beforeAll, describe, expect, it } from 'vitest';
import { OpenAIClient } from '../../../../src/infrastructure/clients/openai.client.js';

/**
 * Check if OpenAI API key is configured
 */
function isOpenAIConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

// Skip integration tests if INTEGRATION_TEST is not set or API key is not available
const runIntegrationTests = process.env.INTEGRATION_TEST === 'true' && isOpenAIConfigured();

describe.skipIf(!runIntegrationTests)('OpenAIClient Integration', () => {
  let client: OpenAIClient;

  beforeAll(() => {
    client = new OpenAIClient();
  });

  describe('generate', () => {
    it('should answer factual questions correctly', async () => {
      const prompt = '日本の首都は？都市名を2文字で答えてください。';

      const result = await client.generate(prompt);

      expect(typeof result).toBe('string');
      expect(result).toContain('東京');
    });
  });
});
