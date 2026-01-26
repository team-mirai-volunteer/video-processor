'use server';

import { getBackendClient } from '@/server/infrastructure/clients/get-backend-client';
import type { CacheVideoResponse } from '@video-processor/shared';

export async function cacheVideo(videoId: string): Promise<CacheVideoResponse> {
  return getBackendClient().cacheVideo(videoId);
}
