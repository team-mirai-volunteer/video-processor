'use server';

import { getBackendClient } from '@/server/infrastructure/clients/get-backend-client';
import type { DeleteShortsProjectResponse } from '@video-processor/shared';

export async function deleteShortsProject(id: string): Promise<DeleteShortsProjectResponse> {
  return getBackendClient().deleteShortsProject(id);
}
