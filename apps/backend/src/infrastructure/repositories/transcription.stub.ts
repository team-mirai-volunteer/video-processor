import type { TranscriptionRepositoryGateway } from '../../domain/gateways/transcription-repository.gateway.js';
import type { Transcription } from '../../domain/models/transcription.js';

/**
 * Stub implementation of TranscriptionRepositoryGateway
 * This will be replaced by Prisma implementation from Session A
 */
export class TranscriptionRepositoryStub implements TranscriptionRepositoryGateway {
  // In-memory storage for development/testing
  private transcriptions: Map<string, Transcription> = new Map();

  async save(transcription: Transcription): Promise<void> {
    this.transcriptions.set(transcription.videoId, transcription);
  }

  async findById(id: string): Promise<Transcription | null> {
    for (const transcription of this.transcriptions.values()) {
      if (transcription.id === id) {
        return transcription;
      }
    }
    return null;
  }

  async findByVideoId(videoId: string): Promise<Transcription | null> {
    return this.transcriptions.get(videoId) ?? null;
  }

  async deleteByVideoId(videoId: string): Promise<void> {
    this.transcriptions.delete(videoId);
  }
}
