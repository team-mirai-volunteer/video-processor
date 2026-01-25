import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  ExtractClipsRequest,
  GetRefinedTranscriptionResponse,
  GetTranscriptionResponse,
  GetVideosQuery,
  RefineTranscriptResponse,
  SubmitVideoRequest,
  TranscribeVideoResponse,
  VideoStatus,
} from '@video-processor/shared';
import { type Router as ExpressRouter, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { NotFoundError } from '../../application/errors.js';
import { CreateTranscriptUseCase } from '../../application/usecases/create-transcript.usecase.js';
import { DeleteVideoUseCase } from '../../application/usecases/delete-video.usecase.js';
import { ExtractClipsUseCase } from '../../application/usecases/extract-clips.usecase.js';
import { GetVideoUseCase } from '../../application/usecases/get-video.usecase.js';
import { GetVideosUseCase } from '../../application/usecases/get-videos.usecase.js';
import { RefineTranscriptUseCase } from '../../application/usecases/refine-transcript.usecase.js';
import { SubmitVideoUseCase } from '../../application/usecases/submit-video.usecase.js';
import type { TempStorageGateway } from '../../domain/gateways/temp-storage.gateway.js';
import type { ProperNounDictionary } from '../../domain/services/transcript-refinement-prompt.service.js';
import { FFmpegClient } from '../../infrastructure/clients/ffmpeg.client.js';
import { GcsClient } from '../../infrastructure/clients/gcs.client.js';
import { GoogleDriveClient } from '../../infrastructure/clients/google-drive.client.js';
import { LocalTempStorageClient } from '../../infrastructure/clients/local-temp-storage.client.js';
import { OpenAIClient } from '../../infrastructure/clients/openai.client.js';
import { SpeechToTextClient } from '../../infrastructure/clients/speech-to-text.client.js';
import { prisma } from '../../infrastructure/database/connection.js';
import { ClipRepository } from '../../infrastructure/repositories/clip.repository.js';
import { ProcessingJobRepository } from '../../infrastructure/repositories/processing-job.repository.js';
import { RefinedTranscriptionRepository } from '../../infrastructure/repositories/refined-transcription.repository.js';
import { TranscriptionRepository } from '../../infrastructure/repositories/transcription.repository.js';
import { VideoRepository } from '../../infrastructure/repositories/video.repository.js';

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

// Initialize use cases
const submitVideoUseCase = new SubmitVideoUseCase({
  videoRepository,
  storageGateway: GoogleDriveClient.fromEnv(),
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
  storageGateway: GoogleDriveClient.fromEnv(),
  tempStorageGateway,
  aiGateway: new OpenAIClient(),
  videoProcessingGateway: new FFmpegClient(),
  generateId: () => uuidv4(),
  outputFolderId: process.env.GOOGLE_DRIVE_OUTPUT_FOLDER_ID,
});

const refineTranscriptUseCase = new RefineTranscriptUseCase({
  transcriptionRepository,
  refinedTranscriptionRepository,
  aiGateway: new OpenAIClient(),
  generateId: () => uuidv4(),
  loadDictionary,
});

const createTranscriptUseCase = new CreateTranscriptUseCase({
  videoRepository,
  transcriptionRepository,
  storageGateway: GoogleDriveClient.fromEnv(),
  tempStorageGateway,
  transcriptionGateway: new SpeechToTextClient(),
  videoProcessingGateway: new FFmpegClient(),
  generateId: () => uuidv4(),
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
      console.error('[CreateTranscriptUseCase] Error:', error);
    });
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

export default router;
