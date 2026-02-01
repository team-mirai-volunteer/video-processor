import { type Result, err, ok } from '@shared/domain/types/result.js';

/**
 * 参照キャラクターのエラー型
 */
export type ShortsReferenceCharacterError =
  | { type: 'INVALID_PROJECT_ID'; message: string }
  | { type: 'INVALID_DESCRIPTION'; message: string }
  | { type: 'INVALID_IMAGE_URL'; message: string }
  | { type: 'INVALID_ORDER'; message: string };

/**
 * 参照キャラクターのプロパティ（DBからの復元用）
 */
export interface ShortsReferenceCharacterProps {
  id: string;
  projectId: string;
  description: string;
  imageUrl: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 参照キャラクターの作成パラメータ
 */
export interface CreateShortsReferenceCharacterParams {
  projectId: string;
  description: string;
  imageUrl: string;
  order?: number;
}

/**
 * 参照キャラクタードメインモデル
 *
 * 画像生成の一貫性のために使用される参照キャラクター画像と説明文を管理する。
 * プロジェクトごとに最大3枚まで登録可能。
 */
export class ShortsReferenceCharacter {
  readonly id: string;
  readonly projectId: string;
  readonly description: string;
  readonly imageUrl: string;
  readonly order: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(props: ShortsReferenceCharacterProps) {
    this.id = props.id;
    this.projectId = props.projectId;
    this.description = props.description;
    this.imageUrl = props.imageUrl;
    this.order = props.order;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  /**
   * 新しい参照キャラクターを作成する
   */
  static create(
    params: CreateShortsReferenceCharacterParams,
    generateId: () => string
  ): Result<ShortsReferenceCharacter, ShortsReferenceCharacterError> {
    // バリデーション: projectId
    if (!params.projectId || params.projectId.trim().length === 0) {
      return err({
        type: 'INVALID_PROJECT_ID',
        message: 'Project ID cannot be empty',
      });
    }

    // バリデーション: description
    if (!params.description || params.description.trim().length === 0) {
      return err({
        type: 'INVALID_DESCRIPTION',
        message: 'Description cannot be empty',
      });
    }

    // バリデーション: imageUrl
    if (!params.imageUrl || params.imageUrl.trim().length === 0) {
      return err({
        type: 'INVALID_IMAGE_URL',
        message: 'Image URL cannot be empty',
      });
    }

    // バリデーション: order（オプション、デフォルト0）
    const order = params.order ?? 0;
    if (order < 0) {
      return err({
        type: 'INVALID_ORDER',
        message: 'Order must be 0 or greater',
      });
    }

    const now = new Date();
    return ok(
      new ShortsReferenceCharacter({
        id: generateId(),
        projectId: params.projectId.trim(),
        description: params.description.trim(),
        imageUrl: params.imageUrl.trim(),
        order,
        createdAt: now,
        updatedAt: now,
      })
    );
  }

  /**
   * DBからの復元
   */
  static fromProps(props: ShortsReferenceCharacterProps): ShortsReferenceCharacter {
    return new ShortsReferenceCharacter(props);
  }

  /**
   * 説明文を更新する
   */
  withDescription(
    description: string
  ): Result<ShortsReferenceCharacter, ShortsReferenceCharacterError> {
    if (!description || description.trim().length === 0) {
      return err({
        type: 'INVALID_DESCRIPTION',
        message: 'Description cannot be empty',
      });
    }

    return ok(
      new ShortsReferenceCharacter({
        ...this.toProps(),
        description: description.trim(),
        updatedAt: new Date(),
      })
    );
  }

  /**
   * 順序を更新する
   */
  withOrder(order: number): Result<ShortsReferenceCharacter, ShortsReferenceCharacterError> {
    if (order < 0) {
      return err({
        type: 'INVALID_ORDER',
        message: 'Order must be 0 or greater',
      });
    }

    return ok(
      new ShortsReferenceCharacter({
        ...this.toProps(),
        order,
        updatedAt: new Date(),
      })
    );
  }

  /**
   * プレーンオブジェクトに変換する
   */
  toProps(): ShortsReferenceCharacterProps {
    return {
      id: this.id,
      projectId: this.projectId,
      description: this.description,
      imageUrl: this.imageUrl,
      order: this.order,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
