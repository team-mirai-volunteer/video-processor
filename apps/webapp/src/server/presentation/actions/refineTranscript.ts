'use server';

import type { RefineTranscriptResponse } from '@video-processor/shared';
import { backendClient } from '../../infrastructure/clients/backend-client';

export async function refineTranscript(videoId: string): Promise<RefineTranscriptResponse> {
  return backendClient.refineTranscript(videoId);
}
