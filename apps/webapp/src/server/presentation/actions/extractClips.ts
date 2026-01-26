'use server';

import type { ExtractClipsRequest, ExtractClipsResponse } from '@video-processor/shared';
import { getBackendClient } from '../../infrastructure/clients/get-backend-client';

export async function extractClips(
  videoId: string,
  request: ExtractClipsRequest
): Promise<ExtractClipsResponse> {
  return getBackendClient().extractClips(videoId, request);
}
