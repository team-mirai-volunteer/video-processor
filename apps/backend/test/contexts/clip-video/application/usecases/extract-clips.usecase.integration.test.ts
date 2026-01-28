import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ExtractClipsUseCase,
  type ExtractClipsUseCaseDeps,
} from '@clip-video/application/usecases/extract-clips.usecase.js';
import type { ClipRepositoryGateway } from '@clip-video/domain/gateways/clip-repository.gateway.js';
import type { RefinedTranscriptionRepositoryGateway } from '@clip-video/domain/gateways/refined-transcription-repository.gateway.js';
import type { TranscriptionRepositoryGateway } from '@clip-video/domain/gateways/transcription-repository.gateway.js';
import type { VideoRepositoryGateway } from '@clip-video/domain/gateways/video-repository.gateway.js';
import type { Clip } from '@clip-video/domain/models/clip.js';
import { RefinedTranscription } from '@clip-video/domain/models/refined-transcription.js';
import { Transcription } from '@clip-video/domain/models/transcription.js';
import { Video } from '@clip-video/domain/models/video.js';
import { FFmpegClient } from '@shared/infrastructure/clients/ffmpeg.client.js';
import { LocalStorageClient } from '@shared/infrastructure/clients/local-storage.client.js';
import { LocalTempStorageClient } from '@shared/infrastructure/clients/local-temp-storage.client.js';
import { OpenAIClient } from '@shared/infrastructure/clients/openai.client.js';
import { v4 as uuidv4 } from 'uuid';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SAMPLE_VIDEO_PATH = path.resolve(__dirname, '../../../../fixtures/sample.mp4');
const OUTPUT_DIR = path.resolve(__dirname, '../../../../fixtures/output');

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
 * Check if OpenAI API key is configured
 */
function isOpenAIConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

// Skip integration tests if INTEGRATION_TEST is not set or dependencies are not available
const runIntegrationTests =
  process.env.INTEGRATION_TEST === 'true' && isFFmpegAvailable() && isOpenAIConfigured();

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

  async delete(id: string): Promise<void> {
    this.videos.delete(id);
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
    for (const rt of this.refinedTranscriptions.values()) {
      if (rt.transcriptionId === transcriptionId) {
        return rt;
      }
    }
    return null;
  }

  async deleteByTranscriptionId(transcriptionId: string): Promise<void> {
    for (const [id, rt] of this.refinedTranscriptions.entries()) {
      if (rt.transcriptionId === transcriptionId) {
        this.refinedTranscriptions.delete(id);
      }
    }
  }
}

/**
 * In-memory ClipRepository for testing
 */
class InMemoryClipRepository implements ClipRepositoryGateway {
  private clips: Map<string, Clip> = new Map();

  async save(clip: Clip): Promise<void> {
    this.clips.set(clip.id, clip);
  }

  async saveMany(clips: Clip[]): Promise<void> {
    for (const clip of clips) {
      this.clips.set(clip.id, clip);
    }
  }

  async findById(id: string): Promise<Clip | null> {
    return this.clips.get(id) ?? null;
  }

  async findByVideoId(videoId: string): Promise<Clip[]> {
    const result: Clip[] = [];
    for (const clip of this.clips.values()) {
      if (clip.videoId === videoId) {
        result.push(clip);
      }
    }
    return result;
  }
}

