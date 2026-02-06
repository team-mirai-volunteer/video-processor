import type {
  ClipRepositoryGateway,
  FindAllPaginatedOptions,
  FindAllPaginatedResult,
} from '@clip-video/domain/gateways/clip-repository.gateway.js';
import { Clip, type ClipProps } from '@clip-video/domain/models/clip.js';
import type { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import type { ClipStatus, ComposeProgressPhase, ComposeStatus } from '@video-processor/shared';

export class ClipRepository implements ClipRepositoryGateway {
  constructor(private readonly prisma: PrismaClient) {}

  async save(clip: Clip): Promise<void> {
    const props = clip.toProps();
    await this.prisma.clip.upsert({
      where: { id: props.id },
      create: {
        id: props.id,
        videoId: props.videoId,
        googleDriveFileId: props.googleDriveFileId,
        googleDriveUrl: props.googleDriveUrl,
        title: props.title,
        startTimeSeconds: new Decimal(props.startTimeSeconds),
        endTimeSeconds: new Decimal(props.endTimeSeconds),
        durationSeconds: new Decimal(props.durationSeconds),
        transcript: props.transcript,
        status: props.status,
        errorMessage: props.errorMessage,
        createdAt: props.createdAt,
        updatedAt: props.updatedAt,
        subtitledVideoGcsUri: props.subtitledVideoGcsUri,
        subtitledVideoUrl: props.subtitledVideoUrl,
        subtitledVideoDriveId: props.subtitledVideoDriveId,
        subtitledVideoDriveUrl: props.subtitledVideoDriveUrl,
        clipVideoGcsUri: props.clipVideoGcsUri,
        clipVideoGcsExpiresAt: props.clipVideoGcsExpiresAt,
        composeStatus: props.composeStatus,
        composeProgressPhase: props.composeProgressPhase,
        composeProgressPercent: props.composeProgressPercent,
        composeErrorMessage: props.composeErrorMessage,
      },
      update: {
        googleDriveFileId: props.googleDriveFileId,
        googleDriveUrl: props.googleDriveUrl,
        title: props.title,
        startTimeSeconds: new Decimal(props.startTimeSeconds),
        endTimeSeconds: new Decimal(props.endTimeSeconds),
        durationSeconds: new Decimal(props.durationSeconds),
        transcript: props.transcript,
        status: props.status,
        errorMessage: props.errorMessage,
        updatedAt: props.updatedAt,
        subtitledVideoGcsUri: props.subtitledVideoGcsUri,
        subtitledVideoUrl: props.subtitledVideoUrl,
        subtitledVideoDriveId: props.subtitledVideoDriveId,
        subtitledVideoDriveUrl: props.subtitledVideoDriveUrl,
        clipVideoGcsUri: props.clipVideoGcsUri,
        clipVideoGcsExpiresAt: props.clipVideoGcsExpiresAt,
        composeStatus: props.composeStatus,
        composeProgressPhase: props.composeProgressPhase,
        composeProgressPercent: props.composeProgressPercent,
        composeErrorMessage: props.composeErrorMessage,
      },
    });
  }

  async saveMany(clips: Clip[]): Promise<void> {
    if (clips.length === 0) {
      return;
    }

    await this.prisma.$transaction(
      clips.map((clip) => {
        const props = clip.toProps();
        return this.prisma.clip.upsert({
          where: { id: props.id },
          create: {
            id: props.id,
            videoId: props.videoId,
            googleDriveFileId: props.googleDriveFileId,
            googleDriveUrl: props.googleDriveUrl,
            title: props.title,
            startTimeSeconds: new Decimal(props.startTimeSeconds),
            endTimeSeconds: new Decimal(props.endTimeSeconds),
            durationSeconds: new Decimal(props.durationSeconds),
            transcript: props.transcript,
            status: props.status,
            errorMessage: props.errorMessage,
            createdAt: props.createdAt,
            updatedAt: props.updatedAt,
            subtitledVideoGcsUri: props.subtitledVideoGcsUri,
            subtitledVideoUrl: props.subtitledVideoUrl,
            subtitledVideoDriveId: props.subtitledVideoDriveId,
            subtitledVideoDriveUrl: props.subtitledVideoDriveUrl,
            clipVideoGcsUri: props.clipVideoGcsUri,
            clipVideoGcsExpiresAt: props.clipVideoGcsExpiresAt,
            composeStatus: props.composeStatus,
            composeProgressPhase: props.composeProgressPhase,
            composeProgressPercent: props.composeProgressPercent,
            composeErrorMessage: props.composeErrorMessage,
          },
          update: {
            googleDriveFileId: props.googleDriveFileId,
            googleDriveUrl: props.googleDriveUrl,
            title: props.title,
            startTimeSeconds: new Decimal(props.startTimeSeconds),
            endTimeSeconds: new Decimal(props.endTimeSeconds),
            durationSeconds: new Decimal(props.durationSeconds),
            transcript: props.transcript,
            status: props.status,
            errorMessage: props.errorMessage,
            updatedAt: props.updatedAt,
            subtitledVideoGcsUri: props.subtitledVideoGcsUri,
            subtitledVideoUrl: props.subtitledVideoUrl,
            subtitledVideoDriveId: props.subtitledVideoDriveId,
            subtitledVideoDriveUrl: props.subtitledVideoDriveUrl,
            clipVideoGcsUri: props.clipVideoGcsUri,
            clipVideoGcsExpiresAt: props.clipVideoGcsExpiresAt,
            composeStatus: props.composeStatus,
            composeProgressPhase: props.composeProgressPhase,
            composeProgressPercent: props.composeProgressPercent,
            composeErrorMessage: props.composeErrorMessage,
          },
        });
      })
    );
  }

  async findById(id: string): Promise<Clip | null> {
    const record = await this.prisma.clip.findUnique({
      where: { id },
    });

    if (!record) {
      return null;
    }

    return this.toDomain(record);
  }

  async findByVideoId(videoId: string): Promise<Clip[]> {
    const records = await this.prisma.clip.findMany({
      where: { videoId },
      orderBy: { startTimeSeconds: 'asc' },
    });

    return records.map((record) => this.toDomain(record));
  }

  async findAllPaginated(options: FindAllPaginatedOptions): Promise<FindAllPaginatedResult> {
    const { page, limit } = options;
    const skip = (page - 1) * limit;

    const [records, total] = await Promise.all([
      this.prisma.clip.findMany({
        include: {
          video: {
            select: { title: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.clip.count(),
    ]);

    const clips = records.map((record) => ({
      clip: this.toDomain(record),
      videoTitle: record.video.title,
    }));

    return { clips, total };
  }

  async delete(id: string): Promise<void> {
    await this.prisma.clip.delete({
      where: { id },
    });
  }

  async updateComposeStatus(
    clipId: string,
    status: ComposeStatus,
    errorMessage?: string
  ): Promise<void> {
    await this.prisma.clip.update({
      where: { id: clipId },
      data: {
        composeStatus: status,
        composeErrorMessage: errorMessage ?? null,
        composeProgressPhase: status === 'processing' ? null : undefined,
        composeProgressPercent: status === 'processing' ? null : undefined,
        updatedAt: new Date(),
      },
    });
  }

  async updateComposeProgress(
    clipId: string,
    phase: ComposeProgressPhase,
    percent: number
  ): Promise<void> {
    await this.prisma.clip.update({
      where: { id: clipId },
      data: {
        composeProgressPhase: phase,
        composeProgressPercent: Math.round(percent),
        updatedAt: new Date(),
      },
    });
  }

  private toDomain(record: {
    id: string;
    videoId: string;
    googleDriveFileId: string | null;
    googleDriveUrl: string | null;
    title: string | null;
    startTimeSeconds: Decimal;
    endTimeSeconds: Decimal;
    durationSeconds: Decimal;
    transcript: string | null;
    status: string;
    errorMessage: string | null;
    createdAt: Date;
    updatedAt: Date;
    subtitledVideoGcsUri: string | null;
    subtitledVideoUrl: string | null;
    subtitledVideoDriveId: string | null;
    subtitledVideoDriveUrl: string | null;
    clipVideoGcsUri: string | null;
    clipVideoGcsExpiresAt: Date | null;
    composeStatus: string | null;
    composeProgressPhase: string | null;
    composeProgressPercent: number | null;
    composeErrorMessage: string | null;
  }): Clip {
    const props: ClipProps = {
      id: record.id,
      videoId: record.videoId,
      googleDriveFileId: record.googleDriveFileId,
      googleDriveUrl: record.googleDriveUrl,
      title: record.title,
      startTimeSeconds: record.startTimeSeconds.toNumber(),
      endTimeSeconds: record.endTimeSeconds.toNumber(),
      durationSeconds: record.durationSeconds.toNumber(),
      transcript: record.transcript,
      status: record.status as ClipStatus,
      errorMessage: record.errorMessage,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      subtitledVideoGcsUri: record.subtitledVideoGcsUri,
      subtitledVideoUrl: record.subtitledVideoUrl,
      subtitledVideoDriveId: record.subtitledVideoDriveId,
      subtitledVideoDriveUrl: record.subtitledVideoDriveUrl,
      clipVideoGcsUri: record.clipVideoGcsUri,
      clipVideoGcsExpiresAt: record.clipVideoGcsExpiresAt,
      composeStatus: record.composeStatus as ComposeStatus | null,
      composeProgressPhase: record.composeProgressPhase as ComposeProgressPhase | null,
      composeProgressPercent: record.composeProgressPercent,
      composeErrorMessage: record.composeErrorMessage,
    };
    return Clip.fromProps(props);
  }
}
