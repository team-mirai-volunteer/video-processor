'use server';

import { getBackendClient } from '@/server/infrastructure/clients/get-backend-client';
import type {
  UpdateClipSubtitleRequest,
  UpdateClipSubtitleResponse,
} from '@video-processor/shared';

export async function updateClipSubtitles(
  clipId: string,
  request: UpdateClipSubtitleRequest
): Promise<UpdateClipSubtitleResponse> {
  return getBackendClient().updateClipSubtitle(clipId, request);
}
