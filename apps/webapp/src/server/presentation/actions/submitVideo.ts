'use server';

import type { SubmitVideoRequest, SubmitVideoResponse } from '@video-processor/shared';
import { getBackendClient } from '../../infrastructure/clients/get-backend-client';

export async function submitVideo(request: SubmitVideoRequest): Promise<SubmitVideoResponse> {
  return getBackendClient().submitVideo(request);
}
