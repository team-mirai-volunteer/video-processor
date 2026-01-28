import type {
  FindVideosOptions,
  FindVideosResult,
  VideoRepositoryGateway,
  VideoWithClipCount,
} from '@clip-video/domain/gateways/video-repository.gateway.js';
import { Video, type VideoProps } from '@clip-video/domain/models/video.js';
import type { PrismaClient } from '@prisma/client';
import type { TranscriptionPhase, VideoStatus } from '@video-processor/shared';

export class VideoRepository implements VideoRepositoryGateway {
  constructor(private readonly prisma: PrismaClient) {}

  async save(video: Video): Promise<void> {
    const props = video.toProps();
    await this.prisma.video.upsert({
      where: { id: props.id },
      create: {
        id: props.id,
        googleDriveFileId: props.googleDriveFileId,
        googleDriveUrl: props.googleDriveUrl,
        title: props.title,
        description: props.description,
        durationSeconds: props.durationSeconds,
        fileSizeBytes: props.fileSizeBytes ? BigInt(props.fileSizeBytes) : null,
        status: props.status,
        transcriptionPhase: props.transcriptionPhase,
        errorMessage: props.errorMessage,
        progressMessage: props.progressMessage,
        gcsUri: props.gcsUri,
        gcsExpiresAt: props.gcsExpiresAt,
        createdAt: props.createdAt,
        updatedAt: props.updatedAt,
      },
      update: {
        googleDriveUrl: props.googleDriveUrl,
        title: props.title,
        description: props.description,
        durationSeconds: props.durationSeconds,
        fileSizeBytes: props.fileSizeBytes ? BigInt(props.fileSizeBytes) : null,
        status: props.status,
        transcriptionPhase: props.transcriptionPhase,
        errorMessage: props.errorMessage,
        progressMessage: props.progressMessage,
        gcsUri: props.gcsUri,
        gcsExpiresAt: props.gcsExpiresAt,
        updatedAt: props.updatedAt,
      },
    });
  }

  async findById(id: string): Promise<Video | null> {
    const record = await this.prisma.video.findUnique({
      where: { id },
    });

    if (!record) {
      return null;
    }

    return this.toDomain(record);
  }

  async findByGoogleDriveFileId(fileId: string): Promise<Video | null> {
    const record = await this.prisma.video.findUnique({
      where: { googleDriveFileId: fileId },
    });

    if (!record) {
      return null;
    }

    return this.toDomain(record);
  }

  async findMany(options: FindVideosOptions): Promise<FindVideosResult> {
    const skip = (options.page - 1) * options.limit;

    const where = options.status ? { status: options.status } : {};

    const [records, total] = await Promise.all([
      this.prisma.video.findMany({
        where,
        skip,
        take: options.limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { clips: true },
          },
        },
      }),
      this.prisma.video.count({ where }),
    ]);

    const videos: VideoWithClipCount[] = records.map((record) => ({
      video: this.toDomain(record),
      clipCount: record._count.clips,
    }));

    return { videos, total };
  }

  async delete(id: string): Promise<void> {
    await this.prisma.video.delete({
      where: { id },
    });
  }

  private toDomain(record: {
    id: string;
    googleDriveFileId: string;
    googleDriveUrl: string;
    title: string | null;
    description: string | null;
    durationSeconds: number | null;
    fileSizeBytes: bigint | null;
    status: string;
    transcriptionPhase: string | null;
    errorMessage: string | null;
    progressMessage: string | null;
    gcsUri: string | null;
    gcsExpiresAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): Video {
    const props: VideoProps = {
      id: record.id,
      googleDriveFileId: record.googleDriveFileId,
      googleDriveUrl: record.googleDriveUrl,
      title: record.title,
      description: record.description,
      durationSeconds: record.durationSeconds,
      fileSizeBytes: record.fileSizeBytes ? Number(record.fileSizeBytes) : null,
      status: record.status as VideoStatus,
      transcriptionPhase: record.transcriptionPhase as TranscriptionPhase | null,
      errorMessage: record.errorMessage,
      progressMessage: record.progressMessage,
      gcsUri: record.gcsUri,
      gcsExpiresAt: record.gcsExpiresAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
    return Video.fromProps(props);
  }
}
