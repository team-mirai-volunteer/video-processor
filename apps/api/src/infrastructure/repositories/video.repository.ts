import type { Video as PrismaVideo } from '@prisma/client';
import type { Video, CreateVideoParams, UpdateVideoParams, VideoFilterOptions } from '../../domain/models/video.js';
import type { Clip } from '../../domain/models/clip.js';
import type { ProcessingJob } from '../../domain/models/processing-job.js';
import type { VideoRepositoryGateway } from '../../domain/gateways/video-repository.gateway.js';
import { getPrismaClient } from '../database/connection.js';

/**
 * Convert Prisma Video to domain Video
 */
function toDomainVideo(prismaVideo: PrismaVideo): Video {
  return {
    id: prismaVideo.id,
    googleDriveFileId: prismaVideo.googleDriveFileId,
    googleDriveUrl: prismaVideo.googleDriveUrl,
    title: prismaVideo.title,
    description: prismaVideo.description,
    durationSeconds: prismaVideo.durationSeconds,
    fileSizeBytes: prismaVideo.fileSizeBytes ? Number(prismaVideo.fileSizeBytes) : null,
    status: prismaVideo.status as Video['status'],
    errorMessage: prismaVideo.errorMessage,
    createdAt: prismaVideo.createdAt,
    updatedAt: prismaVideo.updatedAt,
  };
}

/**
 * Video repository implementation using Prisma
 */
export class VideoRepository implements VideoRepositoryGateway {
  async findById(id: string): Promise<Video | null> {
    const prisma = getPrismaClient();
    const video = await prisma.video.findUnique({ where: { id } });
    return video ? toDomainVideo(video) : null;
  }

  async findByGoogleDriveFileId(fileId: string): Promise<Video | null> {
    const prisma = getPrismaClient();
    const video = await prisma.video.findUnique({
      where: { googleDriveFileId: fileId },
    });
    return video ? toDomainVideo(video) : null;
  }

  async findAll(options?: VideoFilterOptions): Promise<{ videos: Video[]; total: number }> {
    const prisma = getPrismaClient();
    const page = options?.page ?? 1;
    const limit = options?.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = options?.status ? { status: options.status } : {};

    const [videos, total] = await Promise.all([
      prisma.video.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.video.count({ where }),
    ]);

    return {
      videos: videos.map(toDomainVideo),
      total,
    };
  }

  async findByIdWithRelations(id: string): Promise<(Video & {
    clips: Clip[];
    processingJobs: ProcessingJob[];
  }) | null> {
    const prisma = getPrismaClient();
    const video = await prisma.video.findUnique({
      where: { id },
      include: {
        clips: { orderBy: { startTimeSeconds: 'asc' } },
        processingJobs: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!video) return null;

    return {
      ...toDomainVideo(video),
      clips: video.clips.map((clip) => ({
        id: clip.id,
        videoId: clip.videoId,
        googleDriveFileId: clip.googleDriveFileId,
        googleDriveUrl: clip.googleDriveUrl,
        title: clip.title,
        startTimeSeconds: Number(clip.startTimeSeconds),
        endTimeSeconds: Number(clip.endTimeSeconds),
        durationSeconds: Number(clip.durationSeconds),
        transcript: clip.transcript,
        status: clip.status as Clip['status'],
        errorMessage: clip.errorMessage,
        createdAt: clip.createdAt,
        updatedAt: clip.updatedAt,
      })),
      processingJobs: video.processingJobs.map((job) => ({
        id: job.id,
        videoId: job.videoId,
        clipInstructions: job.clipInstructions,
        status: job.status as ProcessingJob['status'],
        aiResponse: job.aiResponse,
        errorMessage: job.errorMessage,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
      })),
    };
  }

  async create(params: CreateVideoParams): Promise<Video> {
    const prisma = getPrismaClient();
    const video = await prisma.video.create({
      data: {
        googleDriveFileId: params.googleDriveFileId,
        googleDriveUrl: params.googleDriveUrl,
        title: params.title ?? null,
        description: params.description ?? null,
        durationSeconds: params.durationSeconds ?? null,
        fileSizeBytes: params.fileSizeBytes ?? null,
        status: 'pending',
      },
    });
    return toDomainVideo(video);
  }

  async update(id: string, params: UpdateVideoParams): Promise<Video> {
    const prisma = getPrismaClient();
    const video = await prisma.video.update({
      where: { id },
      data: {
        ...(params.title !== undefined && { title: params.title }),
        ...(params.description !== undefined && { description: params.description }),
        ...(params.durationSeconds !== undefined && { durationSeconds: params.durationSeconds }),
        ...(params.fileSizeBytes !== undefined && { fileSizeBytes: params.fileSizeBytes }),
        ...(params.status !== undefined && { status: params.status }),
        ...(params.errorMessage !== undefined && { errorMessage: params.errorMessage }),
      },
    });
    return toDomainVideo(video);
  }

  async delete(id: string): Promise<void> {
    const prisma = getPrismaClient();
    await prisma.video.delete({ where: { id } });
  }

  async countByStatus(status: string): Promise<number> {
    const prisma = getPrismaClient();
    return prisma.video.count({ where: { status } });
  }
}
