'use server';

import { getBackendClient } from '@/server/infrastructure/clients/get-backend-client';

export async function downloadSrt(videoId: string): Promise<string> {
  const backendClient = getBackendClient();
  return backendClient.getTranscriptionSrt(videoId);
}
