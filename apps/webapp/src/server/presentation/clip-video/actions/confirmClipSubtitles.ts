'use server';

import { getBackendClient } from '@/server/infrastructure/clients/get-backend-client';
import type { ConfirmClipSubtitleResponse } from '@video-processor/shared';

export async function confirmClipSubtitles(clipId: string): Promise<ConfirmClipSubtitleResponse> {
  return getBackendClient().confirmClipSubtitle(clipId);
}
