'use server';

import { backendClient } from '@/server/infrastructure/clients/backend-client';
import type {
  ComposeVideoAcceptedResponse,
  ComposeVideoResponse,
  GetComposedVideoResponse,
} from '@video-processor/shared';

export async function composeVideo(
  projectId: string,
  scriptId: string,
  bgmKey?: string | null
): Promise<ComposeVideoAcceptedResponse> {
  return backendClient.composeVideo({ projectId, scriptId, bgmKey });
}

export async function composeVideoSync(
  projectId: string,
  scriptId: string,
  bgmKey?: string | null
): Promise<ComposeVideoResponse> {
  return backendClient.composeVideoSync({ projectId, scriptId, bgmKey });
}

export async function getComposedVideoByProject(
  projectId: string
): Promise<GetComposedVideoResponse | null> {
  return backendClient.getComposedVideoByProject(projectId, { revalidate: false });
}

export async function getComposedVideo(id: string): Promise<GetComposedVideoResponse | null> {
  return backendClient.getComposedVideo(id, { revalidate: false });
}

export async function deleteComposedVideo(id: string): Promise<void> {
  return backendClient.deleteComposedVideo(id);
}
