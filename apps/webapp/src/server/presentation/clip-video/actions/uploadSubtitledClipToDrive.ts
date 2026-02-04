'use server';

import { getBackendClient } from '@/server/infrastructure/clients/get-backend-client';
import type { UploadSubtitledClipResponse } from '@video-processor/shared';

export async function uploadSubtitledClipToDrive(
  clipId: string
): Promise<UploadSubtitledClipResponse> {
  return getBackendClient().uploadSubtitledClipToDrive(clipId);
}
