import { type Result, err, ok } from '@shared/domain/types/result.js';

export type ShortsProjectError =
  | { type: 'INVALID_TITLE'; message: string }
  | { type: 'INVALID_ASPECT_RATIO'; message: string }
  | { type: 'INVALID_RESOLUTION'; message: string };

export interface ShortsProjectProps {
  id: string;
  title: string;
  aspectRatio: string;
  resolutionWidth: number;
  resolutionHeight: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateShortsProjectParams {
  title: string;
  aspectRatio?: string;
  resolutionWidth?: number;
  resolutionHeight?: number;
}

const DEFAULT_ASPECT_RATIO = '9:16';
const DEFAULT_RESOLUTION_WIDTH = 1080;
const DEFAULT_RESOLUTION_HEIGHT = 1920;

const VALID_ASPECT_RATIOS = ['9:16', '16:9', '1:1', '4:5'];

function isValidAspectRatio(aspectRatio: string): boolean {
  return VALID_ASPECT_RATIOS.includes(aspectRatio);
}

function isValidResolution(width: number, height: number): boolean {
  return width > 0 && height > 0 && width <= 4096 && height <= 4096;
}

export class ShortsProject {
  readonly id: string;
  readonly title: string;
  readonly aspectRatio: string;
  readonly resolutionWidth: number;
  readonly resolutionHeight: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(props: ShortsProjectProps) {
    this.id = props.id;
    this.title = props.title;
    this.aspectRatio = props.aspectRatio;
    this.resolutionWidth = props.resolutionWidth;
    this.resolutionHeight = props.resolutionHeight;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  /**
   * Create a new ShortsProject
   */
  static create(
    params: CreateShortsProjectParams,
    generateId: () => string
  ): Result<ShortsProject, ShortsProjectError> {
    if (!params.title || params.title.trim().length === 0) {
      return err({
        type: 'INVALID_TITLE',
        message: 'Title cannot be empty',
      });
    }

    const aspectRatio = params.aspectRatio ?? DEFAULT_ASPECT_RATIO;
    if (!isValidAspectRatio(aspectRatio)) {
      return err({
        type: 'INVALID_ASPECT_RATIO',
        message: `Invalid aspect ratio. Valid values: ${VALID_ASPECT_RATIOS.join(', ')}`,
      });
    }

    const resolutionWidth = params.resolutionWidth ?? DEFAULT_RESOLUTION_WIDTH;
    const resolutionHeight = params.resolutionHeight ?? DEFAULT_RESOLUTION_HEIGHT;
    if (!isValidResolution(resolutionWidth, resolutionHeight)) {
      return err({
        type: 'INVALID_RESOLUTION',
        message: 'Resolution must be between 1 and 4096 pixels',
      });
    }

    const now = new Date();
    return ok(
      new ShortsProject({
        id: generateId(),
        title: params.title.trim(),
        aspectRatio,
        resolutionWidth,
        resolutionHeight,
        createdAt: now,
        updatedAt: now,
      })
    );
  }

  /**
   * Reconstruct ShortsProject from database
   */
  static fromProps(props: ShortsProjectProps): ShortsProject {
    return new ShortsProject(props);
  }

  /**
   * Update project title
   */
  withTitle(title: string): Result<ShortsProject, ShortsProjectError> {
    if (!title || title.trim().length === 0) {
      return err({
        type: 'INVALID_TITLE',
        message: 'Title cannot be empty',
      });
    }

    return ok(
      new ShortsProject({
        ...this.toProps(),
        title: title.trim(),
        updatedAt: new Date(),
      })
    );
  }

  /**
   * Update project aspect ratio
   */
  withAspectRatio(aspectRatio: string): Result<ShortsProject, ShortsProjectError> {
    if (!isValidAspectRatio(aspectRatio)) {
      return err({
        type: 'INVALID_ASPECT_RATIO',
        message: `Invalid aspect ratio. Valid values: ${VALID_ASPECT_RATIOS.join(', ')}`,
      });
    }

    return ok(
      new ShortsProject({
        ...this.toProps(),
        aspectRatio,
        updatedAt: new Date(),
      })
    );
  }

  /**
   * Update project resolution
   */
  withResolution(width: number, height: number): Result<ShortsProject, ShortsProjectError> {
    if (!isValidResolution(width, height)) {
      return err({
        type: 'INVALID_RESOLUTION',
        message: 'Resolution must be between 1 and 4096 pixels',
      });
    }

    return ok(
      new ShortsProject({
        ...this.toProps(),
        resolutionWidth: width,
        resolutionHeight: height,
        updatedAt: new Date(),
      })
    );
  }

  /**
   * Convert to plain object
   */
  toProps(): ShortsProjectProps {
    return {
      id: this.id,
      title: this.title,
      aspectRatio: this.aspectRatio,
      resolutionWidth: this.resolutionWidth,
      resolutionHeight: this.resolutionHeight,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
