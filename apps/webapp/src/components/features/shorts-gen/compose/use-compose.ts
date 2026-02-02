'use client';

import { composeVideo, getComposedVideoByProject } from '@/server/presentation/shorts-gen/actions';
import type { GetComposedVideoResponse } from '@video-processor/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ComposeState } from './types';

const POLLING_INTERVAL = 3000;

interface UseComposeOptions {
  projectId: string;
  scriptId: string | null;
  onComposeComplete?: (composedVideo: GetComposedVideoResponse) => void;
}

export function useCompose({ projectId, scriptId, onComposeComplete }: UseComposeOptions) {
  const [state, setState] = useState<ComposeState>({
    status: 'idle',
    composedVideo: null,
    error: null,
    selectedBgmKey: null,
  });

  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const fetchComposedVideo = useCallback(async () => {
    try {
      const video = await getComposedVideoByProject(projectId);
      if (!mountedRef.current) return;

      if (video) {
        setState((prev) => ({
          ...prev,
          composedVideo: video,
          status:
            video.status === 'completed'
              ? 'completed'
              : video.status === 'failed'
                ? 'error'
                : video.status === 'processing'
                  ? 'polling'
                  : prev.status,
          error: video.errorMessage,
        }));

        if (video.status === 'completed') {
          stopPolling();
          onComposeComplete?.(video);
        } else if (video.status === 'failed') {
          stopPolling();
        }
      }
    } catch (error) {
      if (!mountedRef.current) return;
      console.error('Failed to fetch composed video:', error);
    }
  }, [projectId, stopPolling, onComposeComplete]);

  const startPolling = useCallback(() => {
    stopPolling();
    pollingRef.current = setInterval(fetchComposedVideo, POLLING_INTERVAL);
  }, [fetchComposedVideo, stopPolling]);

  const startCompose = useCallback(async () => {
    if (!scriptId) {
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: '台本が選択されていません',
      }));
      return;
    }

    setState((prev) => ({
      ...prev,
      status: 'composing',
      error: null,
    }));

    try {
      await composeVideo(projectId, scriptId, state.selectedBgmKey);
      if (!mountedRef.current) return;

      setState((prev) => ({
        ...prev,
        status: 'polling',
      }));

      startPolling();
    } catch (error) {
      if (!mountedRef.current) return;
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: error instanceof Error ? error.message : '動画合成に失敗しました',
      }));
    }
  }, [projectId, scriptId, state.selectedBgmKey, startPolling]);

  const setSelectedBgmKey = useCallback((key: string | null) => {
    setState((prev) => ({
      ...prev,
      selectedBgmKey: key,
    }));
  }, []);

  const reset = useCallback(() => {
    stopPolling();
    setState({
      status: 'idle',
      composedVideo: null,
      error: null,
      selectedBgmKey: null,
    });
  }, [stopPolling]);

  useEffect(() => {
    mountedRef.current = true;
    fetchComposedVideo();

    return () => {
      mountedRef.current = false;
      stopPolling();
    };
  }, [fetchComposedVideo, stopPolling]);

  useEffect(() => {
    if (state.composedVideo?.status === 'processing' || state.composedVideo?.status === 'pending') {
      startPolling();
    }

    return () => {
      stopPolling();
    };
  }, [state.composedVideo?.status, startPolling, stopPolling]);

  const isComposing = state.status === 'composing' || state.status === 'polling';
  const canCompose = !!scriptId && !isComposing;

  return {
    state,
    isComposing,
    canCompose,
    startCompose,
    setSelectedBgmKey,
    reset,
    refetch: fetchComposedVideo,
  };
}
