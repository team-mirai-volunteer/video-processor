import type {
  TranscriptionEntity,
  TranscriptionRepositoryGateway,
} from '../../domain/gateways/transcription-repository.gateway.js';

/**
 * Stub implementation of TranscriptionRepositoryGateway
 * This will be replaced by Prisma implementation from Session A
 */
export class TranscriptionRepositoryStub implements TranscriptionRepositoryGateway {
  // In-memory storage for development/testing
  private transcriptions: Map<string, TranscriptionEntity> = new Map();

  async save(transcription: TranscriptionEntity): Promise<void> {
    this.transcriptions.set(transcription.videoId, transcription);
  }

  async findByVideoId(videoId: string): Promise<TranscriptionEntity | null> {
    return this.transcriptions.get(videoId) ?? null;
  }

  async delete(id: string): Promise<void> {
    // Find and delete by id
    for (const [videoId, transcription] of this.transcriptions.entries()) {
      if (transcription.id === id) {
        this.transcriptions.delete(videoId);
        break;
      }
    }
  }
}
