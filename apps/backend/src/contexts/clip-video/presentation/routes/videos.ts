import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NotFoundError } from '@clip-video/application/errors/errors.js';
import { CacheVideoUseCase } from '@clip-video/application/usecases/cache-video.usecase.js';
import { CreateTranscriptUseCase } from '@clip-video/application/usecases/create-transcript.usecase.js';
import { DeleteVideoUseCase } from '@clip-video/application/usecases/delete-video.usecase.js';
import { ExtractAudioUseCase } from '@clip-video/application/usecases/extract-audio.usecase.js';
import { ExtractClipsUseCase } from '@clip-video/application/usecases/extract-clips.usecase.js';
import { GetVideoUseCase } from '@clip-video/application/usecases/get-video.usecase.js';
import { GetVideosUseCase } from '@clip-video/application/usecases/get-videos.usecase.js';
import { RefineTranscriptUseCase } from '@clip-video/application/usecases/refine-transcript.usecase.js';
import { SubmitVideoUseCase } from '@clip-video/application/usecases/submit-video.usecase.js';
import { TranscribeAudioUseCase } from '@clip-video/application/usecases/transcribe-audio.usecase.js';
import type { TempStorageGateway } from '@clip-video/domain/gateways/temp-storage.gateway.js';
import {
  refinedTranscriptionToSrt,
  transcriptionToSrt,
} from '@clip-video/domain/services/srt-converter.service.js';
import type { ProperNounDictionary } from '@clip-video/domain/services/transcript-refinement-prompt.service.js';
import { ClipRepository } from '@clip-video/infrastructure/repositories/clip.repository.js';
import { ProcessingJobRepository } from '@clip-video/infrastructure/repositories/processing-job.repository.js';
import { RefinedTranscriptionRepository } from '@clip-video/infrastructure/repositories/refined-transcription.repository.js';
import { TranscriptionRepository } from '@clip-video/infrastructure/repositories/transcription.repository.js';
import { VideoRepository } from '@clip-video/infrastructure/repositories/video.repository.js';
import { FFmpegClient } from '@shared/infrastructure/clients/ffmpeg.client.js';
import { GcsClient } from '@shared/infrastructure/clients/gcs.client.js';
import { GoogleDriveClient } from '@shared/infrastructure/clients/google-drive.client.js';
import { LocalTempStorageClient } from '@shared/infrastructure/clients/local-temp-storage.client.js';
import { OpenAIClient } from '@shared/infrastructure/clients/openai.client.js';
import { SpeechToTextClient } from '@shared/infrastructure/clients/speech-to-text.client.js';
import { prisma } from '@shared/infrastructure/database/connection.js';
import { logger } from '@shared/infrastructure/logging/logger.js';
import type {
  CacheVideoResponse,
  ExtractAudioResponse,
  ExtractClipsRequest,
  GetRefinedTranscriptionResponse,
  GetTranscriptionResponse,
  GetVideosQuery,
  RefineTranscriptResponse,
  SubmitVideoRequest,
  TranscribeAudioResponse,
  TranscribeVideoResponse,
  VideoStatus,
} from '@video-processor/shared';
import { type Router as ExpressRouter, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function loadDictionary(): Promise<ProperNounDictionary> {
  const dictionaryPath = path.resolve(
    __dirname,
    '../../infrastructure/data/proper-noun-dictionary.json'
  );
  const content = await readFile(dictionaryPath, 'utf-8');
  return JSON.parse(content) as ProperNounDictionary;
}

const router: ExpressRouter = Router();

// Initialize repositories
const videoRepository = new VideoRepository(prisma);
const clipRepository = new ClipRepository(prisma);
const processingJobRepository = new ProcessingJobRepository(prisma);
const transcriptionRepository = new TranscriptionRepository(prisma);
const refinedTranscriptionRepository = new RefinedTranscriptionRepository(prisma);

// Initialize gateways based on environment
// TEMP_STORAGE_TYPE=local でローカル、それ以外はGCS（デフォルト）
function createTempStorageGateway(): TempStorageGateway {
  if (process.env.TEMP_STORAGE_TYPE === 'local') {
    return new LocalTempStorageClient();
  }
  return new GcsClient();
}

const tempStorageGateway = createTempStorageGateway();

// Initialize shared gateway
const storageGateway = GoogleDriveClient.fromEnv();

// Initialize use cases
const submitVideoUseCase = new SubmitVideoUseCase({
  videoRepository,
  storageGateway,
  generateId: () => uuidv4(),
});

const getVideosUseCase = new GetVideosUseCase({
  videoRepository,
});

const getVideoUseCase = new GetVideoUseCase({
  videoRepository,
  clipRepository,
  processingJobRepository,
  transcriptionRepository,
});

const extractClipsUseCase = new ExtractClipsUseCase({
  videoRepository,
  clipRepository,
  transcriptionRepository,
  refinedTranscriptionRepository,
  storageGateway,
  tempStorageGateway,
  aiGateway: new OpenAIClient(),
  videoProcessingGateway: new FFmpegClient(),
  generateId: () => uuidv4(),
  outputFolderId: process.env.GOOGLE_DRIVE_OUTPUT_FOLDER_ID,
});

const refineTranscriptUseCase = new RefineTranscriptUseCase({
  transcriptionRepository,
  refinedTranscriptionRepository,
  videoRepository,
  storageGateway,
  aiGateway: new OpenAIClient(),
  generateId: () => uuidv4(),
  loadDictionary,
  transcriptOutputFolderId: process.env.TRANSCRIPT_OUTPUT_FOLDER_ID,
});

// Initialize sub-usecases for CreateTranscriptUseCase

const cacheVideoUseCase = new CacheVideoUseCase({
  videoRepository,
  storageGateway,
  tempStorageGateway,
});

const extractAudioUseCase = new ExtractAudioUseCase({
  videoRepository,
  tempStorageGateway,
  videoProcessingGateway: new FFmpegClient(),
});

const transcribeAudioUseCase = new TranscribeAudioUseCase({
  videoRepository,
  transcriptionRepository,
  transcriptionGateway: new SpeechToTextClient(),
  generateId: () => uuidv4(),
});

const createTranscriptUseCase = new CreateTranscriptUseCase({
  videoRepository,
  cacheVideoUseCase,
  extractAudioUseCase,
  transcribeAudioUseCase,
  refineTranscriptUseCase,
});

const deleteVideoUseCase = new DeleteVideoUseCase({
  videoRepository,
});

/**
 * POST /api/videos
 * Register a video (does not start processing)
 */
router.post('/', async (req, res, next) => {
  try {
    const body = req.body as SubmitVideoRequest;
    const result = await submitVideoUseCase.execute({
      googleDriveUrl: body.googleDriveUrl,
    });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/videos/:videoId/transcribe
 * Start transcription for a video
 */
router.post('/:videoId/transcribe', async (req, res, next) => {
  try {
    const { videoId } = req.params;

    // Return immediately with transcribing status
    const response: TranscribeVideoResponse = {
      videoId: videoId ?? '',
      status: 'transcribing',
    };
    res.status(202).json(response);

    // Execute transcription in background (fire and forget)
    createTranscriptUseCase.execute(videoId ?? '').catch((error) => {
      logger.error('[VideosRoute] Background transcription failed', error as Error, { videoId });
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/videos/:videoId/cache
 * Cache video from Google Drive to GCS
 */
router.post('/:videoId/cache', async (req, res, next) => {
  try {
    const { videoId } = req.params;
    const result = await cacheVideoUseCase.execute(videoId ?? '');

    const response: CacheVideoResponse = {
      videoId: result.videoId,
      gcsUri: result.gcsUri,
      expiresAt: result.expiresAt.toISOString(),
      cached: result.cached,
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/videos/:videoId/extract-audio
 * Extract audio from cached video (stream version)
 */
router.post('/:videoId/extract-audio', async (req, res, next) => {
  try {
    const { videoId } = req.params;
    const result = await extractAudioUseCase.execute(videoId ?? '', 'flac');

    const response: ExtractAudioResponse = {
      videoId: result.videoId,
      format: 'flac',
      audioGcsUri: result.audioGcsUri,
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/videos/:videoId/transcribe-audio
 * Transcribe audio from video. Auto-executes cache and extract-audio if needed.
 */
router.post('/:videoId/transcribe-audio', async (req, res, next) => {
  try {
    const { videoId } = req.params;

    // Step 1: Cache video (auto-skips if already cached)
    await cacheVideoUseCase.execute(videoId ?? '');

    // Step 2: Extract audio (stream version - uploads to GCS)
    const audioResult = await extractAudioUseCase.execute(videoId ?? '', 'flac');

    // Step 3: Transcribe audio from GCS URI
    const transcribeResult = await transcribeAudioUseCase.execute({
      videoId: videoId ?? '',
      audioGcsUri: audioResult.audioGcsUri,
    });

    const response: TranscribeAudioResponse = {
      videoId: transcribeResult.videoId,
      transcriptionId: transcribeResult.transcriptionId,
      segmentsCount: transcribeResult.segmentsCount,
      durationSeconds: transcribeResult.durationSeconds,
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/videos/:videoId/extract-clips
 * Extract clips from a transcribed video
 */
router.post('/:videoId/extract-clips', async (req, res, next) => {
  try {
    const { videoId } = req.params;
    const body = req.body as ExtractClipsRequest;
    const result = await extractClipsUseCase.execute({
      videoId: videoId ?? '',
      clipInstructions: body.clipInstructions,
      multipleClips: body.multipleClips ?? false,
    });
    res.status(202).json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/videos
 * Get paginated list of videos
 */
router.get('/', async (req, res, next) => {
  try {
    const query = req.query as unknown as GetVideosQuery;
    const result = await getVideosUseCase.execute({
      page: query.page ? Number(query.page) : undefined,
      limit: query.limit ? Number(query.limit) : undefined,
      status: query.status as VideoStatus | undefined,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/videos/:id
 * Get video details with clips and processing jobs
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await getVideoUseCase.execute(id ?? '');
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/videos/:id
 * Delete a video and all related data (clips, transcriptions, jobs)
 * Note: Does not delete the file from Google Drive
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    await deleteVideoUseCase.execute(id ?? '');
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/videos/:videoId/transcription
 * Get transcription for a video
 */
router.get('/:videoId/transcription', async (req, res, next) => {
  try {
    const { videoId } = req.params;
    const transcription = await transcriptionRepository.findByVideoId(videoId ?? '');

    if (!transcription) {
      throw new NotFoundError('Transcription', videoId ?? '');
    }

    const response: GetTranscriptionResponse = {
      id: transcription.id,
      videoId: transcription.videoId,
      fullText: transcription.fullText,
      segments: transcription.segments,
      languageCode: transcription.languageCode,
      durationSeconds: transcription.durationSeconds,
      createdAt: transcription.createdAt,
    };
    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/videos/:videoId/refine-transcript
 * Start transcript refinement for a video
 */
router.post('/:videoId/refine-transcript', async (req, res, next) => {
  try {
    const { videoId } = req.params;

    // Execute refinement and wait for completion
    await refineTranscriptUseCase.execute(videoId ?? '');

    const response: RefineTranscriptResponse = {
      videoId: videoId ?? '',
      status: 'refined',
    };
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/videos/:videoId/transcription/refined
 * Get refined transcription for a video
 */
router.get('/:videoId/transcription/refined', async (req, res, next) => {
  try {
    const { videoId } = req.params;

    // First get raw transcription to get transcriptionId
    const transcription = await transcriptionRepository.findByVideoId(videoId ?? '');
    if (!transcription) {
      throw new NotFoundError('Transcription', videoId ?? '');
    }

    // Then get refined transcription
    const refinedTranscription = await refinedTranscriptionRepository.findByTranscriptionId(
      transcription.id
    );

    if (!refinedTranscription) {
      throw new NotFoundError('RefinedTranscription', videoId ?? '');
    }

    const response: GetRefinedTranscriptionResponse = {
      id: refinedTranscription.id,
      transcriptionId: refinedTranscription.transcriptionId,
      fullText: refinedTranscription.fullText,
      sentences: refinedTranscription.sentences,
      dictionaryVersion: refinedTranscription.dictionaryVersion,
      createdAt: refinedTranscription.createdAt,
      updatedAt: refinedTranscription.updatedAt,
    };
    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/videos/:videoId/transcription/srt
 * Download transcription as SRT file
 * Uses refined transcription if available, otherwise raw transcription
 */
router.get('/:videoId/transcription/srt', async (req, res, next) => {
  try {
    const { videoId } = req.params;

    // First get raw transcription
    const transcription = await transcriptionRepository.findByVideoId(videoId ?? '');
    if (!transcription) {
      throw new NotFoundError('Transcription', videoId ?? '');
    }

    // Try to get refined transcription
    const refinedTranscription = await refinedTranscriptionRepository.findByTranscriptionId(
      transcription.id
    );

    // Generate SRT content
    let srtContent: string;
    if (refinedTranscription) {
      srtContent = refinedTranscriptionToSrt(refinedTranscription.sentences);
    } else {
      srtContent = transcriptionToSrt(transcription.segments);
    }

    // Set headers for file download
    const filename = `transcription-${videoId}.srt`;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(srtContent);
  } catch (error) {
    next(error);
  }
});

export default router;