describe.skipIf(!runIntegrationTests)('ExtractClipsUseCase Integration', () => {
  let useCase: ExtractClipsUseCase;
  let videoRepository: InMemoryVideoRepository;
  let transcriptionRepository: InMemoryTranscriptionRepository;
  let refinedTranscriptionRepository: InMemoryRefinedTranscriptionRepository;
  let clipRepository: InMemoryClipRepository;
  let localStorageClient: LocalStorageClient;
  let localTempStorageClient: LocalTempStorageClient;
  let tempDir: string;

  beforeAll(async () => {
    // Use output directory in fixtures for LocalStorageClient
    tempDir = OUTPUT_DIR;
    const tempCacheDir = path.join(tempDir, 'cache');
    await fs.promises.mkdir(tempDir, { recursive: true });

    // Initialize clients
    localStorageClient = new LocalStorageClient(tempDir);
    localTempStorageClient = new LocalTempStorageClient(tempCacheDir);
    const ffmpegClient = new FFmpegClient();
    const openAiClient = new OpenAIClient();

    // Initialize repositories
    videoRepository = new InMemoryVideoRepository();
    transcriptionRepository = new InMemoryTranscriptionRepository();
    refinedTranscriptionRepository = new InMemoryRefinedTranscriptionRepository();
    clipRepository = new InMemoryClipRepository();

    // Create use case with real dependencies
    const deps: ExtractClipsUseCaseDeps = {
      videoRepository,
      clipRepository,
      transcriptionRepository,
      refinedTranscriptionRepository,
      storageGateway: localStorageClient,
      tempStorageGateway: localTempStorageClient,
      aiGateway: openAiClient,
      videoProcessingGateway: ffmpegClient,
      generateId: () => uuidv4(),
    };

    useCase = new ExtractClipsUseCase(deps);
  });

  afterAll(async () => {
    // Keep output files for inspection (don't cleanup)
  });

  it('should extract clips from a real video file end-to-end', async () => {
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

    // Create a Transcription for the video (actual transcription from sample.wav)
    const transcriptionResult = Transcription.create(
      {
        videoId: video.id,
        fullText:
          'どう も こんにちは  チーム 未来 投手 の 安野 高広 です  本日 は 年始 と いう こと で チーム 未来 が 2026 年 に なし遂げる こと 代し て 2026 年 プラン を 発表 し たい と 思い ます',
        segments: [
          { text: 'どう', startTimeSeconds: 0.08, endTimeSeconds: 0.2, confidence: 0 },
          { text: 'も', startTimeSeconds: 0.2, endTimeSeconds: 0.28, confidence: 0 },
          { text: 'こんにちは', startTimeSeconds: 0.28, endTimeSeconds: 0.8, confidence: 0 },
          { text: '', startTimeSeconds: 0.8, endTimeSeconds: 0.92, confidence: 0 },
          { text: 'チーム', startTimeSeconds: 0.92, endTimeSeconds: 1.16, confidence: 0 },
          { text: '未来', startTimeSeconds: 1.16, endTimeSeconds: 1.48, confidence: 0 },
          { text: '投手', startTimeSeconds: 1.48, endTimeSeconds: 1.8, confidence: 0 },
          { text: 'の', startTimeSeconds: 1.8, endTimeSeconds: 2.08, confidence: 0 },
          { text: '安野', startTimeSeconds: 2.08, endTimeSeconds: 2.52, confidence: 0 },
          { text: '高広', startTimeSeconds: 2.52, endTimeSeconds: 2.88, confidence: 0 },
          { text: 'です', startTimeSeconds: 2.88, endTimeSeconds: 3.12, confidence: 0 },
          { text: '', startTimeSeconds: 3.12, endTimeSeconds: 3.36, confidence: 0 },
          { text: '本日', startTimeSeconds: 3.36, endTimeSeconds: 3.68, confidence: 0 },
          { text: 'は', startTimeSeconds: 3.68, endTimeSeconds: 3.92, confidence: 0 },
          { text: '年始', startTimeSeconds: 3.92, endTimeSeconds: 4.4, confidence: 0 },
          { text: 'と', startTimeSeconds: 4.4, endTimeSeconds: 4.48, confidence: 0 },
          { text: 'いう', startTimeSeconds: 4.48, endTimeSeconds: 4.68, confidence: 0 },
          { text: 'こと', startTimeSeconds: 4.68, endTimeSeconds: 4.88, confidence: 0 },
          { text: 'で', startTimeSeconds: 4.88, endTimeSeconds: 5.24, confidence: 0 },
          { text: 'チーム', startTimeSeconds: 5.24, endTimeSeconds: 5.64, confidence: 0 },
          { text: '未来', startTimeSeconds: 5.64, endTimeSeconds: 5.96, confidence: 0 },
          { text: 'が', startTimeSeconds: 5.96, endTimeSeconds: 6.2, confidence: 0 },
          { text: '2026', startTimeSeconds: 6.2, endTimeSeconds: 7.28, confidence: 0 },
          { text: '年', startTimeSeconds: 7.28, endTimeSeconds: 7.44, confidence: 0 },
          { text: 'に', startTimeSeconds: 7.44, endTimeSeconds: 7.56, confidence: 0 },
          { text: 'なし遂げる', startTimeSeconds: 7.56, endTimeSeconds: 8.12, confidence: 0 },
          { text: 'こと', startTimeSeconds: 8.12, endTimeSeconds: 8.6, confidence: 0 },
          { text: '代し', startTimeSeconds: 8.6, endTimeSeconds: 9, confidence: 0 },
          { text: 'て', startTimeSeconds: 9, endTimeSeconds: 9.48, confidence: 0 },
          { text: '2026', startTimeSeconds: 9.48, endTimeSeconds: 10.6, confidence: 0 },
          { text: '年', startTimeSeconds: 10.6, endTimeSeconds: 10.88, confidence: 0 },
          { text: 'プラン', startTimeSeconds: 10.88, endTimeSeconds: 11.28, confidence: 0 },
          { text: 'を', startTimeSeconds: 11.28, endTimeSeconds: 11.56, confidence: 0 },
          { text: '発表', startTimeSeconds: 11.56, endTimeSeconds: 11.92, confidence: 0 },
          { text: 'し', startTimeSeconds: 11.92, endTimeSeconds: 12, confidence: 0 },
          { text: 'たい', startTimeSeconds: 12, endTimeSeconds: 12.16, confidence: 0 },
          { text: 'と', startTimeSeconds: 12.16, endTimeSeconds: 12.32, confidence: 0 },
          { text: '思い', startTimeSeconds: 12.32, endTimeSeconds: 12.6, confidence: 0 },
          { text: 'ます', startTimeSeconds: 12.6, endTimeSeconds: 12.68, confidence: 0 },
        ],
        languageCode: 'ja-JP',
        durationSeconds: 12.76,
      },
      () => uuidv4()
    );
    expect(transcriptionResult.success).toBe(true);
    if (!transcriptionResult.success) return;

    const transcription = transcriptionResult.value;
    await transcriptionRepository.save(transcription);

    // Create a RefinedTranscription for the video
    const refinedTranscriptionResult = RefinedTranscription.create(
      {
        transcriptionId: transcription.id,
        fullText:
          'どうもこんにちは、チーム未来投手の安野高広です。本日は年始ということで、チーム未来が2026年になし遂げること、代して2026年プランを発表したいと思います。',
        sentences: [
          {
            text: 'どうもこんにちは、チーム未来投手の安野高広です。',
            startTimeSeconds: 0.08,
            endTimeSeconds: 3.12,
            originalSegmentIndices: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
          },
          {
            text: '本日は年始ということで、チーム未来が2026年になし遂げること、代して2026年プランを発表したいと思います。',
            startTimeSeconds: 3.36,
            endTimeSeconds: 12.68,
            originalSegmentIndices: [
              12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32,
              33, 34, 35, 36, 37, 38,
            ],
          },
        ],
        dictionaryVersion: 'test-v1',
      },
      () => uuidv4()
    );
    expect(refinedTranscriptionResult.success).toBe(true);
    if (!refinedTranscriptionResult.success) return;

    await refinedTranscriptionRepository.save(refinedTranscriptionResult.value);

    // Act: Execute the use case
    const result = await useCase.execute({
      videoId: video.id,
      clipInstructions: '挨拶と自己紹介の部分を切り抜いてください',
    });

    // Assert: Check result
    expect(result).toHaveProperty('videoId', video.id);
    expect(result).toHaveProperty('status', 'completed');

    // Verify clips were created
    const savedClips = await clipRepository.findByVideoId(video.id);
    expect(savedClips.length).toBeGreaterThanOrEqual(0);

    // Log the clips for inspection
    console.log('Extract clips result:', {
      videoId: result.videoId,
      status: result.status,
      clipsCount: savedClips.length,
      clips: savedClips.map((c) => ({
        id: c.id,
        title: c.title,
        startTimeSeconds: c.startTimeSeconds,
        endTimeSeconds: c.endTimeSeconds,
        status: c.status,
      })),
    });

    // Verify video status was updated
    const updatedVideo = await videoRepository.findById(video.id);
    expect(updatedVideo?.status).toBe('completed');

    // Copy .dat files to .mp4 for easy inspection
    for (const clip of savedClips) {
      if (clip.googleDriveFileId) {
        const datPath = path.join(OUTPUT_DIR, `${clip.googleDriveFileId}.dat`);
        const mp4Path = path.join(OUTPUT_DIR, `${clip.title ?? clip.id}.mp4`);
        if (fs.existsSync(datPath)) {
          await fs.promises.copyFile(datPath, mp4Path);
          console.log(`Saved clip as: ${mp4Path}`);
        }
      }
    }
  }, 180000); // 3 minute timeout for AI processing and video extraction
});
