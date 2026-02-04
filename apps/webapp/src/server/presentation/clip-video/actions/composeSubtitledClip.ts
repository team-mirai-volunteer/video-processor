'use server';

import { getBackendClient } from '@/server/infrastructure/clients/get-backend-client';
import type { ComposeSubtitledClipResponse } from '@video-processor/shared';

export async function composeSubtitledClip(clipId: string): Promise<ComposeSubtitledClipResponse> {
  return getBackendClient().composeSubtitledClip(clipId);
}
