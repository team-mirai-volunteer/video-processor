import { getBackendClient } from '@/server/infrastructure/clients/get-backend-client';
import type { GetVideoResponse } from '@video-processor/shared';

export async function loadVideo(id: string): Promise<GetVideoResponse> {
  return getBackendClient().getVideo(id, { revalidate: false });
}
