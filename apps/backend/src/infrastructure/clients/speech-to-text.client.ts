import { SpeechClient } from '@google-cloud/speech';
import type { google } from '@google-cloud/speech/build/protos/protos.js';
import type {
  TranscribeParams,
  TranscriptionGateway,
  TranscriptionResult,
  TranscriptionSegment,
} from '../../domain/gateways/transcription.gateway.js';

/**
 * Threshold in seconds for using LongRunningRecognize instead of Recognize
 * Speech-to-Text API recommends LongRunningRecognize for audio longer than 60 seconds
 */
const LONG_RUNNING_THRESHOLD_SECONDS = 60;

/**
 * Default sample rate for audio files (Hz)
 */
const DEFAULT_SAMPLE_RATE = 16000;

/**
 * Google Cloud Speech-to-Text API v2 client implementation using Chirp model
 * Implements TranscriptionGateway interface
 */
export class SpeechToTextClient implements TranscriptionGateway {
  private readonly client: SpeechClient;
  private readonly projectId: string;
  private readonly location: string;

  constructor() {
    this.client = new SpeechClient();
    this.projectId = process.env.GOOGLE_CLOUD_PROJECT ?? '';
    this.location = process.env.SPEECH_TO_TEXT_LOCATION ?? 'asia-northeast1';

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
    const { audioBuffer, sampleRateHertz, languageCode } = params;

    // Estimate audio duration based on buffer size and sample rate
    // For 16-bit mono audio: duration = bytes / (sampleRate * 2)
    const estimatedSampleRate = sampleRateHertz ?? DEFAULT_SAMPLE_RATE;
    const estimatedDuration = audioBuffer.length / (estimatedSampleRate * 2);

    const config: google.cloud.speech.v2.IRecognitionConfig = {
      autoDecodingConfig: {},
      languageCodes: languageCode ? [languageCode] : ['ja-JP', 'en-US'],
      model: 'chirp',
      features: {
        enableWordTimeOffsets: true,
        enableWordConfidence: true,
      },
    };

    const recognizer = `projects/${this.projectId}/locations/${this.location}/recognizers/_`;

    if (estimatedDuration > LONG_RUNNING_THRESHOLD_SECONDS) {
      return this.transcribeLongRunning(audioBuffer, config, recognizer);
    }

    return this.transcribeSync(audioBuffer, config, recognizer);
  }

  /**
   * Synchronous transcription for short audio (< 60 seconds)
   */
  private async transcribeSync(
    audioBuffer: Buffer,
    config: google.cloud.speech.v2.IRecognitionConfig,
    recognizer: string
  ): Promise<TranscriptionResult> {
    const request: google.cloud.speech.v2.IRecognizeRequest = {
      recognizer,
      config,
      content: audioBuffer,
    };

    const [response] = await this.client.recognize(request);
    return this.parseResponse(response);
  }

  /**
   * Long-running transcription for audio > 60 seconds
   */
  private async transcribeLongRunning(
    audioBuffer: Buffer,
    config: google.cloud.speech.v2.IRecognitionConfig,
    recognizer: string
  ): Promise<TranscriptionResult> {
    const request: google.cloud.speech.v2.IBatchRecognizeRequest = {
      recognizer,
      config,
      files: [
        {
          content: audioBuffer,
        },
      ],
      recognitionOutputConfig: {
        inlineResponseConfig: {},
      },
    };

    const [operation] = await this.client.batchRecognize(request);
    const [response] = await operation.promise();

    // Extract results from batch response
    const results = response.results ?? {};
    const fileResults = Object.values(results);

    if (fileResults.length === 0 || !fileResults[0]?.transcript) {
      return {
        fullText: '',
        segments: [],
        languageCode: 'ja-JP',
        durationSeconds: 0,
      };
    }

    return this.parseResponse(fileResults[0].transcript);
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
