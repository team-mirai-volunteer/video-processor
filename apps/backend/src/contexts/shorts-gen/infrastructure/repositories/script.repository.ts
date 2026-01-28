import type { PrismaClient } from '@prisma/client';
import type { ShortsScriptRepositoryGateway } from '@shorts-gen/domain/gateways/script-repository.gateway.js';
import { ShortsScript, type ShortsScriptProps } from '@shorts-gen/domain/models/script.js';

export class ShortsScriptRepository implements ShortsScriptRepositoryGateway {
  constructor(private readonly prisma: PrismaClient) {}

  async save(script: ShortsScript): Promise<void> {
    const props = script.toProps();
    await this.prisma.shortsScript.upsert({
      where: { id: props.id },
      create: {
        id: props.id,
        projectId: props.projectId,
        planningId: props.planningId,
        version: props.version,
        createdAt: props.createdAt,
        updatedAt: props.updatedAt,
      },
      update: {
        version: props.version,
        updatedAt: props.updatedAt,
      },
    });
  }

  async findById(id: string): Promise<ShortsScript | null> {
    const record = await this.prisma.shortsScript.findUnique({
      where: { id },
    });

    if (!record) {
      return null;
    }

    return this.toDomain(record);
  }

  async findByProjectId(projectId: string): Promise<ShortsScript | null> {
    const record = await this.prisma.shortsScript.findFirst({
      where: { projectId },
      orderBy: { version: 'desc' },
    });

    if (!record) {
      return null;
    }

    return this.toDomain(record);
  }

  async findByPlanningId(planningId: string): Promise<ShortsScript[]> {
    const records = await this.prisma.shortsScript.findMany({
      where: { planningId },
      orderBy: { version: 'desc' },
    });

    return records.map((record) => this.toDomain(record));
  }

  async delete(id: string): Promise<void> {
    await this.prisma.shortsScript.delete({
      where: { id },
    });
  }

  async deleteByProjectId(projectId: string): Promise<void> {
    await this.prisma.shortsScript.deleteMany({
      where: { projectId },
    });
  }

  private toDomain(record: {
    id: string;
    projectId: string;
    planningId: string;
    version: number;
    createdAt: Date;
    updatedAt: Date;
  }): ShortsScript {
    const props: ShortsScriptProps = {
      id: record.id,
      projectId: record.projectId,
      planningId: record.planningId,
      version: record.version,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
    return ShortsScript.fromProps(props);
  }
}
