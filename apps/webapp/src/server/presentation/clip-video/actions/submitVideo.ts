'use server';

import { getBackendClient } from '@/server/infrastructure/clients/get-backend-client';
import type { SubmitVideoRequest, SubmitVideoResponse } from '@video-processor/shared';

export async function submitVideo(request: SubmitVideoRequest): Promise<SubmitVideoResponse> {
  return getBackendClient().submitVideo(request);
}
