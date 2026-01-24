import { v2 } from '@google-cloud/speech';
import type { google } from '@google-cloud/speech/build/protos/protos.js';
import type {
  TranscribeParams,
  TranscriptionGateway,
  TranscriptionResult,
  TranscriptionSegment,
} from '../../domain/gateways/transcription.gateway.js';

/**
 * Google Cloud Speech-to-Text API v2 client implementation using Chirp model
 * Implements TranscriptionGateway interface
 */
export class SpeechToTextClient implements TranscriptionGateway {
  private readonly client: v2.SpeechClient;
  private readonly projectId: string;
  private readonly location: string;

  constructor() {
    this.projectId = process.env.GOOGLE_CLOUD_PROJECT ?? '';
    this.location = process.env.SPEECH_TO_TEXT_LOCATION ?? 'us-central1';
    this.client = new v2.SpeechClient({
      apiEndpoint: `${this.location}-speech.googleapis.com`,
    });

    if (!this.projectId) {
      throw new Error('GOOGLE_CLOUD_PROJECT environment variable is required');
    }
  }

  /**
   * Transcribe audio using Google Cloud Speech-to-Text API v2 with Chirp model
   * @param params Transcription parameters
   * @returns Transcription result with segments and timestamps
   */
  async transcribe(params: TranscribeParams): Promise<TranscriptionResult> {
    const { audioBuffer, languageCode } = params;

    const config: google.cloud.speech.v2.IRecognitionConfig = {
      autoDecodingConfig: {},
      languageCodes: languageCode ? [languageCode] : ['ja-JP'],
      model: 'chirp',
      features: {
        enableWordTimeOffsets: true,
      },
    };

    const recognizer = `projects/${this.projectId}/locations/${this.location}/recognizers/_`;
    const request: google.cloud.speech.v2.IRecognizeRequest = {
      recognizer,
      config,
      content: audioBuffer,
    };

    const [response] = await this.client.recognize(request);
    return this.parseResponse(response);
  }

  /**
   * Parse Speech-to-Text API response into TranscriptionResult
   */
  private parseResponse(response: google.cloud.speech.v2.IRecognizeResponse): TranscriptionResult {
    const segments: TranscriptionSegment[] = [];
    let fullText = '';
    let detectedLanguage = 'ja-JP';
    let maxEndTime = 0;

    for (const result of response.results ?? []) {
      const alternative = result.alternatives?.[0];
      if (!alternative) continue;

      if (result.languageCode) {
        detectedLanguage = result.languageCode;
      }

      // Process word-level timestamps
      for (const wordInfo of alternative.words ?? []) {
        const startSeconds = this.durationToSeconds(wordInfo.startOffset);
        const endSeconds = this.durationToSeconds(wordInfo.endOffset);

        segments.push({
          text: wordInfo.word ?? '',
          startTimeSeconds: startSeconds,
          endTimeSeconds: endSeconds,
          confidence: wordInfo.confidence ?? 0,
        });

        if (endSeconds > maxEndTime) {
          maxEndTime = endSeconds;
        }
      }

      fullText += `${alternative.transcript ?? ''} `;
    }

    return {
      fullText: fullText.trim(),
      segments,
      languageCode: detectedLanguage,
      durationSeconds: maxEndTime,
    };
  }

  /**
   * Convert protobuf Duration to seconds
   */
  private durationToSeconds(duration: google.protobuf.IDuration | null | undefined): number {
    if (!duration) return 0;
    const seconds = Number(duration.seconds ?? 0);
    const nanos = (duration.nanos ?? 0) / 1_000_000_000;
    return seconds + nanos;
  }
}
