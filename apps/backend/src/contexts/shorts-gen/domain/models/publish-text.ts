import { type Result, err, ok } from '@shared/domain/types/result.js';

export type ShortsPublishTextError =
  | { type: 'INVALID_PROJECT_ID'; message: string }
  | { type: 'INVALID_TITLE'; message: string }
  | { type: 'INVALID_DESCRIPTION'; message: string };

export interface ShortsPublishTextProps {
  id: string;
  projectId: string;
  title: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateShortsPublishTextParams {
  projectId: string;
  title: string;
  description: string;
}

export class ShortsPublishText {
  readonly id: string;
  readonly projectId: string;
  readonly title: string;
  readonly description: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(props: ShortsPublishTextProps) {
    this.id = props.id;
    this.projectId = props.projectId;
    this.title = props.title;
    this.description = props.description;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  /**
   * Create a new ShortsPublishText
   */
  static create(
    params: CreateShortsPublishTextParams,
    generateId: () => string
  ): Result<ShortsPublishText, ShortsPublishTextError> {
    if (!params.projectId || params.projectId.trim().length === 0) {
      return err({
        type: 'INVALID_PROJECT_ID',
        message: 'Project ID cannot be empty',
      });
    }

    if (!params.title || params.title.trim().length === 0) {
      return err({
        type: 'INVALID_TITLE',
        message: 'Title cannot be empty',
      });
    }

    if (!params.description || params.description.trim().length === 0) {
      return err({
        type: 'INVALID_DESCRIPTION',
        message: 'Description cannot be empty',
      });
    }

    const now = new Date();
    return ok(
      new ShortsPublishText({
        id: generateId(),
        projectId: params.projectId.trim(),
        title: params.title.trim(),
        description: params.description.trim(),
        createdAt: now,
        updatedAt: now,
      })
    );
  }

  /**
   * Reconstruct ShortsPublishText from database
   */
  static fromProps(props: ShortsPublishTextProps): ShortsPublishText {
    return new ShortsPublishText(props);
  }

  /**
   * Update title
   */
  withTitle(title: string): Result<ShortsPublishText, ShortsPublishTextError> {
    if (!title || title.trim().length === 0) {
      return err({
        type: 'INVALID_TITLE',
        message: 'Title cannot be empty',
      });
    }

    return ok(
      new ShortsPublishText({
        ...this.toProps(),
        title: title.trim(),
        updatedAt: new Date(),
      })
    );
  }

  /**
   * Update description
   */
  withDescription(description: string): Result<ShortsPublishText, ShortsPublishTextError> {
    if (!description || description.trim().length === 0) {
      return err({
        type: 'INVALID_DESCRIPTION',
        message: 'Description cannot be empty',
      });
    }

    return ok(
      new ShortsPublishText({
        ...this.toProps(),
        description: description.trim(),
        updatedAt: new Date(),
      })
    );
  }

  /**
   * Update both title and description
   */
  withContent(
    title: string,
    description: string
  ): Result<ShortsPublishText, ShortsPublishTextError> {
    if (!title || title.trim().length === 0) {
      return err({
        type: 'INVALID_TITLE',
        message: 'Title cannot be empty',
      });
    }

    if (!description || description.trim().length === 0) {
      return err({
        type: 'INVALID_DESCRIPTION',
        message: 'Description cannot be empty',
      });
    }

    return ok(
      new ShortsPublishText({
        ...this.toProps(),
        title: title.trim(),
        description: description.trim(),
        updatedAt: new Date(),
      })
    );
  }

  /**
   * Convert to plain object
   */
  toProps(): ShortsPublishTextProps {
    return {
      id: this.id,
      projectId: this.projectId,
      title: this.title,
      description: this.description,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
