'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  createReferenceCharacter,
  deleteReferenceCharacter,
} from '@/server/presentation/actions/shorts-gen';
import type { ReferenceCharacter } from '@video-processor/shared';
import { Loader2, Plus, X } from 'lucide-react';
import Image from 'next/image';
import { useCallback, useRef, useState } from 'react';

const MAX_CHARACTERS = 3;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/jpg'];

interface ReferenceCharacterUploaderProps {
  projectId: string;
  characters: ReferenceCharacter[];
  onCharactersChange: (characters: ReferenceCharacter[]) => void;
}

export function ReferenceCharacterUploader({
  projectId,
  characters,
  onCharactersChange,
}: ReferenceCharacterUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canAddMore = characters.length < MAX_CHARACTERS;

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('PNG または JPEG 形式の画像を選択してください');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError('ファイルサイズは5MB以下にしてください');
      return;
    }

    setError(null);
    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  }, []);

  const handleCancelSelection = useCallback(() => {
    setSelectedFile(null);
    setDescription('');
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [previewUrl]);

  const handleUpload = useCallback(async () => {
    if (!selectedFile || !description.trim()) {
      setError('画像と説明文を入力してください');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('image', selectedFile);
      formData.append('description', description.trim());

      const result = await createReferenceCharacter(projectId, formData);

      if (!result.success) {
        setError(result.error || '登録に失敗しました');
        return;
      }

      if (result.data) {
        onCharactersChange([...characters, result.data]);
      }

      // Reset form
      handleCancelSelection();
    } catch {
      setError('登録に失敗しました');
    } finally {
      setIsUploading(false);
    }
  }, [selectedFile, description, projectId, characters, onCharactersChange, handleCancelSelection]);

  const handleDelete = useCallback(
    async (characterId: string) => {
      setDeletingId(characterId);
      setError(null);

      try {
        const result = await deleteReferenceCharacter(projectId, characterId);

        if (!result.success) {
          setError(result.error || '削除に失敗しました');
          return;
        }

        onCharactersChange(characters.filter((c) => c.id !== characterId));
      } catch {
        setError('削除に失敗しました');
      } finally {
        setDeletingId(null);
      }
    },
    [projectId, characters, onCharactersChange]
  );

  return (
    <div className="border rounded-lg p-3 bg-card mb-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="font-medium text-sm">参照キャラクター（オプション）</h4>
          <p className="text-xs text-muted-foreground">
            登録したキャラクターで一貫した画像を生成します
          </p>
        </div>
        <span className="text-xs text-muted-foreground">
          {characters.length} / {MAX_CHARACTERS}
        </span>
      </div>

      {error && (
        <div className="mb-3 p-2 text-sm text-destructive bg-destructive/10 rounded">{error}</div>
      )}

      <div className="flex gap-3 flex-wrap">
        {/* Existing characters */}
        {characters.map((character) => (
          <div
            key={character.id}
            className="relative w-24 flex-shrink-0 border rounded-lg overflow-hidden bg-muted"
          >
            <div className="aspect-square relative">
              <Image
                src={character.imageUrl}
                alt={character.description}
                fill
                className="object-cover"
                sizes="96px"
              />
            </div>
            <div className="p-1.5">
              <p className="text-xs truncate" title={character.description}>
                {character.description}
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleDelete(character.id)}
              disabled={deletingId === character.id}
              className={cn(
                'absolute top-1 right-1 p-1 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors',
                deletingId === character.id && 'opacity-50 cursor-not-allowed'
              )}
            >
              {deletingId === character.id ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <X className="h-3 w-3" />
              )}
            </button>
          </div>
        ))}

        {/* Add new character form */}
        {canAddMore &&
          (selectedFile && previewUrl ? (
            <div className="w-24 flex-shrink-0 border rounded-lg overflow-hidden bg-muted">
              <div className="aspect-square relative">
                <Image src={previewUrl} alt="Preview" fill className="object-cover" sizes="96px" />
              </div>
              <div className="p-1.5 space-y-1">
                <Input
                  type="text"
                  placeholder="説明"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="h-6 text-xs px-1.5"
                  disabled={isUploading}
                />
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCancelSelection}
                    disabled={isUploading}
                    className="h-5 px-1.5 text-xs flex-1"
                  >
                    ✕
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleUpload}
                    disabled={isUploading || !description.trim()}
                    className="h-5 px-1.5 text-xs flex-1"
                  >
                    {isUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : '登録'}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-24 aspect-square flex-shrink-0 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground hover:border-foreground/50 transition-colors"
            >
              <Plus className="h-6 w-6" />
              <span className="text-xs">追加</span>
            </button>
          ))}

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>
    </div>
  );
}
