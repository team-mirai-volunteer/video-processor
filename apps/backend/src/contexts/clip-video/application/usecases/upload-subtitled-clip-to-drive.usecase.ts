import { NotFoundError } from '@clip-video/application/errors/errors.js';
import type { ClipRepositoryGateway } from '@clip-video/domain/gateways/clip-repository.gateway.js';
import type { StorageGateway } from '@clip-video/domain/gateways/storage.gateway.js';
import type { TempStorageGateway } from '@shared/domain/gateways/temp-storage.gateway.js';

export interface UploadSubtitledClipToDriveInput {
  clipId: string;
  folderId?: string;
}

export interface UploadSubtitledClipToDriveOutput {
  clipId: string;
  driveFileId: string;
  driveUrl: string;
}

export interface UploadSubtitledClipToDriveUseCaseDeps {
  clipRepository: ClipRepositoryGateway;
  storage: StorageGateway;
  tempStorage: TempStorageGateway;
}

/**
 * UploadSubtitledClipToDriveUseCase
 * Uploads a subtitled clip video from GCS to Google Drive
 */
export class UploadSubtitledClipToDriveUseCase {
  constructor(private readonly deps: UploadSubtitledClipToDriveUseCaseDeps) {}

  async execute(input: UploadSubtitledClipToDriveInput): Promise<UploadSubtitledClipToDriveOutput> {
    const { clipId, folderId } = input;

    // 1. Get clip
    const clip = await this.deps.clipRepository.findById(clipId);
    if (!clip) {
      throw new NotFoundError('Clip', clipId);
    }

    // 2. Check if subtitled video exists in GCS
    const subtitledVideoGcsUri = clip.subtitledVideoGcsUri;
    if (!subtitledVideoGcsUri) {
      throw new NotFoundError('SubtitledVideo', clipId);
    }

    // 3. Download subtitled video from GCS
    const videoBuffer = await this.deps.tempStorage.download(subtitledVideoGcsUri);

    // 4. Generate filename for Drive
    const clipTitle = clip.title || `clip-${clipId}`;
    const fileName = `${clipTitle}-subtitled.mp4`;

    // 5. Upload to Google Drive
    const driveResult = await this.deps.storage.uploadFile({
      name: fileName,
      mimeType: 'video/mp4',
      content: videoBuffer,
      parentFolderId: folderId,
    });

    // 6. Update clip with Drive info
    const updatedClip = clip.withSubtitledVideoDriveInfo(driveResult.id, driveResult.webViewLink);
    await this.deps.clipRepository.save(updatedClip);

    return {
      clipId,
      driveFileId: driveResult.id,
      driveUrl: driveResult.webViewLink,
    };
  }
}
