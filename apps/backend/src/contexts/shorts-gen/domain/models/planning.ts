import { type Result, err, ok } from '@shared/domain/types/result.js';

export type ShortsPlanningError =
  | { type: 'INVALID_PROJECT_ID'; message: string }
  | { type: 'INVALID_CONTENT'; message: string }
  | { type: 'INVALID_VERSION'; message: string };

export interface ShortsPlanningProps {
  id: string;
  projectId: string;
  content: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateShortsPlanningParams {
  projectId: string;
  content: string;
}

export class ShortsPlanning {
  readonly id: string;
  readonly projectId: string;
  readonly content: string;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(props: ShortsPlanningProps) {
    this.id = props.id;
    this.projectId = props.projectId;
    this.content = props.content;
    this.version = props.version;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  /**
   * Create a new ShortsPlanning
   */
  static create(
    params: CreateShortsPlanningParams,
    generateId: () => string
  ): Result<ShortsPlanning, ShortsPlanningError> {
    if (!params.projectId || params.projectId.trim().length === 0) {
      return err({
        type: 'INVALID_PROJECT_ID',
        message: 'Project ID cannot be empty',
      });
    }

    if (!params.content || params.content.trim().length === 0) {
      return err({
        type: 'INVALID_CONTENT',
        message: 'Planning content cannot be empty',
      });
    }

    const now = new Date();
    return ok(
      new ShortsPlanning({
        id: generateId(),
        projectId: params.projectId.trim(),
        content: params.content.trim(),
        version: 1,
        createdAt: now,
        updatedAt: now,
      })
    );
  }

  /**
   * Reconstruct ShortsPlanning from database
   */
  static fromProps(props: ShortsPlanningProps): ShortsPlanning {
    return new ShortsPlanning(props);
  }

  /**
   * Update planning content (creates a new version)
   */
  withContent(content: string): Result<ShortsPlanning, ShortsPlanningError> {
    if (!content || content.trim().length === 0) {
      return err({
        type: 'INVALID_CONTENT',
        message: 'Planning content cannot be empty',
      });
    }

    return ok(
      new ShortsPlanning({
        ...this.toProps(),
        content: content.trim(),
        version: this.version + 1,
        updatedAt: new Date(),
      })
    );
  }

  /**
   * Convert to plain object
   */
  toProps(): ShortsPlanningProps {
    return {
      id: this.id,
      projectId: this.projectId,
      content: this.content,
      version: this.version,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
