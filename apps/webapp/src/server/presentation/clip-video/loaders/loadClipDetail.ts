import { getBackendClient } from '@/server/infrastructure/clients/get-backend-client';
import type { GetClipResponse } from '@video-processor/shared';

export async function loadClipDetail(clipId: string): Promise<GetClipResponse | null> {
  return getBackendClient().getClip(clipId, { revalidate: false });
}
