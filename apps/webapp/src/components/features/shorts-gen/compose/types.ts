import type { GetComposedVideoResponse } from '@video-processor/shared';

export type ComposeStatus = 'idle' | 'composing' | 'polling' | 'completed' | 'error';

export interface ComposeState {
  status: ComposeStatus;
  composedVideo: GetComposedVideoResponse | null;
  error: string | null;
  selectedBgmKey: string | null;
}

export interface BgmOption {
  key: string;
  label: string;
  description?: string;
}

export interface ComposeStepProps {
  projectId: string;
  scriptId: string | null;
  isEnabled: boolean;
  onComposeComplete?: (composedVideo: GetComposedVideoResponse) => void;
}

export interface VideoPreviewProps {
  videoUrl: string | null;
  durationSeconds: number | null;
  status: string;
  progressPhase: string | null;
  progressPercent: number | null;
  errorMessage: string | null;
}

export interface BgmSelectorProps {
  selectedKey: string | null;
  onSelect: (key: string | null) => void;
  disabled?: boolean;
}
