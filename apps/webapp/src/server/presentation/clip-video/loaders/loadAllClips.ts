import { getBackendClient } from '@/server/infrastructure/clients/get-backend-client';
import type { GetAllClipsQuery, GetAllClipsResponse } from '@video-processor/shared';

export async function loadAllClips(query?: GetAllClipsQuery): Promise<GetAllClipsResponse> {
  return getBackendClient().getAllClips(query);
}
