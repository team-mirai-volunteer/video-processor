import type { ProcessingJob as PrismaProcessingJob } from '@prisma/client';
import type {
  ProcessingJob,
  CreateProcessingJobParams,
  UpdateProcessingJobParams,
} from '../../domain/models/processing-job.js';
import { getPrismaClient } from '../database/connection.js';

/**
 * Convert Prisma ProcessingJob to domain ProcessingJob
 */
function toDomainProcessingJob(prismaJob: PrismaProcessingJob): ProcessingJob {
  return {
    id: prismaJob.id,
    videoId: prismaJob.videoId,
    clipInstructions: prismaJob.clipInstructions,
    status: prismaJob.status as ProcessingJob['status'],
    aiResponse: prismaJob.aiResponse,
    errorMessage: prismaJob.errorMessage,
    startedAt: prismaJob.startedAt,
    completedAt: prismaJob.completedAt,
    createdAt: prismaJob.createdAt,
    updatedAt: prismaJob.updatedAt,
  };
}

/**
 * Processing job repository implementation using Prisma
 */
export class ProcessingJobRepository {
  async findById(id: string): Promise<ProcessingJob | null> {
    const prisma = getPrismaClient();
    const job = await prisma.processingJob.findUnique({ where: { id } });
    return job ? toDomainProcessingJob(job) : null;
  }

  async findByVideoId(videoId: string): Promise<ProcessingJob[]> {
    const prisma = getPrismaClient();
    const jobs = await prisma.processingJob.findMany({
      where: { videoId },
      orderBy: { createdAt: 'desc' },
    });
    return jobs.map(toDomainProcessingJob);
  }

  async findPending(): Promise<ProcessingJob[]> {
    const prisma = getPrismaClient();
    const jobs = await prisma.processingJob.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'asc' },
    });
    return jobs.map(toDomainProcessingJob);
  }

  async create(params: CreateProcessingJobParams): Promise<ProcessingJob> {
    const prisma = getPrismaClient();
    const job = await prisma.processingJob.create({
      data: {
        videoId: params.videoId,
        clipInstructions: params.clipInstructions,
        status: 'pending',
      },
    });
    return toDomainProcessingJob(job);
  }

  async update(id: string, params: UpdateProcessingJobParams): Promise<ProcessingJob> {
    const prisma = getPrismaClient();
    const job = await prisma.processingJob.update({
      where: { id },
      data: {
        ...(params.status !== undefined && { status: params.status }),
        ...(params.aiResponse !== undefined && { aiResponse: params.aiResponse }),
        ...(params.errorMessage !== undefined && { errorMessage: params.errorMessage }),
        ...(params.startedAt !== undefined && { startedAt: params.startedAt }),
        ...(params.completedAt !== undefined && { completedAt: params.completedAt }),
      },
    });
    return toDomainProcessingJob(job);
  }

  async delete(id: string): Promise<void> {
    const prisma = getPrismaClient();
    await prisma.processingJob.delete({ where: { id } });
  }
}
