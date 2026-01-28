import { getBackendClient } from '@/server/infrastructure/clients/get-backend-client';
import type { GetShortsProjectsResponse } from '@video-processor/shared';

export async function loadShortsProjects(): Promise<GetShortsProjectsResponse> {
  return getBackendClient().getShortsProjects();
}
