import { Router, type Router as RouterType } from 'express';
import { z } from 'zod';
import type {
  CreateVideoRequest,
  CreateVideoResponse,
  GetVideosResponse,
  GetVideoDetailResponse,
} from '@video-processor/shared';
import { VideoStatus } from '@video-processor/shared';
import { SubmitVideoUseCase } from '../../application/usecases/submit-video.usecase.js';
import { GetVideosUseCase, GetVideoDetailUseCase } from '../../application/usecases/get-videos.usecase.js';
import { GetClipsByVideoUseCase } from '../../application/usecases/get-clips.usecase.js';
import { ApiError } from '../middleware/error-handler.js';

const router: RouterType = Router();

// Validation schemas
const createVideoSchema = z.object({
  googleDriveUrl: z.string().url().refine(
    (url) => url.includes('drive.google.com') || url.includes('docs.google.com'),
    { message: 'Must be a Google Drive URL' }
  ),
  clipInstructions: z.string().min(1, 'Clip instructions are required'),
});

const getVideosQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  status: z.enum(['pending', 'processing', 'completed', 'failed']).optional(),
});

// Use cases
const submitVideoUseCase = new SubmitVideoUseCase();
const getVideosUseCase = new GetVideosUseCase();
const getVideoDetailUseCase = new GetVideoDetailUseCase();
const getClipsByVideoUseCase = new GetClipsByVideoUseCase();

/**
 * POST /api/videos
 * Create a new video and start processing
 */
router.post('/', async (req, res, next) => {
  try {
    const input = createVideoSchema.parse(req.body) as CreateVideoRequest;

    const { video, processingJob } = await submitVideoUseCase.execute({
      googleDriveUrl: input.googleDriveUrl,
      clipInstructions: input.clipInstructions,
    });

    const response: CreateVideoResponse = {
      id: video.id,
      googleDriveFileId: video.googleDriveFileId,
      googleDriveUrl: video.googleDriveUrl,
      status: video.status,
      processingJob: {
        id: processingJob.id,
        status: processingJob.status,
        clipInstructions: processingJob.clipInstructions,
      },
      createdAt: video.createdAt,
    };

    res.status(202).json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/videos
 * Get list of videos with pagination
 */
router.get('/', async (req, res, next) => {
  try {
    const query = getVideosQuerySchema.parse(req.query);

    const result = await getVideosUseCase.execute({
      page: query.page,
      limit: query.limit,
      status: query.status as typeof VideoStatus[keyof typeof VideoStatus] | undefined,
    });

    const response: GetVideosResponse = result;
    res.json(response);
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

    if (!id) {
      throw ApiError.badRequest('Video ID is required');
    }

    const video = await getVideoDetailUseCase.execute({ id });

    const response: GetVideoDetailResponse = video;
    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/videos/:id/clips
 * Get all clips for a video
 */
router.get('/:id/clips', async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id) {
      throw ApiError.badRequest('Video ID is required');
    }

    const result = await getClipsByVideoUseCase.execute({ videoId: id });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
