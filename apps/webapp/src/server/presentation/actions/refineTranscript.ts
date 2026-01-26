'use server';

import type { RefineTranscriptResponse } from '@video-processor/shared';
import { getBackendClient } from '../../infrastructure/clients/get-backend-client';

export async function refineTranscript(videoId: string): Promise<RefineTranscriptResponse> {
  return getBackendClient().refineTranscript(videoId);
}
