import type { Prisma, PrismaClient } from '@prisma/client';
import type { TranscriptionRepositoryGateway } from '../../domain/gateways/transcription-repository.gateway.js';
import {
  Transcription,
  type TranscriptionProps,
  type TranscriptionSegment,
} from '../../domain/models/transcription.js';

export class TranscriptionRepository implements TranscriptionRepositoryGateway {
  constructor(private readonly prisma: PrismaClient) {}

  async save(transcription: Transcription): Promise<void> {
    const props = transcription.toProps();
    await this.prisma.transcription.upsert({
      where: { videoId: props.videoId },
      create: {
        id: props.id,
        videoId: props.videoId,
        fullText: props.fullText,
        segments: props.segments as unknown as Prisma.InputJsonValue,
        languageCode: props.languageCode,
        durationSeconds: props.durationSeconds,
        createdAt: props.createdAt,
      },
      update: {
        fullText: props.fullText,
        segments: props.segments as unknown as Prisma.InputJsonValue,
        languageCode: props.languageCode,
        durationSeconds: props.durationSeconds,
      },
    });
  }

  async findById(id: string): Promise<Transcription | null> {
    const record = await this.prisma.transcription.findUnique({
      where: { id },
    });

    if (!record) {
      return null;
    }

    return this.toDomain(record);
  }

  async findByVideoId(videoId: string): Promise<Transcription | null> {
    const record = await this.prisma.transcription.findUnique({
      where: { videoId },
    });

    if (!record) {
      return null;
    }

    return this.toDomain(record);
  }

  async deleteByVideoId(videoId: string): Promise<void> {
    await this.prisma.transcription.deleteMany({
      where: { videoId },
    });
  }

  private toDomain(record: {
    id: string;
    videoId: string;
    fullText: string;
    segments: unknown;
    languageCode: string;
    durationSeconds: { toNumber(): number };
    createdAt: Date;
  }): Transcription {
    const props: TranscriptionProps = {
      id: record.id,
      videoId: record.videoId,
      fullText: record.fullText,
      segments: record.segments as TranscriptionSegment[],
      languageCode: record.languageCode,
      durationSeconds: record.durationSeconds.toNumber(),
      createdAt: record.createdAt,
    };
    return Transcription.fromProps(props);
  }
}
