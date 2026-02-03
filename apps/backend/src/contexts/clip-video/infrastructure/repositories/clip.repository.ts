import type {
  ClipRepositoryGateway,
  FindAllPaginatedOptions,
  FindAllPaginatedResult,
} from '@clip-video/domain/gateways/clip-repository.gateway.js';
import { Clip, type ClipProps } from '@clip-video/domain/models/clip.js';
import type { PrismaClient } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import type { ClipStatus } from '@video-processor/shared';

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
    };
    return Clip.fromProps(props);
  }
}
