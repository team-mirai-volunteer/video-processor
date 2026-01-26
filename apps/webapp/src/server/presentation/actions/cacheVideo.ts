'use server';

import type { CacheVideoResponse } from '@video-processor/shared';
import { getBackendClient } from '../../infrastructure/clients/get-backend-client';

export async function cacheVideo(videoId: string): Promise<CacheVideoResponse> {
  return getBackendClient().cacheVideo(videoId);
}
