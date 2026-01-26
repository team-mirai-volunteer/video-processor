import type { GetClipsResponse } from '@video-processor/shared';
import { backendClient } from '../../infrastructure/clients/backend-client';

export async function loadClips(videoId: string): Promise<GetClipsResponse> {
  return backendClient.getClips(videoId);
}
