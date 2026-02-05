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
  /** Default output folder ID (from env GOOGLE_DRIVE_OUTPUT_FOLDER_ID) */
  outputFolderId?: string;
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

    // 5. Determine target folder
    // Priority: provided folderId > parent folder of clip > default outputFolderId
    let targetFolderId = folderId;
    if (!targetFolderId && clip.googleDriveFileId) {
      const clipMetadata = await this.deps.storage.getFileMetadata(clip.googleDriveFileId);
      targetFolderId = clipMetadata.parents?.[0];
    }
    if (!targetFolderId) {
      targetFolderId = this.deps.outputFolderId;
    }

    // 6. Upload to Google Drive (must be shared drive for service account)
    const driveResult = await this.deps.storage.uploadFile({
      name: fileName,
      mimeType: 'video/mp4',
      content: videoBuffer,
      parentFolderId: targetFolderId,
    });

    // 7. Update clip with Drive info
    const updatedClip = clip.withSubtitledVideoDriveInfo(driveResult.id, driveResult.webViewLink);
    await this.deps.clipRepository.save(updatedClip);

    return {
      clipId,
      driveFileId: driveResult.id,
      driveUrl: driveResult.webViewLink,
    };
  }
}
