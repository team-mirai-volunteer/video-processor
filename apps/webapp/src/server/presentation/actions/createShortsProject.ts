'use server';

import { getBackendClient } from '@/server/infrastructure/clients/get-backend-client';
import type {
  CreateShortsProjectRequest,
  CreateShortsProjectResponse,
} from '@video-processor/shared';

export async function createShortsProject(
  request: CreateShortsProjectRequest
): Promise<CreateShortsProjectResponse> {
  return getBackendClient().createShortsProject(request);
}
