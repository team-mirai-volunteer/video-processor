'use server';

import type { ExtractClipsRequest, ExtractClipsResponse } from '@video-processor/shared';
import { backendClient } from '../../infrastructure/clients/backend-client';

export async function extractClips(
  videoId: string,
  request: ExtractClipsRequest
): Promise<ExtractClipsResponse> {
  return backendClient.extractClips(videoId, request);
}
