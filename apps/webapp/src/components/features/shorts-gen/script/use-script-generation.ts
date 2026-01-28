'use client';

import { useCallback, useState } from 'react';
import type { Scene, Script, UpdateSceneParams } from './types';

export type ScriptGenerationStatus = 'idle' | 'ready' | 'generating' | 'completed' | 'error';

interface UseScriptGenerationOptions {
  projectId: string;
  initialScript?: Script | null;
  initialScenes?: Scene[];
}

interface UseScriptGenerationReturn {
  script: Script | null;
  scenes: Scene[];
  status: ScriptGenerationStatus;
  error: string | null;
  setScript: (script: Script | null) => void;
  setScenes: (scenes: Scene[]) => void;
  setStatus: (status: ScriptGenerationStatus) => void;
  updateScene: (sceneId: string, params: UpdateSceneParams) => Promise<void>;
  fetchScript: () => Promise<void>;
  deleteScene: (sceneId: string) => Promise<void>;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

export function useScriptGeneration({
  projectId,
  initialScript = null,
  initialScenes = [],
}: UseScriptGenerationOptions): UseScriptGenerationReturn {
  const [script, setScript] = useState<Script | null>(initialScript);
  const [scenes, setScenes] = useState<Scene[]>(initialScenes);
  const [status, setStatus] = useState<ScriptGenerationStatus>(
    initialScript ? 'completed' : 'idle'
  );
  const [error, setError] = useState<string | null>(null);

  const fetchScript = useCallback(async () => {
    try {
      setStatus('generating');
      setError(null);

      const response = await fetch(`${API_BASE}/api/shorts-gen/projects/${projectId}/script`);

      if (!response.ok) {
        if (response.status === 404) {
          // No script yet
          setScript(null);
          setScenes([]);
          setStatus('ready');
          return;
        }
        throw new Error(`Failed to fetch script: ${response.status}`);
      }

      const data = await response.json();
      setScript(data.script);
      setScenes(data.scenes || []);
      setStatus('completed');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      setStatus('error');
    }
  }, [projectId]);

  const updateScene = useCallback(
    async (sceneId: string, params: UpdateSceneParams) => {
      try {
        setError(null);

        const response = await fetch(
          `${API_BASE}/api/shorts-gen/projects/${projectId}/scenes/${sceneId}`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(params),
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to update scene: ${response.status}`);
        }

        const updatedScene = await response.json();

        setScenes((prev) => prev.map((s) => (s.id === sceneId ? { ...s, ...updatedScene } : s)));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        throw err;
      }
    },
    [projectId]
  );

  const deleteScene = useCallback(
    async (sceneId: string) => {
      try {
        setError(null);

        const response = await fetch(
          `${API_BASE}/api/shorts-gen/projects/${projectId}/scenes/${sceneId}`,
          {
            method: 'DELETE',
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to delete scene: ${response.status}`);
        }

        setScenes((prev) => prev.filter((s) => s.id !== sceneId));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        throw err;
      }
    },
    [projectId]
  );

  return {
    script,
    scenes,
    status,
    error,
    setScript,
    setScenes,
    setStatus,
    updateScene,
    fetchScript,
    deleteScene,
  };
}
