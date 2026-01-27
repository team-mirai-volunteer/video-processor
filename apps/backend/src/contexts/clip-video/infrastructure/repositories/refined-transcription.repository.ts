import type { RefinedTranscriptionRepositoryGateway } from '@clip-video/domain/gateways/refined-transcription-repository.gateway.js';
import {
  type RefinedSentence,
  RefinedTranscription,
  type RefinedTranscriptionProps,
} from '@clip-video/domain/models/refined-transcription.js';
import type { Prisma, PrismaClient } from '@prisma/client';

export class RefinedTranscriptionRepository implements RefinedTranscriptionRepositoryGateway {
  constructor(private readonly prisma: PrismaClient) {}

  async save(refinedTranscription: RefinedTranscription): Promise<void> {
    const props = refinedTranscription.toProps();
    await this.prisma.refinedTranscription.upsert({
      where: { transcriptionId: props.transcriptionId },
      create: {
        id: props.id,
        transcriptionId: props.transcriptionId,
        fullText: props.fullText,
        sentences: props.sentences as unknown as Prisma.InputJsonValue,
        dictionaryVersion: props.dictionaryVersion,
        createdAt: props.createdAt,
        updatedAt: props.updatedAt,
      },
      update: {
        fullText: props.fullText,
        sentences: props.sentences as unknown as Prisma.InputJsonValue,
        dictionaryVersion: props.dictionaryVersion,
        updatedAt: props.updatedAt,
      },
    });
  }

  async findById(id: string): Promise<RefinedTranscription | null> {
    const record = await this.prisma.refinedTranscription.findUnique({
      where: { id },
    });

    if (!record) {
      return null;
    }

    return this.toDomain(record);
  }

  async findByTranscriptionId(transcriptionId: string): Promise<RefinedTranscription | null> {
    const record = await this.prisma.refinedTranscription.findUnique({
      where: { transcriptionId },
    });

    if (!record) {
      return null;
    }

    return this.toDomain(record);
  }

  async deleteByTranscriptionId(transcriptionId: string): Promise<void> {
    await this.prisma.refinedTranscription.deleteMany({
      where: { transcriptionId },
    });
  }

  private toDomain(record: {
    id: string;
    transcriptionId: string;
    fullText: string;
    sentences: unknown;
    dictionaryVersion: string;
    createdAt: Date;
    updatedAt: Date;
  }): RefinedTranscription {
    const props: RefinedTranscriptionProps = {
      id: record.id,
      transcriptionId: record.transcriptionId,
      fullText: record.fullText,
      sentences: record.sentences as RefinedSentence[],
      dictionaryVersion: record.dictionaryVersion,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
    return RefinedTranscription.fromProps(props);
  }
}
