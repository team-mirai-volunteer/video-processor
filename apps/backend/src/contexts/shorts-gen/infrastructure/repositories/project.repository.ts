import type { PrismaClient } from '@prisma/client';
import type {
  FindProjectsOptions,
  FindProjectsResult,
  ShortsProjectRepositoryGateway,
} from '@shorts-gen/domain/gateways/project-repository.gateway.js';
import { ShortsProject, type ShortsProjectProps } from '@shorts-gen/domain/models/project.js';

export class ShortsProjectRepository implements ShortsProjectRepositoryGateway {
  constructor(private readonly prisma: PrismaClient) {}

  async save(project: ShortsProject): Promise<void> {
    const props = project.toProps();
    await this.prisma.shortsProject.upsert({
      where: { id: props.id },
      create: {
        id: props.id,
        title: props.title,
        aspectRatio: props.aspectRatio,
        resolutionWidth: props.resolutionWidth,
        resolutionHeight: props.resolutionHeight,
        createdAt: props.createdAt,
        updatedAt: props.updatedAt,
      },
      update: {
        title: props.title,
        aspectRatio: props.aspectRatio,
        resolutionWidth: props.resolutionWidth,
        resolutionHeight: props.resolutionHeight,
        updatedAt: props.updatedAt,
      },
    });
  }

  async findById(id: string): Promise<ShortsProject | null> {
    const record = await this.prisma.shortsProject.findUnique({
      where: { id },
    });

    if (!record) {
      return null;
    }

    return this.toDomain(record);
  }

  async findMany(options: FindProjectsOptions): Promise<FindProjectsResult> {
    const skip = (options.page - 1) * options.limit;

    const where = options.titleFilter ? { title: { contains: options.titleFilter } } : {};

    const [records, total] = await Promise.all([
      this.prisma.shortsProject.findMany({
        where,
        skip,
        take: options.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.shortsProject.count({ where }),
    ]);

    const projects = records.map((record) => this.toDomain(record));

    return { projects, total };
  }

  async delete(id: string): Promise<void> {
    await this.prisma.shortsProject.delete({
      where: { id },
    });
  }

  async exists(id: string): Promise<boolean> {
    const count = await this.prisma.shortsProject.count({
      where: { id },
    });
    return count > 0;
  }

  private toDomain(record: {
    id: string;
    title: string;
    aspectRatio: string;
    resolutionWidth: number;
    resolutionHeight: number;
    createdAt: Date;
    updatedAt: Date;
  }): ShortsProject {
    const props: ShortsProjectProps = {
      id: record.id,
      title: record.title,
      aspectRatio: record.aspectRatio,
      resolutionWidth: record.resolutionWidth,
      resolutionHeight: record.resolutionHeight,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
    return ShortsProject.fromProps(props);
  }
}
