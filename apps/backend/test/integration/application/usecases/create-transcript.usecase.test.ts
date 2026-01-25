import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { v4 as uuidv4 } from 'uuid';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  CreateTranscriptUseCase,
  type CreateTranscriptUseCaseDeps,
} from '../../../../src/application/usecases/create-transcript.usecase.js';
import {
  RefineTranscriptUseCase,
  type RefineTranscriptUseCaseDeps,
} from '../../../../src/application/usecases/refine-transcript.usecase.js';
import type { RefinedTranscriptionRepositoryGateway } from '../../../../src/domain/gateways/refined-transcription-repository.gateway.js';
import type { TempStorageGateway } from '../../../../src/domain/gateways/temp-storage.gateway.js';
import type { TranscriptionRepositoryGateway } from '../../../../src/domain/gateways/transcription-repository.gateway.js';
import type { VideoRepositoryGateway } from '../../../../src/domain/gateways/video-repository.gateway.js';
import type { RefinedTranscription } from '../../../../src/domain/models/refined-transcription.js';
import type { Transcription } from '../../../../src/domain/models/transcription.js';
import { Video } from '../../../../src/domain/models/video.js';
import type { ProperNounDictionary } from '../../../../src/domain/services/transcript-refinement-prompt.service.js';
import { FFmpegClient } from '../../../../src/infrastructure/clients/ffmpeg.client.js';
import { LocalStorageClient } from '../../../../src/infrastructure/clients/local-storage.client.js';
import { OpenAIClient } from '../../../../src/infrastructure/clients/openai.client.js';
import { SpeechToTextClient } from '../../../../src/infrastructure/clients/speech-to-text.client.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_VIDEO_PATH = path.resolve(__dirname, '../../../fixtures/sample.mp4');

/**
 * Check if ffmpeg is available on the system
 */
