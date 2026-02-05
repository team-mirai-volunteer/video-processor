'use server';

import { getBackendClient } from '@/server/infrastructure/clients/get-backend-client';
import type {
  ComposeSubtitledClipRequest,
  ComposeSubtitledClipResponse,
} from '@video-processor/shared';

export async function composeSubtitledClip(
  clipId: string,
  request?: ComposeSubtitledClipRequest
): Promise<ComposeSubtitledClipResponse> {
  return getBackendClient().composeSubtitledClip(clipId, request);
}
