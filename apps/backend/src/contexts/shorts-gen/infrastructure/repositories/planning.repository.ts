import type { PrismaClient } from '@prisma/client';
import type { ShortsPlanningRepositoryGateway } from '@shorts-gen/domain/gateways/planning-repository.gateway.js';
import { ShortsPlanning, type ShortsPlanningProps } from '@shorts-gen/domain/models/planning.js';

export class ShortsPlanningRepository implements ShortsPlanningRepositoryGateway {
  constructor(private readonly prisma: PrismaClient) {}

  async save(planning: ShortsPlanning): Promise<void> {
    const props = planning.toProps();
    await this.prisma.shortsPlanning.upsert({
      where: { id: props.id },
      create: {
        id: props.id,
        projectId: props.projectId,
        content: props.content,
        version: props.version,
        createdAt: props.createdAt,
        updatedAt: props.updatedAt,
      },
      update: {
        content: props.content,
        version: props.version,
        updatedAt: props.updatedAt,
      },
    });
  }

  async findById(id: string): Promise<ShortsPlanning | null> {
    const record = await this.prisma.shortsPlanning.findUnique({
      where: { id },
    });

    if (!record) {
      return null;
    }

    return this.toDomain(record);
  }

  async findByProjectId(projectId: string): Promise<ShortsPlanning | null> {
    const record = await this.prisma.shortsPlanning.findFirst({
      where: { projectId },
      orderBy: { version: 'desc' },
    });

    if (!record) {
      return null;
    }

    return this.toDomain(record);
  }

  async findAllVersionsByProjectId(projectId: string): Promise<ShortsPlanning[]> {
    const records = await this.prisma.shortsPlanning.findMany({
      where: { projectId },
      orderBy: { version: 'desc' },
    });

    return records.map((record) => this.toDomain(record));
  }

  async delete(id: string): Promise<void> {
    await this.prisma.shortsPlanning.delete({
      where: { id },
    });
  }

  async deleteByProjectId(projectId: string): Promise<void> {
    await this.prisma.shortsPlanning.deleteMany({
      where: { projectId },
    });
  }

  private toDomain(record: {
    id: string;
    projectId: string;
    content: string;
    version: number;
    createdAt: Date;
    updatedAt: Date;
  }): ShortsPlanning {
    const props: ShortsPlanningProps = {
      id: record.id,
      projectId: record.projectId,
      content: record.content,
      version: record.version,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
    return ShortsPlanning.fromProps(props);
  }
}
