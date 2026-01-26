import type { GetVideoResponse } from '@video-processor/shared';
import { getBackendClient } from '../../infrastructure/clients/get-backend-client';

export async function loadVideo(id: string): Promise<GetVideoResponse> {
  return getBackendClient().getVideo(id);
}
