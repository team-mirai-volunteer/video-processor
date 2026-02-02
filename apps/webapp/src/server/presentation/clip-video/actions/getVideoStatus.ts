'use server';

import { BackendApiError } from '@/server/infrastructure/clients/backend-client';
import { getBackendClient } from '@/server/infrastructure/clients/get-backend-client';
import type {
  GetRefinedTranscriptionResponse,
  GetTranscriptionResponse,
  GetVideoResponse,
} from '@video-processor/shared';

export interface VideoStatusResponse {
  video: GetVideoResponse;
  transcription: GetTranscriptionResponse | null;
  refinedTranscription: GetRefinedTranscriptionResponse | null;
}

export async function getVideoStatus(videoId: string): Promise<VideoStatusResponse> {
  const client = getBackendClient();

  const video = await client.getVideo(videoId, { revalidate: false });

  let transcription: GetTranscriptionResponse | null = null;
  let refinedTranscription: GetRefinedTranscriptionResponse | null = null;

  // transcribing以降のステータスでは文字起こしを取得
  if (
    video.status === 'transcribed' ||
    video.status === 'extracting' ||
    video.status === 'completed'
  ) {
    try {
      [transcription, refinedTranscription] = await Promise.all([
        client.getTranscription(videoId, { revalidate: false }),
        client.getRefinedTranscription(videoId, { revalidate: false }).catch((err) => {
          if (err instanceof BackendApiError && err.status === 404) {
            return null;
          }
          throw err;
        }),
      ]);
    } catch (err) {
      if (err instanceof BackendApiError && err.status === 404) {
        transcription = null;
      } else {
        throw err;
      }
    }
  }

  return {
    video,
    transcription,
    refinedTranscription,
  };
}
