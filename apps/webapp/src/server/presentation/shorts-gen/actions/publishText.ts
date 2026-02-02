'use server';

import { backendClient } from '@/server/infrastructure/clients/backend-client';
import type { GeneratePublishTextResponse, GetPublishTextResponse } from '@video-processor/shared';

export async function generatePublishText(projectId: string): Promise<GeneratePublishTextResponse> {
  return backendClient.generatePublishText({ projectId });
}

export async function getPublishTextByProject(
  projectId: string
): Promise<GetPublishTextResponse | null> {
  return backendClient.getPublishTextByProject(projectId, { revalidate: false });
}

export async function updatePublishText(
  id: string,
  title?: string,
  description?: string
): Promise<GetPublishTextResponse> {
  return backendClient.updatePublishText(id, { title, description });
}
