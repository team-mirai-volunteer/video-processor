import type { GetVideoResponse } from '@video-processor/shared';
import { backendClient } from '../../infrastructure/clients/backend-client';

export async function loadVideo(id: string): Promise<GetVideoResponse> {
  return backendClient.getVideo(id);
}
