import type { PrismaClient } from '@prisma/client';
import type { ShortsPublishTextRepositoryGateway } from '@shorts-gen/domain/gateways/publish-text-repository.gateway.js';
import {
  ShortsPublishText,
  type ShortsPublishTextProps,
} from '@shorts-gen/domain/models/publish-text.js';

export class ShortsPublishTextRepository implements ShortsPublishTextRepositoryGateway {
  constructor(private readonly prisma: PrismaClient) {}

  async save(publishText: ShortsPublishText): Promise<void> {
    const props = publishText.toProps();
    await this.prisma.shortsPublishText.upsert({
      where: { id: props.id },
      create: {
        id: props.id,
        projectId: props.projectId,
        title: props.title,
        description: props.description,
        createdAt: props.createdAt,
        updatedAt: props.updatedAt,
      },
      update: {
        title: props.title,
        description: props.description,
        updatedAt: props.updatedAt,
      },
    });
  }

  async findById(id: string): Promise<ShortsPublishText | null> {
    const record = await this.prisma.shortsPublishText.findUnique({
      where: { id },
    });

    if (!record) {
      return null;
    }

    return this.toDomain(record);
  }

  async findByProjectId(projectId: string): Promise<ShortsPublishText | null> {
    const record = await this.prisma.shortsPublishText.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      return null;
    }

    return this.toDomain(record);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.shortsPublishText.delete({
      where: { id },
    });
  }

  async deleteByProjectId(projectId: string): Promise<void> {
    await this.prisma.shortsPublishText.deleteMany({
      where: { projectId },
    });
  }

  private toDomain(record: {
    id: string;
    projectId: string;
    title: string;
    description: string;
    createdAt: Date;
    updatedAt: Date;
  }): ShortsPublishText {
    const props: ShortsPublishTextProps = {
      id: record.id,
      projectId: record.projectId,
      title: record.title,
      description: record.description,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
    return ShortsPublishText.fromProps(props);
  }
}
