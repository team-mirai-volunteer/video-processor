'use server';

import { getBackendClient } from '@/server/infrastructure/clients/get-backend-client';
import type { ExtractClipByTimeRequest, ExtractClipByTimeResponse } from '@video-processor/shared';

export async function extractClipByTime(
  videoId: string,
  request: ExtractClipByTimeRequest
): Promise<ExtractClipByTimeResponse> {
  return getBackendClient().extractClipByTime(videoId, request);
}
