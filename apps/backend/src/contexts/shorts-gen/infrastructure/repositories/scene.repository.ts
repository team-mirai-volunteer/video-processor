import type { Prisma, PrismaClient } from '@prisma/client';
import type { ShortsSceneRepositoryGateway } from '@shorts-gen/domain/gateways/scene-repository.gateway.js';
import {
  ShortsScene,
  type ShortsSceneProps,
  type VisualType,
} from '@shorts-gen/domain/models/scene.js';

type ShortsSceneRecord = {
  id: string;
  scriptId: string;
  order: number;
  summary: string;
  visualType: string;
  voiceText: string | null;
  subtitles: Prisma.JsonValue;
  silenceDurationMs: number | null;
  stockVideoKey: string | null;
  solidColor: string | null;
  imagePrompt: string | null;
  imageStyleHint: string | null;
  voiceKey: string | null;
  voiceSpeed: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export class ShortsSceneRepository implements ShortsSceneRepositoryGateway {
  constructor(private readonly prisma: PrismaClient) {}

  async save(scene: ShortsScene): Promise<void> {
    const props = scene.toProps();
    await this.prisma.shortsScene.upsert({
      where: { id: props.id },
      create: {
        id: props.id,
        scriptId: props.scriptId,
        order: props.order,
        summary: props.summary,
        visualType: props.visualType,
        voiceText: props.voiceText,
        subtitles: props.subtitles,
        silenceDurationMs: props.silenceDurationMs,
        stockVideoKey: props.stockVideoKey,
        solidColor: props.solidColor,
        imagePrompt: props.imagePrompt,
        imageStyleHint: props.imageStyleHint,
        voiceKey: props.voiceKey,
        voiceSpeed: props.voiceSpeed,
        createdAt: props.createdAt,
        updatedAt: props.updatedAt,
      },
      update: {
        order: props.order,
        summary: props.summary,
        visualType: props.visualType,
        voiceText: props.voiceText,
        subtitles: props.subtitles,
        silenceDurationMs: props.silenceDurationMs,
        stockVideoKey: props.stockVideoKey,
        solidColor: props.solidColor,
        imagePrompt: props.imagePrompt,
        imageStyleHint: props.imageStyleHint,
        voiceKey: props.voiceKey,
        voiceSpeed: props.voiceSpeed,
        updatedAt: props.updatedAt,
      },
    });
  }

  async saveMany(scenes: ShortsScene[]): Promise<void> {
    if (scenes.length === 0) return;

    await this.prisma.$transaction(
      scenes.map((scene) => {
        const props = scene.toProps();
        return this.prisma.shortsScene.upsert({
          where: { id: props.id },
          create: {
            id: props.id,
            scriptId: props.scriptId,
            order: props.order,
            summary: props.summary,
            visualType: props.visualType,
            voiceText: props.voiceText,
            subtitles: props.subtitles,
            silenceDurationMs: props.silenceDurationMs,
            stockVideoKey: props.stockVideoKey,
            solidColor: props.solidColor,
            imagePrompt: props.imagePrompt,
            imageStyleHint: props.imageStyleHint,
            voiceKey: props.voiceKey,
            voiceSpeed: props.voiceSpeed,
            createdAt: props.createdAt,
            updatedAt: props.updatedAt,
          },
          update: {
            order: props.order,
            summary: props.summary,
            visualType: props.visualType,
            voiceText: props.voiceText,
            subtitles: props.subtitles,
            silenceDurationMs: props.silenceDurationMs,
            stockVideoKey: props.stockVideoKey,
            solidColor: props.solidColor,
            imagePrompt: props.imagePrompt,
            imageStyleHint: props.imageStyleHint,
            voiceKey: props.voiceKey,
            voiceSpeed: props.voiceSpeed,
            updatedAt: props.updatedAt,
          },
        });
      })
    );
  }

  async findById(id: string): Promise<ShortsScene | null> {
    const record = await this.prisma.shortsScene.findUnique({
      where: { id },
    });

    if (!record) {
      return null;
    }

    return this.toDomain(record);
  }

  async findByScriptId(scriptId: string): Promise<ShortsScene[]> {
    const records = await this.prisma.shortsScene.findMany({
      where: { scriptId },
      orderBy: { order: 'asc' },
    });

    return records.map((record) => this.toDomain(record));
  }

  async findByScriptIdAndOrder(scriptId: string, order: number): Promise<ShortsScene | null> {
    const record = await this.prisma.shortsScene.findFirst({
      where: { scriptId, order },
    });

    if (!record) {
      return null;
    }

    return this.toDomain(record);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.shortsScene.delete({
      where: { id },
    });
  }

  async deleteByScriptId(scriptId: string): Promise<void> {
    await this.prisma.shortsScene.deleteMany({
      where: { scriptId },
    });
  }

  async countByScriptId(scriptId: string): Promise<number> {
    return await this.prisma.shortsScene.count({
      where: { scriptId },
    });
  }

  private toDomain(record: ShortsSceneRecord): ShortsScene {
    const props: ShortsSceneProps = {
      id: record.id,
      scriptId: record.scriptId,
      order: record.order,
      summary: record.summary,
      visualType: record.visualType as VisualType,
      voiceText: record.voiceText,
      subtitles: Array.isArray(record.subtitles) ? (record.subtitles as string[]) : [],
      silenceDurationMs: record.silenceDurationMs,
      stockVideoKey: record.stockVideoKey,
      solidColor: record.solidColor,
      imagePrompt: record.imagePrompt,
      imageStyleHint: record.imageStyleHint,
      voiceKey: record.voiceKey,
      voiceSpeed: record.voiceSpeed,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
    return ShortsScene.fromProps(props);
  }
}
