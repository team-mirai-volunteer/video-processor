import { getBackendClient } from '@/server/infrastructure/clients/get-backend-client';
import type { GetShortsProjectResponse } from '@video-processor/shared';

export async function loadShortsProject(id: string): Promise<GetShortsProjectResponse> {
  return getBackendClient().getShortsProject(id, { revalidate: false });
}
