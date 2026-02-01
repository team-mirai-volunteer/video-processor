'use server';

import { backendClient } from '@/server/infrastructure/clients/backend-client';
import type {
  ComposeVideoAcceptedResponse,
  GetComposedVideoResponse,
} from '@video-processor/shared';

export async function composeVideo(
  projectId: string,
  scriptId: string,
  bgmKey?: string | null
): Promise<ComposeVideoAcceptedResponse> {
  return backendClient.composeVideo({ projectId, scriptId, bgmKey });
}

export async function getComposedVideoByProject(
  projectId: string
): Promise<GetComposedVideoResponse | null> {
  return backendClient.getComposedVideoByProject(projectId, { revalidate: false });
}
