import type { GetVideosQuery, GetVideosResponse } from '@video-processor/shared';
import { backendClient } from '../../infrastructure/clients/backend-client';

export async function loadVideos(query?: GetVideosQuery): Promise<GetVideosResponse> {
  return backendClient.getVideos(query);
}
