import type { GetVideosQuery, SubmitVideoRequest, VideoStatus } from '@video-processor/shared';
import { type Router as ExpressRouter, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { GetVideoUseCase } from '../../application/usecases/get-video.usecase.js';
import { GetVideosUseCase } from '../../application/usecases/get-videos.usecase.js';
import { ProcessVideoUseCase } from '../../application/usecases/process-video.usecase.js';
import { SubmitVideoUseCase } from '../../application/usecases/submit-video.usecase.js';
import { FFmpegClient } from '../../infrastructure/clients/ffmpeg.client.js';
import { GoogleDriveClient } from '../../infrastructure/clients/google-drive.client.js';
import { OpenAIClient } from '../../infrastructure/clients/openai.client.js';
import { SpeechToTextClient } from '../../infrastructure/clients/speech-to-text.client.js';
import { prisma } from '../../infrastructure/database/connection.js';
import { ClipRepository } from '../../infrastructure/repositories/clip.repository.js';
import { ProcessingJobRepository } from '../../infrastructure/repositories/processing-job.repository.js';
import { VideoRepository } from '../../infrastructure/repositories/video.repository.js';

const router: ExpressRouter = Router();

// Initialize repositories
const videoRepository = new VideoRepository(prisma);
const clipRepository = new ClipRepository(prisma);
const processingJobRepository = new ProcessingJobRepository(prisma);

// Initialize use cases
const submitVideoUseCase = new SubmitVideoUseCase({
  videoRepository,
  processingJobRepository,
  generateId: () => uuidv4(),
});

const getVideosUseCase = new GetVideosUseCase({
  videoRepository,
});

const getVideoUseCase = new GetVideoUseCase({
  videoRepository,
  clipRepository,
  processingJobRepository,
});

const processVideoUseCase = new ProcessVideoUseCase({
  videoRepository,
  clipRepository,
  processingJobRepository,
  storageGateway: GoogleDriveClient.fromEnv(),
  aiGateway: new OpenAIClient(),
  videoProcessingService: new FFmpegClient(),
  transcriptionGateway: new SpeechToTextClient(),
  generateId: () => uuidv4(),
  outputFolderId: process.env.GOOGLE_DRIVE_OUTPUT_FOLDER_ID,
});

/**
 * POST /api/videos
 * Submit a video for processing
 */
router.post('/', async (req, res, next) => {
  try {
    const body = req.body as SubmitVideoRequest;
    const result = await submitVideoUseCase.execute({
      googleDriveUrl: body.googleDriveUrl,
      clipInstructions: body.clipInstructions,
    });
    res.status(202).json(result);

    // Start processing in background (fire and forget)
    processVideoUseCase.execute(result.processingJob.id).catch((error) => {
      console.error('[ProcessVideoUseCase] Error:', error);
    });
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

export default router;
