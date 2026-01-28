'use client';

import {
  generatePublishText,
  getPublishTextByProject,
  updatePublishText,
} from '@/server/presentation/actions/shorts-gen';
import type { GetPublishTextResponse } from '@video-processor/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PublishTextState } from './types';

interface UsePublishTextOptions {
  projectId: string;
  onPublishTextComplete?: (publishText: GetPublishTextResponse) => void;
}

export function usePublishText({ projectId, onPublishTextComplete }: UsePublishTextOptions) {
  const [state, setState] = useState<PublishTextState>({
    status: 'idle',
    publishText: null,
    editedTitle: '',
    editedDescription: '',
    error: null,
  });

  const mountedRef = useRef(true);

  const fetchPublishText = useCallback(async () => {
    try {
      const text = await getPublishTextByProject(projectId);
      if (!mountedRef.current) return;

      if (text) {
        setState((prev) => ({
          ...prev,
          publishText: text,
          editedTitle: text.title,
          editedDescription: text.description,
          status: 'completed',
        }));
        onPublishTextComplete?.(text);
      }
    } catch (error) {
      if (!mountedRef.current) return;
      console.error('Failed to fetch publish text:', error);
    }
  }, [projectId, onPublishTextComplete]);

  const generate = useCallback(async () => {
    setState((prev) => ({
      ...prev,
      status: 'generating',
      error: null,
    }));

    try {
      await generatePublishText(projectId);
      if (!mountedRef.current) return;

      const text = await getPublishTextByProject(projectId);
      if (!mountedRef.current) return;

      if (text) {
        setState((prev) => ({
          ...prev,
          status: 'completed',
          publishText: text,
          editedTitle: text.title,
          editedDescription: text.description,
        }));
        onPublishTextComplete?.(text);
      }
    } catch (error) {
      if (!mountedRef.current) return;
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: error instanceof Error ? error.message : '公開テキストの生成に失敗しました',
      }));
    }
  }, [projectId, onPublishTextComplete]);

  const startEditing = useCallback(() => {
    setState((prev) => ({
      ...prev,
      status: 'editing',
      editedTitle: prev.publishText?.title ?? '',
      editedDescription: prev.publishText?.description ?? '',
    }));
  }, []);

  const cancelEditing = useCallback(() => {
    setState((prev) => ({
      ...prev,
      status: 'completed',
      editedTitle: prev.publishText?.title ?? '',
      editedDescription: prev.publishText?.description ?? '',
    }));
  }, []);

  const setEditedTitle = useCallback((title: string) => {
    setState((prev) => ({
      ...prev,
      editedTitle: title,
    }));
  }, []);

  const setEditedDescription = useCallback((description: string) => {
    setState((prev) => ({
      ...prev,
      editedDescription: description,
    }));
  }, []);

  const saveChanges = useCallback(async () => {
    if (!state.publishText) return;

    setState((prev) => ({
      ...prev,
      status: 'saving',
      error: null,
    }));

    try {
      const updated = await updatePublishText(
        state.publishText.id,
        state.editedTitle,
        state.editedDescription
      );
      if (!mountedRef.current) return;

      setState((prev) => ({
        ...prev,
        status: 'completed',
        publishText: updated,
      }));
      onPublishTextComplete?.(updated);
    } catch (error) {
      if (!mountedRef.current) return;
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: error instanceof Error ? error.message : '公開テキストの保存に失敗しました',
      }));
    }
  }, [state.publishText, state.editedTitle, state.editedDescription, onPublishTextComplete]);

  const reset = useCallback(() => {
    setState({
      status: 'idle',
      publishText: null,
      editedTitle: '',
      editedDescription: '',
      error: null,
    });
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchPublishText();

    return () => {
      mountedRef.current = false;
    };
  }, [fetchPublishText]);

  const isGenerating = state.status === 'generating';
  const isEditing = state.status === 'editing';
  const isSaving = state.status === 'saving';
  const hasPublishText = !!state.publishText;

  return {
    state,
    isGenerating,
    isEditing,
    isSaving,
    hasPublishText,
    generate,
    startEditing,
    cancelEditing,
    setEditedTitle,
    setEditedDescription,
    saveChanges,
    reset,
    refetch: fetchPublishText,
  };
}
