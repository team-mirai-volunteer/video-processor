'use server';

import { getBackendClient } from '@/server/infrastructure/clients/get-backend-client';
import type { GenerateClipSubtitlesResponse } from '@video-processor/shared';

export async function generateClipSubtitles(
  clipId: string
): Promise<GenerateClipSubtitlesResponse> {
  return getBackendClient().generateClipSubtitles(clipId);
}
