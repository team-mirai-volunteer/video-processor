import type { PrismaClient } from '@prisma/client';
import type { ProcessingJobStatus } from '@video-processor/shared';
import type { ProcessingJobRepositoryGateway } from '../../domain/gateways/processing-job-repository.gateway.js';
import { ProcessingJob, type ProcessingJobProps } from '../../domain/models/processing-job.js';

export class ProcessingJobRepository implements ProcessingJobRepositoryGateway {
  constructor(private readonly prisma: PrismaClient) {}

  async save(job: ProcessingJob): Promise<void> {
    const props = job.toProps();
    await this.prisma.processingJob.upsert({
      where: { id: props.id },
      create: {
        id: props.id,
        videoId: props.videoId,
        clipInstructions: props.clipInstructions,
        status: props.status,
        aiResponse: props.aiResponse,
        errorMessage: props.errorMessage,
        startedAt: props.startedAt,
        completedAt: props.completedAt,
        createdAt: props.createdAt,
        updatedAt: props.updatedAt,
      },
      update: {
        clipInstructions: props.clipInstructions,
        status: props.status,
        aiResponse: props.aiResponse,
        errorMessage: props.errorMessage,
        startedAt: props.startedAt,
        completedAt: props.completedAt,
        updatedAt: props.updatedAt,
      },
    });
  }

  async findById(id: string): Promise<ProcessingJob | null> {
    const record = await this.prisma.processingJob.findUnique({
      where: { id },
    });

    if (!record) {
      return null;
    }

    return this.toDomain(record);
  }

  async findByVideoId(videoId: string): Promise<ProcessingJob[]> {
    const records = await this.prisma.processingJob.findMany({
      where: { videoId },
      orderBy: { createdAt: 'desc' },
    });

    return records.map((record) => this.toDomain(record));
  }

  async findPending(): Promise<ProcessingJob[]> {
    const records = await this.prisma.processingJob.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'asc' },
    });

    return records.map((record) => this.toDomain(record));
  }

  private toDomain(record: {
    id: string;
    videoId: string;
    clipInstructions: string;
    status: string;
    aiResponse: string | null;
    errorMessage: string | null;
    startedAt: Date | null;
    completedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): ProcessingJob {
    const props: ProcessingJobProps = {
      id: record.id,
      videoId: record.videoId,
      clipInstructions: record.clipInstructions,
      status: record.status as ProcessingJobStatus,
      aiResponse: record.aiResponse,
      errorMessage: record.errorMessage,
      startedAt: record.startedAt,
      completedAt: record.completedAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
    return ProcessingJob.fromProps(props);
  }
}
