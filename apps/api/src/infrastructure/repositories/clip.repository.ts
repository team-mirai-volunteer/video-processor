import type { Clip as PrismaClip } from '@prisma/client';
import type { Clip, CreateClipParams, UpdateClipParams } from '../../domain/models/clip.js';
import type { ClipRepositoryGateway } from '../../domain/gateways/clip-repository.gateway.js';
import { getPrismaClient } from '../database/connection.js';

/**
 * Convert Prisma Clip to domain Clip
 */
function toDomainClip(prismaClip: PrismaClip): Clip {
  return {
    id: prismaClip.id,
    videoId: prismaClip.videoId,
    googleDriveFileId: prismaClip.googleDriveFileId,
    googleDriveUrl: prismaClip.googleDriveUrl,
    title: prismaClip.title,
    startTimeSeconds: Number(prismaClip.startTimeSeconds),
    endTimeSeconds: Number(prismaClip.endTimeSeconds),
    durationSeconds: Number(prismaClip.durationSeconds),
    transcript: prismaClip.transcript,
    status: prismaClip.status as Clip['status'],
    errorMessage: prismaClip.errorMessage,
    createdAt: prismaClip.createdAt,
    updatedAt: prismaClip.updatedAt,
  };
}

/**
 * Clip repository implementation using Prisma
 */
export class ClipRepository implements ClipRepositoryGateway {
  async findById(id: string): Promise<Clip | null> {
    const prisma = getPrismaClient();
    const clip = await prisma.clip.findUnique({ where: { id } });
    return clip ? toDomainClip(clip) : null;
  }

  async findByVideoId(videoId: string): Promise<Clip[]> {
    const prisma = getPrismaClient();
    const clips = await prisma.clip.findMany({
      where: { videoId },
      orderBy: { startTimeSeconds: 'asc' },
    });
    return clips.map(toDomainClip);
  }

  async create(params: CreateClipParams): Promise<Clip> {
    const prisma = getPrismaClient();
    const clip = await prisma.clip.create({
      data: {
        videoId: params.videoId,
        title: params.title ?? null,
        startTimeSeconds: params.startTimeSeconds,
        endTimeSeconds: params.endTimeSeconds,
        durationSeconds: params.durationSeconds,
        transcript: params.transcript ?? null,
        status: 'pending',
      },
    });
    return toDomainClip(clip);
  }

  async createMany(params: CreateClipParams[]): Promise<Clip[]> {
    const prisma = getPrismaClient();

    // Prisma createMany doesn't return the created records,
    // so we need to use a transaction with individual creates
    const clips = await prisma.$transaction(
      params.map((p) =>
        prisma.clip.create({
          data: {
            videoId: p.videoId,
            title: p.title ?? null,
            startTimeSeconds: p.startTimeSeconds,
            endTimeSeconds: p.endTimeSeconds,
            durationSeconds: p.durationSeconds,
            transcript: p.transcript ?? null,
            status: 'pending',
          },
        })
      )
    );

    return clips.map(toDomainClip);
  }

  async update(id: string, params: UpdateClipParams): Promise<Clip> {
    const prisma = getPrismaClient();
    const clip = await prisma.clip.update({
      where: { id },
      data: {
        ...(params.googleDriveFileId !== undefined && { googleDriveFileId: params.googleDriveFileId }),
        ...(params.googleDriveUrl !== undefined && { googleDriveUrl: params.googleDriveUrl }),
        ...(params.title !== undefined && { title: params.title }),
        ...(params.transcript !== undefined && { transcript: params.transcript }),
        ...(params.status !== undefined && { status: params.status }),
        ...(params.errorMessage !== undefined && { errorMessage: params.errorMessage }),
      },
    });
    return toDomainClip(clip);
  }

  async delete(id: string): Promise<void> {
    const prisma = getPrismaClient();
    await prisma.clip.delete({ where: { id } });
  }

  async deleteByVideoId(videoId: string): Promise<void> {
    const prisma = getPrismaClient();
    await prisma.clip.deleteMany({ where: { videoId } });
  }
}
