import type { GetVideosQuery, GetVideosResponse } from '@video-processor/shared';
import { getBackendClient } from '../../infrastructure/clients/get-backend-client';

export async function loadVideos(query?: GetVideosQuery): Promise<GetVideosResponse> {
  return getBackendClient().getVideos(query);
}
