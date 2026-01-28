import type { Prisma, PrismaClient } from '@prisma/client';
import type { ShortsSceneAssetRepositoryGateway } from '@shorts-gen/domain/gateways/scene-asset-repository.gateway.js';
import {
  type AssetType,
  ShortsSceneAsset,
  type ShortsSceneAssetMetadata,
  type ShortsSceneAssetProps,
} from '@shorts-gen/domain/models/scene-asset.js';

type ShortsSceneAssetRecord = {
  id: string;
  sceneId: string;
  assetType: string;
  fileUrl: string;
  durationMs: number | null;
  metadata: Prisma.JsonValue;
  createdAt: Date;
};

export class ShortsSceneAssetRepository implements ShortsSceneAssetRepositoryGateway {
  constructor(private readonly prisma: PrismaClient) {}

  async save(asset: ShortsSceneAsset): Promise<void> {
    const props = asset.toProps();
    await this.prisma.shortsSceneAsset.upsert({
      where: { id: props.id },
      create: {
        id: props.id,
        sceneId: props.sceneId,
        assetType: props.assetType,
        fileUrl: props.fileUrl,
        durationMs: props.durationMs,
        metadata: props.metadata as Prisma.InputJsonValue,
        createdAt: props.createdAt,
      },
      update: {
        fileUrl: props.fileUrl,
        durationMs: props.durationMs,
        metadata: props.metadata as Prisma.InputJsonValue,
      },
    });
  }

  async saveMany(assets: ShortsSceneAsset[]): Promise<void> {
    if (assets.length === 0) return;

    await this.prisma.$transaction(
      assets.map((asset) => {
        const props = asset.toProps();
        return this.prisma.shortsSceneAsset.upsert({
          where: { id: props.id },
          create: {
            id: props.id,
            sceneId: props.sceneId,
            assetType: props.assetType,
            fileUrl: props.fileUrl,
            durationMs: props.durationMs,
            metadata: props.metadata as Prisma.InputJsonValue,
            createdAt: props.createdAt,
          },
          update: {
            fileUrl: props.fileUrl,
            durationMs: props.durationMs,
            metadata: props.metadata as Prisma.InputJsonValue,
          },
        });
      })
    );
  }

  async findById(id: string): Promise<ShortsSceneAsset | null> {
    const record = await this.prisma.shortsSceneAsset.findUnique({
      where: { id },
    });

    if (!record) {
      return null;
    }

    return this.toDomain(record);
  }

  async findBySceneId(sceneId: string): Promise<ShortsSceneAsset[]> {
    const records = await this.prisma.shortsSceneAsset.findMany({
      where: { sceneId },
      orderBy: { createdAt: 'asc' },
    });

    return records.map((record) => this.toDomain(record));
  }

  async findBySceneIdAndType(sceneId: string, assetType: AssetType): Promise<ShortsSceneAsset[]> {
    const records = await this.prisma.shortsSceneAsset.findMany({
      where: { sceneId, assetType },
      orderBy: { createdAt: 'asc' },
    });

    return records.map((record) => this.toDomain(record));
  }

  async findBySceneIds(sceneIds: string[]): Promise<ShortsSceneAsset[]> {
    if (sceneIds.length === 0) return [];

    const records = await this.prisma.shortsSceneAsset.findMany({
      where: { sceneId: { in: sceneIds } },
      orderBy: { createdAt: 'asc' },
    });

    return records.map((record) => this.toDomain(record));
  }

  async delete(id: string): Promise<void> {
    await this.prisma.shortsSceneAsset.delete({
      where: { id },
    });
  }

  async deleteBySceneId(sceneId: string): Promise<void> {
    await this.prisma.shortsSceneAsset.deleteMany({
      where: { sceneId },
    });
  }

  async deleteBySceneIdAndType(sceneId: string, assetType: AssetType): Promise<void> {
    await this.prisma.shortsSceneAsset.deleteMany({
      where: { sceneId, assetType },
    });
  }

  private toDomain(record: ShortsSceneAssetRecord): ShortsSceneAsset {
    const props: ShortsSceneAssetProps = {
      id: record.id,
      sceneId: record.sceneId,
      assetType: record.assetType as AssetType,
      fileUrl: record.fileUrl,
      durationMs: record.durationMs,
      metadata: record.metadata as ShortsSceneAssetMetadata | null,
      createdAt: record.createdAt,
    };
    return ShortsSceneAsset.fromProps(props);
  }
}
