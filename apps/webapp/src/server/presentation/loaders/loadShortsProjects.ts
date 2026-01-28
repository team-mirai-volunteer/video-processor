import { getBackendClient } from '@/server/infrastructure/clients/get-backend-client';
import type { GetShortsProjectsQuery, GetShortsProjectsResponse } from '@video-processor/shared';

export async function loadShortsProjects(
  query?: GetShortsProjectsQuery
): Promise<GetShortsProjectsResponse> {
  return getBackendClient().getShortsProjects(query);
}
