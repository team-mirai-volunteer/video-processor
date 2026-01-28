import { type Result, err, ok } from '@shared/domain/types/result.js';

export type ShortsScriptError =
  | { type: 'INVALID_PROJECT_ID'; message: string }
  | { type: 'INVALID_PLANNING_ID'; message: string }
  | { type: 'INVALID_VERSION'; message: string };

export interface ShortsScriptProps {
  id: string;
  projectId: string;
  planningId: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateShortsScriptParams {
  projectId: string;
  planningId: string;
}

export class ShortsScript {
  readonly id: string;
  readonly projectId: string;
  readonly planningId: string;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(props: ShortsScriptProps) {
    this.id = props.id;
    this.projectId = props.projectId;
    this.planningId = props.planningId;
    this.version = props.version;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  /**
   * Create a new ShortsScript
   */
  static create(
    params: CreateShortsScriptParams,
    generateId: () => string
  ): Result<ShortsScript, ShortsScriptError> {
    if (!params.projectId || params.projectId.trim().length === 0) {
      return err({
        type: 'INVALID_PROJECT_ID',
        message: 'Project ID cannot be empty',
      });
    }

    if (!params.planningId || params.planningId.trim().length === 0) {
      return err({
        type: 'INVALID_PLANNING_ID',
        message: 'Planning ID cannot be empty',
      });
    }

    const now = new Date();
    return ok(
      new ShortsScript({
        id: generateId(),
        projectId: params.projectId.trim(),
        planningId: params.planningId.trim(),
        version: 1,
        createdAt: now,
        updatedAt: now,
      })
    );
  }

  /**
   * Reconstruct ShortsScript from database
   */
  static fromProps(props: ShortsScriptProps): ShortsScript {
    return new ShortsScript(props);
  }

  /**
   * Increment version (for editing scenarios)
   */
  withNewVersion(): ShortsScript {
    return new ShortsScript({
      ...this.toProps(),
      version: this.version + 1,
      updatedAt: new Date(),
    });
  }

  /**
   * Convert to plain object
   */
  toProps(): ShortsScriptProps {
    return {
      id: this.id,
      projectId: this.projectId,
      planningId: this.planningId,
      version: this.version,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
