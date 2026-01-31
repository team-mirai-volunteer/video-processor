'use server';

import type { GeneratePublishTextResponse, GetPublishTextResponse } from '@video-processor/shared';
import { backendClient } from '@/server/infrastructure/clients/backend-client';

export async function generatePublishText(projectId: string): Promise<GeneratePublishTextResponse> {
  return backendClient.generatePublishText({ projectId });
}

export async function getPublishTextByProject(
  projectId: string
): Promise<GetPublishTextResponse | null> {
  return backendClient.getPublishTextByProject(projectId, { revalidate: false });
}

export async function getPublishText(id: string): Promise<GetPublishTextResponse | null> {
  return backendClient.getPublishText(id, { revalidate: false });
}

export async function updatePublishText(
  id: string,
  title?: string,
  description?: string
): Promise<GetPublishTextResponse> {
  return backendClient.updatePublishText(id, { title, description });
}

export async function deletePublishText(id: string): Promise<void> {
  return backendClient.deletePublishText(id);
}
