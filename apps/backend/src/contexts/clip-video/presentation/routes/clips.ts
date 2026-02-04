import { DeleteClipUseCase } from '@clip-video/application/usecases/delete-clip.usecase.js';
import { GetAllClipsUseCase } from '@clip-video/application/usecases/get-all-clips.usecase.js';
import { GetClipsUseCase } from '@clip-video/application/usecases/get-clips.usecase.js';
import { ClipRepository } from '@clip-video/infrastructure/repositories/clip.repository.js';
import { VideoRepository } from '@clip-video/infrastructure/repositories/video.repository.js';
import { prisma } from '@shared/infrastructure/database/connection.js';
import { type Router as ExpressRouter, Router } from 'express';

const router: ExpressRouter = Router();

// Initialize repositories
const videoRepository = new VideoRepository(prisma);
const clipRepository = new ClipRepository(prisma);

// Initialize use cases
const getClipsUseCase = new GetClipsUseCase({
  videoRepository,
  clipRepository,
});

const getAllClipsUseCase = new GetAllClipsUseCase({
  clipRepository,
});

const deleteClipUseCase = new DeleteClipUseCase({
  clipRepository,
});

/**
 * GET /api/clips
 * Get all clips with pagination (cross-video)
 */
router.get('/clips', async (req, res, next) => {
  try {
    const page = req.query.page ? Number(req.query.page) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const result = await getAllClipsUseCase.execute({ page, limit });
    res.json(result);
  } catch (error) {
    next(error);
  }
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

/**
 * DELETE /api/clips/:id
 * Delete a clip
 */
router.delete('/clips/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    await deleteClipUseCase.execute({ clipId: id ?? '' });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