function isFFmpegAvailable(): boolean {
  try {
    execSync('ffmpeg -version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if Google Cloud credentials are configured
 */
function isGoogleCloudConfigured(): boolean {
  return !!process.env.GOOGLE_CLOUD_PROJECT;
}

// Skip integration tests if INTEGRATION_TEST is not set or dependencies are not available
const runIntegrationTests =
  process.env.INTEGRATION_TEST === 'true' && isFFmpegAvailable() && isGoogleCloudConfigured();

/**
 * In-memory VideoRepository for testing
 */
class InMemoryVideoRepository implements VideoRepositoryGateway {
  private videos: Map<string, Video> = new Map();

  async save(video: Video): Promise<void> {
    this.videos.set(video.id, video);
  }

  async findById(id: string): Promise<Video | null> {
    return this.videos.get(id) ?? null;
  }

  async findByGoogleDriveFileId(fileId: string): Promise<Video | null> {
    for (const video of this.videos.values()) {
      if (video.googleDriveFileId === fileId) {
        return video;
      }
    }
    return null;
  }

  async findMany() {
    return { videos: [], total: 0 };
  }
}

/**
 * In-memory TranscriptionRepository for testing
 */
class InMemoryTranscriptionRepository implements TranscriptionRepositoryGateway {
  private transcriptions: Map<string, Transcription> = new Map();

  async save(transcription: Transcription): Promise<void> {
    this.transcriptions.set(transcription.id, transcription);
  }

  async findById(id: string): Promise<Transcription | null> {
    return this.transcriptions.get(id) ?? null;
  }

  async findByVideoId(videoId: string): Promise<Transcription | null> {
    for (const transcription of this.transcriptions.values()) {
      if (transcription.videoId === videoId) {
        return transcription;
      }
    }
    return null;
  }

  async deleteByVideoId(videoId: string): Promise<void> {
    for (const [id, transcription] of this.transcriptions.entries()) {
      if (transcription.videoId === videoId) {
        this.transcriptions.delete(id);
      }
    }
  }
}

/**
 * Stub TempStorageGateway that doesn't actually upload to GCS
 * (video buffer is already local, so caching is unnecessary)
 */
class StubTempStorageGateway implements TempStorageGateway {
  async upload() {
    return {
      gcsUri: 'gs://stub-bucket/stub-file',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };
  }

  async download(): Promise<Buffer> {
    throw new Error('Not implemented in stub');
  }

  async exists(): Promise<boolean> {
    return false;
  }
}

/**
 * In-memory RefinedTranscriptionRepository for testing
 */
class InMemoryRefinedTranscriptionRepository implements RefinedTranscriptionRepositoryGateway {
  private refinedTranscriptions: Map<string, RefinedTranscription> = new Map();

  async save(refinedTranscription: RefinedTranscription): Promise<void> {
    this.refinedTranscriptions.set(refinedTranscription.id, refinedTranscription);
  }

  async findById(id: string): Promise<RefinedTranscription | null> {
    return this.refinedTranscriptions.get(id) ?? null;
  }

  async findByTranscriptionId(transcriptionId: string): Promise<RefinedTranscription | null> {
    for (const refined of this.refinedTranscriptions.values()) {
      if (refined.transcriptionId === transcriptionId) {
        return refined;
      }
    }
    return null;
  }

  async deleteByTranscriptionId(transcriptionId: string): Promise<void> {
    for (const [id, refined] of this.refinedTranscriptions.entries()) {
      if (refined.transcriptionId === transcriptionId) {
        this.refinedTranscriptions.delete(id);
      }
    }
  }
}

/**
 * Load dictionary from JSON file
 */
async function loadDictionary(): Promise<ProperNounDictionary> {
  const dictionaryPath = path.resolve(
    __dirname,
    '../../../../src/infrastructure/data/proper-noun-dictionary.json'
  );
  const content = await fs.promises.readFile(dictionaryPath, 'utf-8');
  return JSON.parse(content) as ProperNounDictionary;
}

describe.skipIf(!runIntegrationTests)('CreateTranscriptUseCase Integration', () => {
  let useCase: CreateTranscriptUseCase;
  let videoRepository: InMemoryVideoRepository;
  let transcriptionRepository: InMemoryTranscriptionRepository;
  let localStorageClient: LocalStorageClient;
  let tempDir: string;

  beforeAll(async () => {
    // Create temp directory for LocalStorageClient
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'create-transcript-test-'));

    // Initialize clients
    localStorageClient = new LocalStorageClient(tempDir);
    const ffmpegClient = new FFmpegClient();
    const speechToTextClient = new SpeechToTextClient();

    // Initialize repositories
    videoRepository = new InMemoryVideoRepository();
    transcriptionRepository = new InMemoryTranscriptionRepository();

    // Create use case with real dependencies
    const deps: CreateTranscriptUseCaseDeps = {
      videoRepository,
      transcriptionRepository,
      storageGateway: localStorageClient,
      tempStorageGateway: new StubTempStorageGateway(),
      transcriptionGateway: speechToTextClient,
      videoProcessingGateway: ffmpegClient,
      generateId: () => uuidv4(),
    };

    useCase = new CreateTranscriptUseCase(deps);
  });

  afterAll(async () => {
    // Cleanup temp directory
    if (tempDir) {
      await localStorageClient.clear();
      await fs.promises.rmdir(tempDir);
    }
  });

  it('should transcribe a real video file end-to-end', async () => {
    // Arrange: Register sample.mp4 with LocalStorageClient
    const googleDriveFileId = `test-file-id-${uuidv4()}`;
    await localStorageClient.registerFile(googleDriveFileId, SAMPLE_VIDEO_PATH, {
      name: 'sample.mp4',
      mimeType: 'video/mp4',
    });

    // Create a Video entity
    const videoResult = Video.create(
      { googleDriveUrl: `https://drive.google.com/file/d/${googleDriveFileId}/view` },
      () => uuidv4()
    );
    expect(videoResult.success).toBe(true);
    if (!videoResult.success) return;

    const video = videoResult.value;
    await videoRepository.save(video);

    // Act: Execute the use case
    const result = await useCase.execute(video.id);

    // Assert: Check result
    expect(result).toHaveProperty('videoId', video.id);
    expect(result).toHaveProperty('transcriptionId');
    expect(result.transcriptionId).toBeTruthy();

    // Verify transcription was saved
    const savedTranscription = await transcriptionRepository.findById(result.transcriptionId);
    expect(savedTranscription).not.toBeNull();
    expect(savedTranscription?.videoId).toBe(video.id);
    expect(savedTranscription?.fullText.length).toBeGreaterThan(0);
    expect(savedTranscription?.segments.length).toBeGreaterThan(0);
    expect(savedTranscription?.durationSeconds).toBeGreaterThan(0);

    // Log the transcription for inspection
    console.log('Transcription result:', {
      fullText: savedTranscription?.fullText,
      segmentsCount: savedTranscription?.segments.length,
      durationSeconds: savedTranscription?.durationSeconds,
      languageCode: savedTranscription?.languageCode,
    });

    // Verify transcription contains expected content
    expect(savedTranscription?.fullText).toContain('2026');

    // Verify video status was updated
    const updatedVideo = await videoRepository.findById(video.id);
    expect(updatedVideo?.status).toBe('transcribed');

    // ===== Refine Transcript =====
    // Act: Execute RefineTranscriptUseCase
    const refinedTranscriptionRepository = new InMemoryRefinedTranscriptionRepository();
    const openaiClient = new OpenAIClient();

    const refineDeps: RefineTranscriptUseCaseDeps = {
      transcriptionRepository,
      refinedTranscriptionRepository,
      aiGateway: openaiClient,
      generateId: () => uuidv4(),
      loadDictionary,
    };
    const refineUseCase = new RefineTranscriptUseCase(refineDeps);

    const refineResult = await refineUseCase.execute(video.id);

    // Assert: Refined transcription was created
    expect(refineResult).toHaveProperty('id');
    expect(refineResult).toHaveProperty('transcriptionId', savedTranscription?.id);
    expect(refineResult).toHaveProperty('fullText');
    expect(refineResult.sentenceCount).toBeGreaterThan(0);
    expect(refineResult.dictionaryVersion).toBe('1.0.0');

    // Verify refined transcription was saved
    const savedRefinedTranscription = await refinedTranscriptionRepository.findById(
      refineResult.id
    );
    expect(savedRefinedTranscription).not.toBeNull();
    expect(savedRefinedTranscription?.sentences.length).toBeGreaterThan(0);

    // Log the refined transcription for inspection
    console.log('Refined transcription result:', {
      fullText: savedRefinedTranscription?.fullText,
      sentenceCount: savedRefinedTranscription?.sentences.length,
      dictionaryVersion: savedRefinedTranscription?.dictionaryVersion,
    });

    // Verify refined transcription contains corrected content
    // 「安野たかひろ」が正しく校正されていることを確認
    expect(savedRefinedTranscription?.fullText).toContain('安野たかひろ');
  }, 180000); // 3 minute timeout for transcription + refinement
});
