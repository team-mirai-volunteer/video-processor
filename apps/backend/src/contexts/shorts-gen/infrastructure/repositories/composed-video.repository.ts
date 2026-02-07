import type { PrismaClient } from '@prisma/client';
import type { Decimal } from '@prisma/client/runtime/library';
import type { ShortsComposedVideoRepositoryGateway } from '@shorts-gen/domain/gateways/composed-video-repository.gateway.js';
import {
  type ComposedVideoProgressPhase,
  type ComposedVideoStatus,
  ShortsComposedVideo,
  type ShortsComposedVideoProps,
} from '@shorts-gen/domain/models/composed-video.js';

type ShortsComposedVideoRecord = {
  id: string;
  projectId: string;
  scriptId: string;
  fileUrl: string | null;
  durationSeconds: Decimal | null;
  status: string;
  progressPhase: string | null;
  progressPercent: number | null;
  errorMessage: string | null;
  bgmKey: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export class ShortsComposedVideoRepository implements ShortsComposedVideoRepositoryGateway {
  constructor(private readonly prisma: PrismaClient) {}

  async save(composedVideo: ShortsComposedVideo): Promise<void> {
    const props = composedVideo.toProps();
    await this.prisma.shortsComposedVideo.upsert({
      where: { id: props.id },
      create: {
        id: props.id,
        projectId: props.projectId,
        scriptId: props.scriptId,
        fileUrl: props.fileUrl,
        durationSeconds: props.durationSeconds,
        status: props.status,
        progressPhase: props.progressPhase,
        progressPercent: props.progressPercent,
        errorMessage: props.errorMessage,
        bgmKey: props.bgmKey,
        createdAt: props.createdAt,
        updatedAt: props.updatedAt,
      },
      update: {
        fileUrl: props.fileUrl,
        durationSeconds: props.durationSeconds,
        status: props.status,
        progressPhase: props.progressPhase,
        progressPercent: props.progressPercent,
        errorMessage: props.errorMessage,
        bgmKey: props.bgmKey,
        updatedAt: props.updatedAt,
      },
    });
  }

  async updateProgress(
    id: string,
    phase: ComposedVideoProgressPhase,
    percent: number
  ): Promise<void> {
    await this.prisma.shortsComposedVideo.update({
      where: { id },
      data: {
        progressPhase: phase,
        progressPercent: Math.round(percent),
        updatedAt: new Date(),
      },
    });
  }

  async findById(id: string): Promise<ShortsComposedVideo | null> {
    const record = await this.prisma.shortsComposedVideo.findUnique({
      where: { id },
    });

    if (!record) {
      return null;
    }

    return this.toDomain(record);
  }

  async findByProjectId(projectId: string): Promise<ShortsComposedVideo | null> {
    const record = await this.prisma.shortsComposedVideo.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      return null;
    }

    return this.toDomain(record);
  }

  async findByScriptId(scriptId: string): Promise<ShortsComposedVideo | null> {
    const record = await this.prisma.shortsComposedVideo.findFirst({
      where: { scriptId },
      orderBy: { createdAt: 'desc' },
    });

    if (!record) {
      return null;
    }

    return this.toDomain(record);
  }

  async findByStatus(status: ComposedVideoStatus): Promise<ShortsComposedVideo[]> {
    const records = await this.prisma.shortsComposedVideo.findMany({
      where: { status },
      orderBy: { createdAt: 'desc' },
    });

    return records.map((record) => this.toDomain(record));
  }

  async delete(id: string): Promise<void> {
    await this.prisma.shortsComposedVideo.delete({
      where: { id },
    });
  }

  async deleteByProjectId(projectId: string): Promise<void> {
    await this.prisma.shortsComposedVideo.deleteMany({
      where: { projectId },
    });
  }

  private toDomain(record: ShortsComposedVideoRecord): ShortsComposedVideo {
    const props: ShortsComposedVideoProps = {
      id: record.id,
      projectId: record.projectId,
      scriptId: record.scriptId,
      fileUrl: record.fileUrl,
      durationSeconds: record.durationSeconds ? Number(record.durationSeconds) : null,
      status: record.status as ComposedVideoStatus,
      progressPhase: record.progressPhase as ComposedVideoProgressPhase | null,
      progressPercent: record.progressPercent,
      errorMessage: record.errorMessage,
      bgmKey: record.bgmKey,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
    return ShortsComposedVideo.fromProps(props);
  }
}
