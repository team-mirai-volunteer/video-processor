import type { ClipSubtitleRepositoryGateway } from '@clip-video/domain/gateways/clip-subtitle-repository.gateway.js';
import {
  ClipSubtitle,
  type ClipSubtitleProps,
  type ClipSubtitleSegment,
  type ClipSubtitleStatus,
} from '@clip-video/domain/models/clip-subtitle.js';
import type { Prisma, PrismaClient } from '@prisma/client';

/**
 * Prisma JSON から読み込まれるセグメントの型
 * 新形式: lines 配列を持つ
 * 旧形式: text 文字列を持つ（後方互換性のため）
 */
interface PrismaClipSubtitleSegment {
  index: number;
  lines?: string[];
  text?: string; // 旧形式との後方互換性
  startTimeSeconds: number;
  endTimeSeconds: number;
}

export class ClipSubtitleRepository implements ClipSubtitleRepositoryGateway {
  constructor(private readonly prisma: PrismaClient) {}

  async save(subtitle: ClipSubtitle): Promise<void> {
    const props = subtitle.toProps();
    await this.prisma.clipSubtitle.upsert({
      where: { clipId: props.clipId },
      create: {
        id: props.id,
        clipId: props.clipId,
        segments: props.segments as unknown as Prisma.InputJsonValue,
        status: props.status,
        createdAt: props.createdAt,
        updatedAt: props.updatedAt,
      },
      update: {
        segments: props.segments as unknown as Prisma.InputJsonValue,
        status: props.status,
        updatedAt: props.updatedAt,
      },
    });
  }

  async findByClipId(clipId: string): Promise<ClipSubtitle | null> {
    const record = await this.prisma.clipSubtitle.findUnique({
      where: { clipId },
    });

    if (!record) {
      return null;
    }

    return this.toDomain(record);
  }

  async delete(clipId: string): Promise<void> {
    await this.prisma.clipSubtitle.deleteMany({
      where: { clipId },
    });
  }

  private toDomain(record: {
    id: string;
    clipId: string;
    segments: unknown;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  }): ClipSubtitle {
    const segments = record.segments as PrismaClipSubtitleSegment[];

    const props: ClipSubtitleProps = {
      id: record.id,
      clipId: record.clipId,
      segments: segments.map(
        (s): ClipSubtitleSegment => ({
          index: s.index,
          // 旧形式（text）から新形式（lines）への変換
          // 旧形式の場合は text を1行として lines に変換
          lines: s.lines ?? (s.text ? [s.text] : []),
          startTimeSeconds: s.startTimeSeconds,
          endTimeSeconds: s.endTimeSeconds,
        })
      ),
      status: record.status as ClipSubtitleStatus,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };

    return ClipSubtitle.fromProps(props);
  }
}
