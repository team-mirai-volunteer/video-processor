import type { TempStorageGateway } from '@shared/domain/gateways/temp-storage.gateway.js';
import { GcsClient } from '@shared/infrastructure/clients/gcs.client.js';
import { LocalTempStorageClient } from '@shared/infrastructure/clients/local-temp-storage.client.js';
import { prisma } from '@shared/infrastructure/database/connection.js';
import { createLogger } from '@shared/infrastructure/logging/logger.js';
import { ShortsReferenceCharacter } from '@shorts-gen/domain/models/reference-character.js';
import { ShortsProjectRepository } from '@shorts-gen/infrastructure/repositories/project.repository.js';
import { ShortsReferenceCharacterRepository } from '@shorts-gen/infrastructure/repositories/reference-character.repository.js';
import { type Router as ExpressRouter, Router } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';

const log = createLogger('ReferenceCharacterRoutes');
const router: ExpressRouter = Router();

// Initialize repositories
const referenceCharacterRepository = new ShortsReferenceCharacterRepository(prisma);
const projectRepository = new ShortsProjectRepository(prisma);

// Multer configuration for memory storage (files stored in memory as Buffer)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (_req, file, cb) => {
    // Accept only PNG and JPEG
    const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PNG and JPEG are allowed.'));
    }
  },
});

// Maximum number of reference characters per project
const MAX_CHARACTERS_PER_PROJECT = 3;

// Initialize gateways based on environment
function createTempStorageGateway(): TempStorageGateway {
  if (process.env.TEMP_STORAGE_TYPE === 'local') {
    return new LocalTempStorageClient();
  }
  return new GcsClient();
}

// Singleton storage gateway
let storageGateway: TempStorageGateway | null = null;

function getStorageGateway(): TempStorageGateway {
  if (!storageGateway) {
    storageGateway = createTempStorageGateway();
  }
  return storageGateway;
}

/**
 * Convert GCS URI to signed URL for browser access
 */
async function toSignedUrl(gcsUri: string | null | undefined): Promise<string | null> {
  if (!gcsUri) return null;
  // Only convert gs:// or local:// URIs
  if (!gcsUri.startsWith('gs://') && !gcsUri.startsWith('local://')) {
    return gcsUri;
  }
  return getStorageGateway().getSignedUrl(gcsUri);
}

/**
 * POST /api/shorts-gen/projects/:projectId/reference-characters
 * Register a reference character with image and description
 */
router.post('/:projectId/reference-characters', upload.single('image'), async (req, res, next) => {
  try {
    const projectId = req.params.projectId as string;
    const { description } = req.body as { description?: string };
    const file = req.file;

    log.info('Creating reference character', { projectId, hasFile: !!file });

    // Validate projectId exists
    const project = await projectRepository.findById(projectId);
    if (!project) {
      res.status(404).json({
        error: 'PROJECT_NOT_FOUND',
        message: `Project not found: ${projectId}`,
      });
      return;
    }

    // Validate file
    if (!file) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Image file is required',
      });
      return;
    }

    // Validate description
    if (!description || description.trim().length === 0) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Description is required',
      });
      return;
    }

    // Check max characters limit
    const currentCount = await referenceCharacterRepository.countByProjectId(projectId);
    if (currentCount >= MAX_CHARACTERS_PER_PROJECT) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: `Maximum ${MAX_CHARACTERS_PER_PROJECT} reference characters allowed per project`,
      });
      return;
    }

    // Upload image to storage
    const storage = getStorageGateway();
    const fileExtension = file.mimetype === 'image/png' ? 'png' : 'jpg';
    const storagePath = `shorts-gen/${projectId}/reference-characters/${uuidv4()}.${fileExtension}`;

    const uploadResult = await storage.upload({
      videoId: storagePath,
      content: file.buffer,
    });

    log.info('Image uploaded to storage', { storagePath, gcsUri: uploadResult.gcsUri });

    // Create domain model
    const characterResult = ShortsReferenceCharacter.create(
      {
        projectId,
        description: description.trim(),
        imageUrl: uploadResult.gcsUri,
        order: currentCount, // Next order number
      },
      () => uuidv4()
    );

    if (!characterResult.success) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: characterResult.error.message,
      });
      return;
    }

    // Save to repository
    await referenceCharacterRepository.save(characterResult.value);

    // Convert GCS URI to signed URL for response
    const signedUrl = await toSignedUrl(characterResult.value.imageUrl);

    log.info('Reference character created', {
      id: characterResult.value.id,
      projectId,
      order: characterResult.value.order,
    });

    res.status(201).json({
      id: characterResult.value.id,
      projectId: characterResult.value.projectId,
      description: characterResult.value.description,
      imageUrl: signedUrl ?? characterResult.value.imageUrl,
      order: characterResult.value.order,
    });
  } catch (error) {
    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'File size exceeds 5MB limit',
        });
        return;
      }
      res.status(400).json({
        error: 'UPLOAD_ERROR',
        message: error.message,
      });
      return;
    }
    if (error instanceof Error && error.message.includes('Invalid file type')) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: error.message,
      });
      return;
    }
    next(error);
  }
});

/**
 * GET /api/shorts-gen/projects/:projectId/reference-characters
 * Get all reference characters for a project
 */
router.get('/:projectId/reference-characters', async (req, res, next) => {
  try {
    const projectId = req.params.projectId as string;

    log.info('Getting reference characters', { projectId });

    // Validate projectId exists
    const project = await projectRepository.findById(projectId);
    if (!project) {
      res.status(404).json({
        error: 'PROJECT_NOT_FOUND',
        message: `Project not found: ${projectId}`,
      });
      return;
    }

    // Get characters
    const characters = await referenceCharacterRepository.findByProjectId(projectId);

    // Convert GCS URIs to signed URLs
    const charactersWithSignedUrls = await Promise.all(
      characters.map(async (char) => ({
        id: char.id,
        description: char.description,
        imageUrl: (await toSignedUrl(char.imageUrl)) ?? char.imageUrl,
        order: char.order,
      }))
    );

    res.status(200).json({
      projectId,
      characters: charactersWithSignedUrls,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/shorts-gen/projects/:projectId/reference-characters/:id
 * Delete a reference character
 */
router.delete('/:projectId/reference-characters/:id', async (req, res, next) => {
  try {
    const projectId = req.params.projectId as string;
    const id = req.params.id as string;

    log.info('Deleting reference character', { projectId, id });

    // Get the character to verify it exists and belongs to the project
    const character = await referenceCharacterRepository.findById(id);
    if (!character) {
      res.status(404).json({
        error: 'CHARACTER_NOT_FOUND',
        message: `Reference character not found: ${id}`,
      });
      return;
    }

    // Verify the character belongs to the specified project
    if (character.projectId !== projectId) {
      res.status(404).json({
        error: 'CHARACTER_NOT_FOUND',
        message: `Reference character not found in project: ${projectId}`,
      });
      return;
    }

    // Delete the character
    await referenceCharacterRepository.delete(id);

    // Optionally delete the image from storage (not implemented for safety)
    // The GCS bucket lifecycle policy should handle cleanup

    log.info('Reference character deleted', { id, projectId });

    res.status(200).json({
      success: true,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
