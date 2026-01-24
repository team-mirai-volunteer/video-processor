import { type Router as ExpressRouter, Router } from 'express';
import { GetClipsUseCase } from '../../application/usecases/get-clips.usecase.js';
import { prisma } from '../../infrastructure/database/connection.js';
import { ClipRepository } from '../../infrastructure/repositories/clip.repository.js';
import { VideoRepository } from '../../infrastructure/repositories/video.repository.js';

const router: ExpressRouter = Router();

// Initialize repositories
const videoRepository = new VideoRepository(prisma);
const clipRepository = new ClipRepository(prisma);

// Initialize use case
const getClipsUseCase = new GetClipsUseCase({
  videoRepository,
  clipRepository,
});

/**
 * GET /api/videos/:videoId/clips
 * Get all clips for a video
 */
router.get('/videos/:videoId/clips', async (req, res, next) => {
  try {
    const { videoId } = req.params;
    const result = await getClipsUseCase.executeForVideo(videoId ?? '');
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/clips/:id
 * Get clip details
 */
router.get('/clips/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await getClipsUseCase.executeForClip(id ?? '');
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
