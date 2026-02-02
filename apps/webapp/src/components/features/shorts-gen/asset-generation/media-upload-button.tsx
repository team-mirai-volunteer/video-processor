'use client';

import { Button } from '@/components/ui/button';
import { MEDIA_VALIDATION, type MediaType } from '@video-processor/shared';
import { Loader2, Upload } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';

// UploadableMedia interface (browser-only, uses File which is a DOM API)
export interface UploadableMedia {
  file: File;
  mediaType: MediaType;
  mimeType: string;
}

interface MediaUploadButtonProps {
  mediaType: MediaType;
  onUpload: (media: UploadableMedia) => Promise<void>;
  disabled?: boolean;
  isUploading?: boolean;
  className?: string;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export function MediaUploadButton({
  mediaType,
  onUpload,
  disabled = false,
  isUploading = false,
  className,
  variant = 'outline',
  size = 'sm',
}: MediaUploadButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const validationConfig = MEDIA_VALIDATION[mediaType];
  const acceptedTypes = validationConfig.allowedMimeTypes.join(',');

  const validateFile = useCallback(
    (file: File): string | null => {
      if (!validationConfig.allowedMimeTypes.includes(file.type)) {
        const formats = mediaType === 'image' ? 'PNG, JPEG, WebP' : 'MP4, WebM';
        return `${formats}形式のファイルを選択してください`;
      }

      if (file.size > validationConfig.maxSizeBytes) {
        const maxSizeMB = validationConfig.maxSizeBytes / (1024 * 1024);
        return `ファイルサイズは${maxSizeMB}MB以下にしてください`;
      }

      return null;
    },
    [mediaType, validationConfig]
  );

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      // Validate
      const validationError = validateFile(file);
      if (validationError) {
        // Validation errors are logged but not thrown to avoid unhandled promise rejection
        console.error('File validation error:', validationError);
        return;
      }

      // Upload
      setIsProcessing(true);
      try {
        await onUpload({
          file,
          mediaType,
          mimeType: file.type,
        });
      } catch (error) {
        // Errors from onUpload are already handled by the parent component
        console.error('Upload error:', error);
      } finally {
        setIsProcessing(false);
      }
    },
    [validateFile, onUpload, mediaType]
  );

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const isDisabled = disabled || isUploading || isProcessing;
  const showSpinner = isUploading || isProcessing;

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        onClick={handleClick}
        disabled={isDisabled}
        className={className}
      >
        {showSpinner ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <>
            <Upload className="h-3 w-3" />
            <span className="ml-1">アップロード</span>
          </>
        )}
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedTypes}
        onChange={handleFileSelect}
        className="hidden"
      />
    </>
  );
}
