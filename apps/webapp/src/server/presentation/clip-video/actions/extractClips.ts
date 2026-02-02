'use server';

import { getBackendClient } from '@/server/infrastructure/clients/get-backend-client';
import type { ExtractClipsRequest, ExtractClipsResponse } from '@video-processor/shared';

export async function extractClips(
  videoId: string,
  request: ExtractClipsRequest
): Promise<ExtractClipsResponse> {
  return getBackendClient().extractClips(videoId, request);
}
