import { v2 } from '@google-cloud/speech';
import type { google } from '@google-cloud/speech/build/protos/protos.js';
import { Storage } from '@google-cloud/storage';
import { v4 as uuidv4 } from 'uuid';
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
  private readonly storage: Storage;
  private readonly projectId: string;
  private readonly location: string;
  private readonly bucketName: string;

  constructor() {
    this.projectId = process.env.GOOGLE_CLOUD_PROJECT ?? '';
    this.location = process.env.SPEECH_TO_TEXT_LOCATION ?? 'us-central1';
    this.bucketName = process.env.SPEECH_TO_TEXT_BUCKET ?? `${this.projectId}-speech-to-text`;
    this.client = new v2.SpeechClient({
      apiEndpoint: `${this.location}-speech.googleapis.com`,
    });
    this.storage = new Storage();

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
   * Transcribe long audio using GCS and Batch Recognize API
   * Supports audio files up to 480 minutes
   * @param params Transcription parameters
   * @returns Transcription result with segments and timestamps
   */
  async transcribeLongAudio(params: TranscribeParams): Promise<TranscriptionResult> {
    const { audioBuffer, mimeType, languageCode } = params;

    // Generate unique filename
    const fileId = uuidv4();
    const extension = mimeType === 'audio/flac' ? 'flac' : 'wav';
    const gcsFileName = `audio/${fileId}.${extension}`;
    const gcsUri = `gs://${this.bucketName}/${gcsFileName}`;

    try {
      // Upload audio to GCS
      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(gcsFileName);
      await file.save(audioBuffer, {
        contentType: mimeType,
      });

      // Configure Batch Recognize request
      const config: google.cloud.speech.v2.IRecognitionConfig = {
        autoDecodingConfig: {},
        languageCodes: languageCode ? [languageCode] : ['ja-JP'],
        model: 'chirp',
        features: {
          enableWordTimeOffsets: true,
        },
      };

      const recognizer = `projects/${this.projectId}/locations/${this.location}/recognizers/_`;

      const request: google.cloud.speech.v2.IBatchRecognizeRequest = {
        recognizer,
        config,
        files: [{ uri: gcsUri }],
        recognitionOutputConfig: {
          inlineResponseConfig: {},
        },
      };

      // Call Batch Recognize API (returns a long-running operation)
      const [operation] = await this.client.batchRecognize(request);

      // Wait for operation to complete
      const [response] = await operation.promise();

      // Parse the inline response
      return this.parseBatchResponse(response);
    } finally {
      // Cleanup: delete the uploaded file
      try {
        const bucket = this.storage.bucket(this.bucketName);
        await bucket.file(gcsFileName).delete();
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Parse Batch Recognize API response into TranscriptionResult
   */
  private parseBatchResponse(
    response: google.cloud.speech.v2.IBatchRecognizeResponse
  ): TranscriptionResult {
    const segments: TranscriptionSegment[] = [];
    let fullText = '';
    let detectedLanguage = 'ja-JP';
    let maxEndTime = 0;

    // Batch response contains results keyed by file URI
    for (const fileResult of Object.values(response.results ?? {})) {
      const transcript = fileResult.transcript;
      if (!transcript) continue;

      for (const result of transcript.results ?? []) {
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
