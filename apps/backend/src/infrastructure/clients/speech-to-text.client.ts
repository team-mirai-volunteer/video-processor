import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { v2 } from '@google-cloud/speech';
import type { google } from '@google-cloud/speech/build/protos/protos.js';
import { Storage } from '@google-cloud/storage';
import { v4 as uuidv4 } from 'uuid';
import type {
  TranscribeFromGcsParams,
  TranscribeParams,
  TranscriptionGateway,
  TranscriptionResult,
  TranscriptionSegment,
} from '../../domain/gateways/transcription.gateway.js';
import { createLogger } from '../logging/logger.js';

const log = createLogger('SpeechToTextClient');

interface DictionaryEntry {
  correct: string;
  category: 'person' | 'organization' | 'service' | 'political_term';
  description: string;
  wrongPatterns: string[];
}

interface ProperNounDictionary {
  version: string;
  description: string;
  entries: DictionaryEntry[];
}

const BOOST_BY_CATEGORY: Record<DictionaryEntry['category'], number> = {
  person: 15,
  organization: 15,
  service: 10,
  political_term: 5,
};

/**
 * Google Cloud Speech-to-Text API v2 client implementation using Chirp 2 model
 * Implements TranscriptionGateway interface
 */
export class SpeechToTextClient implements TranscriptionGateway {
  private readonly client: v2.SpeechClient;
  private readonly storage: Storage;
  private readonly projectId: string;
  private readonly location: string;
  private readonly bucketName: string;
  private readonly adaptation: google.cloud.speech.v2.ISpeechAdaptation;

  constructor() {
    this.projectId = process.env.GOOGLE_CLOUD_PROJECT ?? '';
    this.location = process.env.SPEECH_TO_TEXT_LOCATION ?? 'us-central1';
    this.bucketName = process.env.SPEECH_TO_TEXT_BUCKET ?? `${this.projectId}-speech-to-text`;

    if (!this.projectId) {
      throw new Error('GOOGLE_CLOUD_PROJECT environment variable is required');
    }

    const credentials = this.getCredentials();

    this.client = new v2.SpeechClient({
      apiEndpoint: `${this.location}-speech.googleapis.com`,
      projectId: this.projectId,
      credentials,
    });
    this.storage = new Storage({
      projectId: this.projectId,
      credentials,
    });
    this.adaptation = this.loadDictionary();
  }

  private getCredentials(): { client_email: string; private_key: string } | undefined {
    // Try GOOGLE_APPLICATION_CREDENTIALS_JSON first
    const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    if (credentialsJson) {
      try {
        const credentials = JSON.parse(credentialsJson);
        return {
          client_email: credentials.client_email,
          private_key: credentials.private_key,
        };
      } catch {
        throw new Error('Failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON');
      }
    }

    // Fall back to individual env vars
    const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY;

    if (clientEmail && privateKey) {
      return {
        client_email: clientEmail,
        private_key: privateKey,
      };
    }

    return undefined;
  }

  /**
   * Transcribe audio using Google Cloud Speech-to-Text API v2 with Chirp 2 model
   * @param params Transcription parameters
   * @returns Transcription result with segments and timestamps
   */
  async transcribe(params: TranscribeParams): Promise<TranscriptionResult> {
    const { audioBuffer, languageCode } = params;

    const config: google.cloud.speech.v2.IRecognitionConfig = {
      autoDecodingConfig: {},
      languageCodes: languageCode ? [languageCode] : ['ja-JP'],
      model: 'chirp_2',
      features: {
        enableWordTimeOffsets: true,
        enableAutomaticPunctuation: true,
      },
      adaptation: this.adaptation,
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

      // Configure Batch Recognize request with Chirp 2 model
      const config: google.cloud.speech.v2.IRecognitionConfig = {
        autoDecodingConfig: {},
        languageCodes: languageCode ? [languageCode] : ['ja-JP'],
        model: 'chirp_2',
        features: {
          enableWordTimeOffsets: true,
          enableAutomaticPunctuation: true,
        },
        adaptation: this.adaptation,
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
   * Transcribe audio from GCS URI using Batch Recognize API
   * More efficient when audio is already in GCS (no upload required)
   * @param params Transcription parameters with GCS URI
   * @returns Transcription result with segments and timestamps
   */
  async transcribeLongAudioFromGcsUri(
    params: TranscribeFromGcsParams
  ): Promise<TranscriptionResult> {
    const { gcsUri, languageCode } = params;

    // Configure Batch Recognize request with Chirp 2 model
    const config: google.cloud.speech.v2.IRecognitionConfig = {
      autoDecodingConfig: {},
      languageCodes: languageCode ? [languageCode] : ['ja-JP'],
      model: 'chirp_2',
      features: {
        enableWordTimeOffsets: true,
        enableAutomaticPunctuation: true,
      },
      adaptation: this.adaptation,
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

  /**
   * Load proper noun dictionary for Speech Adaptation
   */
  private loadDictionary(): google.cloud.speech.v2.ISpeechAdaptation {
    try {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      const dictionaryPath = join(__dirname, '../data/proper-noun-dictionary.json');
      const dictionaryJson = readFileSync(dictionaryPath, 'utf-8');
      const dictionary: ProperNounDictionary = JSON.parse(dictionaryJson);

      const phrases = dictionary.entries.map((entry) => ({
        value: entry.correct,
        boost: BOOST_BY_CATEGORY[entry.category],
      }));

      return {
        phraseSets: [
          {
            inlinePhraseSet: {
              phrases,
            },
          },
        ],
      };
    } catch (error) {
      log.warn('Failed to load dictionary, continuing without adaptation', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {};
    }
  }
}
