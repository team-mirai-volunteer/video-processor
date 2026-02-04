'use server';

import { getBackendClient } from '@/server/infrastructure/clients/get-backend-client';
import type { GetClipVideoUrlResponse } from '@video-processor/shared';

export async function getClipVideoUrl(clipId: string): Promise<GetClipVideoUrlResponse | null> {
  return getBackendClient().getClipVideoUrl(clipId, { revalidate: false });
}
