import type { PrismaClient } from '@prisma/client';
import type { ShortsReferenceCharacterRepositoryGateway } from '@shorts-gen/domain/gateways/reference-character-repository.gateway.js';
import {
  ShortsReferenceCharacter,
  type ShortsReferenceCharacterProps,
} from '@shorts-gen/domain/models/reference-character.js';

/**
 * 参照キャラクターRepository実装
 */
export class ShortsReferenceCharacterRepository
  implements ShortsReferenceCharacterRepositoryGateway
{
  constructor(private readonly prisma: PrismaClient) {}

  async save(character: ShortsReferenceCharacter): Promise<void> {
    const props = character.toProps();
    await this.prisma.shortsReferenceCharacter.upsert({
      where: { id: props.id },
      create: {
        id: props.id,
        projectId: props.projectId,
        description: props.description,
        imageUrl: props.imageUrl,
        order: props.order,
        createdAt: props.createdAt,
        updatedAt: props.updatedAt,
      },
      update: {
        description: props.description,
        imageUrl: props.imageUrl,
        order: props.order,
        updatedAt: props.updatedAt,
      },
    });
  }

  async findById(id: string): Promise<ShortsReferenceCharacter | null> {
    const record = await this.prisma.shortsReferenceCharacter.findUnique({
      where: { id },
    });

    if (!record) {
      return null;
    }

    return this.toDomain(record);
  }

  async findByProjectId(projectId: string): Promise<ShortsReferenceCharacter[]> {
    const records = await this.prisma.shortsReferenceCharacter.findMany({
      where: { projectId },
      orderBy: { order: 'asc' },
    });

    return records.map((record) => this.toDomain(record));
  }

  async countByProjectId(projectId: string): Promise<number> {
    return this.prisma.shortsReferenceCharacter.count({
      where: { projectId },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.shortsReferenceCharacter.delete({
      where: { id },
    });
  }

  async deleteByProjectId(projectId: string): Promise<void> {
    await this.prisma.shortsReferenceCharacter.deleteMany({
      where: { projectId },
    });
  }

  private toDomain(record: {
    id: string;
    projectId: string;
    description: string;
    imageUrl: string;
    order: number;
    createdAt: Date;
    updatedAt: Date;
  }): ShortsReferenceCharacter {
    const props: ShortsReferenceCharacterProps = {
      id: record.id,
      projectId: record.projectId,
      description: record.description,
      imageUrl: record.imageUrl,
      order: record.order,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
    return ShortsReferenceCharacter.fromProps(props);
  }
}
