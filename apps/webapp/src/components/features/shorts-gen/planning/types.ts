// sharedの型をre-export
export type { ShortsPlanning as Planning } from '@video-processor/shared';

/**
 * Planning update parameters
 */
export interface UpdatePlanningParams {
  content?: string;
}
