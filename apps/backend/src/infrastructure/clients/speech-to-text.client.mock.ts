import type {
  TranscribeParams,
  TranscriptionGateway,
  TranscriptionResult,
} from '../../domain/gateways/transcription.gateway.js';

/**
 * Mock Speech-to-Text client for E2E tests.
 * Returns pre-configured responses without hitting the real API.
 */
export class MockSpeechToTextClient implements TranscriptionGateway {
  async transcribe(_params: TranscribeParams): Promise<TranscriptionResult> {
    return this.getMockResult();
  }

  async transcribeLongAudio(_params: TranscribeParams): Promise<TranscriptionResult> {
    return this.getMockResult();
  }

  private getMockResult(): TranscriptionResult {
    return {
      fullText: 'これはモックの文字起こし結果です。テスト用のダミーテキストが含まれています。',
      segments: [
        {
          text: 'これはモックの',
          startTimeSeconds: 0,
          endTimeSeconds: 2,
          confidence: 0.95,
        },
        {
          text: '文字起こし結果です。',
          startTimeSeconds: 2,
          endTimeSeconds: 5,
          confidence: 0.92,
        },
        {
          text: 'テスト用のダミーテキストが含まれています。',
          startTimeSeconds: 5,
          endTimeSeconds: 10,
          confidence: 0.88,
        },
      ],
      languageCode: 'ja-JP',
      durationSeconds: 10,
    };
  }
}
