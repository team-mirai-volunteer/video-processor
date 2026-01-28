import type { GetPublishTextResponse } from '@video-processor/shared';

export type PublishTextStatus =
  | 'idle'
  | 'generating'
  | 'completed'
  | 'editing'
  | 'saving'
  | 'error';

export interface PublishTextState {
  status: PublishTextStatus;
  publishText: GetPublishTextResponse | null;
  editedTitle: string;
  editedDescription: string;
  error: string | null;
}

export interface PublishTextStepProps {
  projectId: string;
  isEnabled: boolean;
  onPublishTextComplete?: (publishText: GetPublishTextResponse) => void;
}

export interface PublishTextEditorProps {
  title: string;
  description: string;
  onTitleChange: (title: string) => void;
  onDescriptionChange: (description: string) => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
}

export interface PublishTextDisplayProps {
  title: string;
  description: string;
  onEdit: () => void;
  onCopy: (text: string) => void;
}
