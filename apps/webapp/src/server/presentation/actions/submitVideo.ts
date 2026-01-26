'use server';

import type { SubmitVideoRequest, SubmitVideoResponse } from '@video-processor/shared';
import { backendClient } from '../../infrastructure/clients/backend-client';

export async function submitVideo(request: SubmitVideoRequest): Promise<SubmitVideoResponse> {
  return backendClient.submitVideo(request);
}
