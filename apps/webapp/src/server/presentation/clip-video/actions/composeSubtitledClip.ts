'use server';

import { getBackendClient } from '@/server/infrastructure/clients/get-backend-client';
import type {
  ClipComposeStatusResponse,
  ComposeSubtitledClipRequest,
} from '@video-processor/shared';

export async function composeSubtitledClip(
  clipId: string,
  request?: ComposeSubtitledClipRequest
): Promise<{ message: string; clipId: string }> {
  return getBackendClient().composeSubtitledClip(clipId, request);
}

export async function getClipComposeStatus(clipId: string): Promise<ClipComposeStatusResponse> {
  return getBackendClient().getClipComposeStatus(clipId, { revalidate: false });
}
