import { getBackendClient } from '@/server/infrastructure/clients/get-backend-client';
import type { GetVideosQuery, GetVideosResponse } from '@video-processor/shared';

export async function loadVideos(query?: GetVideosQuery): Promise<GetVideosResponse> {
  return getBackendClient().getVideos(query);
}
