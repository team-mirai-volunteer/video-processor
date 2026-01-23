import { Router, type Router as RouterType } from 'express';
import type { GetClipDetailResponse } from '@video-processor/shared';
import { GetClipDetailUseCase } from '../../application/usecases/get-clips.usecase.js';
import { ApiError } from '../middleware/error-handler.js';

const router: RouterType = Router();

// Use cases
const getClipDetailUseCase = new GetClipDetailUseCase();

/**
 * GET /api/clips/:id
 * Get clip details
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id) {
      throw ApiError.badRequest('Clip ID is required');
    }

    const clip = await getClipDetailUseCase.execute({ id });

    const response: GetClipDetailResponse = clip;
    res.json(response);
  } catch (error) {
    next(error);
  }
});

export default router;
