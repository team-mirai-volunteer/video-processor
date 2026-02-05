import { ComposeSubtitledClipUseCase } from '@clip-video/application/usecases/compose-subtitled-clip.usecase.js';
import { ConfirmClipSubtitlesUseCase } from '@clip-video/application/usecases/confirm-clip-subtitles.usecase.js';
import { GenerateClipSubtitlesUseCase } from '@clip-video/application/usecases/generate-clip-subtitles.usecase.js';
import { GetClipSubtitlesUseCase } from '@clip-video/application/usecases/get-clip-subtitles.usecase.js';
import { GetClipVideoUrlUseCase } from '@clip-video/application/usecases/get-clip-video-url.usecase.js';
import { UpdateClipSubtitlesUseCase } from '@clip-video/application/usecases/update-clip-subtitles.usecase.js';
import { UploadSubtitledClipToDriveUseCase } from '@clip-video/application/usecases/upload-subtitled-clip-to-drive.usecase.js';
import type { TempStorageGateway } from '@clip-video/domain/gateways/temp-storage.gateway.js';
import { ClipSubtitleComposeClient } from '@clip-video/infrastructure/clients/clip-subtitle-compose.client.js';
import { ClipSubtitleRepository } from '@clip-video/infrastructure/repositories/clip-subtitle.repository.js';
import { ClipRepository } from '@clip-video/infrastructure/repositories/clip.repository.js';
import { RefinedTranscriptionRepository } from '@clip-video/infrastructure/repositories/refined-transcription.repository.js';
import { TranscriptionRepository } from '@clip-video/infrastructure/repositories/transcription.repository.js';
import { GcsClient } from '@shared/infrastructure/clients/gcs.client.js';
import { GoogleDriveClient } from '@shared/infrastructure/clients/google-drive.client.js';
import { LocalTempStorageClient } from '@shared/infrastructure/clients/local-temp-storage.client.js';
import { OpenAIClient } from '@shared/infrastructure/clients/openai.client.js';
import { prisma } from '@shared/infrastructure/database/connection.js';
import type { UpdateClipSubtitleRequest } from '@video-processor/shared';
import { type Router as ExpressRouter, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

const router: ExpressRouter = Router();

// Initialize repositories
const clipRepository = new ClipRepository(prisma);
const clipSubtitleRepository = new ClipSubtitleRepository(prisma);
const transcriptionRepository = new TranscriptionRepository(prisma);
const refinedTranscriptionRepository = new RefinedTranscriptionRepository(prisma);

// Initialize clients
const gcsClient = new GcsClient();
const googleDriveClient = GoogleDriveClient.fromEnv();
const clipSubtitleComposer = new ClipSubtitleComposeClient();

// Initialize gateways based on environment
function createTempStorageGateway(): TempStorageGateway {
  if (process.env.TEMP_STORAGE_TYPE === 'local') {
    return new LocalTempStorageClient();
  }
  return new GcsClient();
}

const tempStorageGateway = createTempStorageGateway();
const storageGateway = GoogleDriveClient.fromEnv();

// Initialize use cases
const generateClipSubtitlesUseCase = new GenerateClipSubtitlesUseCase({
  clipRepository,
  clipSubtitleRepository,
  transcriptionRepository,
  refinedTranscriptionRepository,
  aiGateway: new OpenAIClient(),
  generateId: () => uuidv4(),
});

const getClipSubtitlesUseCase = new GetClipSubtitlesUseCase({
  clipSubtitleRepository,
});

const updateClipSubtitlesUseCase = new UpdateClipSubtitlesUseCase({
  clipSubtitleRepository,
});

const confirmClipSubtitlesUseCase = new ConfirmClipSubtitlesUseCase({
  clipSubtitleRepository,
});

const getClipVideoUrlUseCase = new GetClipVideoUrlUseCase({
  clipRepository,
  storageGateway,
  tempStorageGateway,
});

const composeSubtitledClipUseCase = new ComposeSubtitledClipUseCase({
  clipRepository,
  clipSubtitleRepository,
  clipSubtitleComposer,
  tempStorage: gcsClient,
});

const uploadSubtitledClipToDriveUseCase = new UploadSubtitledClipToDriveUseCase({
  clipRepository,
  storage: googleDriveClient,
  tempStorage: gcsClient,
  outputFolderId: process.env.GOOGLE_DRIVE_OUTPUT_FOLDER_ID,
});

/**
 * POST /api/clips/:clipId/subtitles/generate
 * Generate subtitle segments for a clip using LLM
 */
router.post('/clips/:clipId/subtitles/generate', async (req, res, next) => {
  try {
    const { clipId } = req.params;
    const result = await generateClipSubtitlesUseCase.execute(clipId ?? '');
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/clips/:clipId/subtitles
 * Get subtitle segments for a clip
 */
router.get('/clips/:clipId/subtitles', async (req, res, next) => {
  try {
    const { clipId } = req.params;
    const result = await getClipSubtitlesUseCase.execute(clipId ?? '');
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/clips/:clipId/subtitles
 * Update subtitle segments for a clip
 */
router.put('/clips/:clipId/subtitles', async (req, res, next) => {
  try {
    const { clipId } = req.params;
    const body = req.body as UpdateClipSubtitleRequest;
    const result = await updateClipSubtitlesUseCase.execute({
      clipId: clipId ?? '',
      segments: body.segments,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/clips/:clipId/subtitles/confirm
 * Confirm subtitle segments (change status from draft to confirmed)
 */
router.post('/clips/:clipId/subtitles/confirm', async (req, res, next) => {
  try {
    const { clipId } = req.params;
    const result = await confirmClipSubtitlesUseCase.execute(clipId ?? '');
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/clips/:clipId/video-url
 * Get signed URL for clip video playback
 */
router.get('/clips/:clipId/video-url', async (req, res, next) => {
  try {
    const { clipId } = req.params;
    const result = await getClipVideoUrlUseCase.execute(clipId ?? '');
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/clips/:clipId/compose
 * Compose subtitles onto a clip video
 */
router.post('/clips/:clipId/compose', async (req, res, next) => {
  try {
    const { clipId } = req.params;
    const body = req.body as {
      outputFormat?: string;
      paddingColor?: string;
      outlineColor?: string;
    };
    const outputFormat =
      body.outputFormat === 'vertical' ||
      body.outputFormat === 'horizontal' ||
      body.outputFormat === 'original'
        ? body.outputFormat
        : 'original';
    // 余白カラーの検証（白を含む）
    const validPaddingColors = ['#000000', '#30bca7', '#56d6ea', '#ff7aa2', '#ffffff'] as const;
    const paddingColor = validPaddingColors.includes(
      body.paddingColor as (typeof validPaddingColors)[number]
    )
      ? (body.paddingColor as (typeof validPaddingColors)[number])
      : '#000000';
    // テキスト枠カラーの検証（白を除く）
    const validOutlineColors = ['#000000', '#30bca7', '#56d6ea', '#ff7aa2'] as const;
    const outlineColor = validOutlineColors.includes(
      body.outlineColor as (typeof validOutlineColors)[number]
    )
      ? (body.outlineColor as (typeof validOutlineColors)[number])
      : '#30bca7';
    const result = await composeSubtitledClipUseCase.execute({
      clipId: clipId ?? '',
      outputFormat,
      paddingColor,
      outlineColor,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/clips/:clipId/upload-to-drive
 * Upload subtitled clip video to Google Drive
 */
router.post('/clips/:clipId/upload-to-drive', async (req, res, next) => {
  try {
    const { clipId } = req.params;
    const { folderId } = req.body as { folderId?: string };
    const result = await uploadSubtitledClipToDriveUseCase.execute({
      clipId: clipId ?? '',
      folderId,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
