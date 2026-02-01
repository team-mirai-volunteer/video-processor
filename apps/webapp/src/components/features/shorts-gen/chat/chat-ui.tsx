'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { AlertCircle, Loader2, Send, Square, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChatMessageList } from './chat-message';
import type { ChatUIProps, ToolCall } from './types';
import { useSSEChat } from './use-sse-chat';

interface ToolCallIndicatorProps {
  toolCalls: ToolCall[];
}

function ToolCallIndicator({ toolCalls }: ToolCallIndicatorProps) {
  if (toolCalls.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2 px-4 py-2 bg-muted/50 rounded-md text-sm">
      {toolCalls.map((tc, index) => (
        <div key={`${tc.name}-${index}`} className="flex items-center gap-2">
          {tc.status === 'running' ? (
            <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
          ) : tc.status === 'completed' ? (
            <div className="h-3 w-3 rounded-full bg-green-500" />
          ) : (
            <div className="h-3 w-3 rounded-full bg-red-500" />
          )}
          <span className="font-mono text-xs">
            {tc.name}
            {tc.status === 'running' && ' ...'}
            {tc.status === 'completed' && ' (完了)'}
          </span>
        </div>
      ))}
    </div>
  );
}

export function ChatUI({
  endpoint,
  title,
  placeholder = 'メッセージを入力...',
  initialMessages = [],
  onToolCall,
  onComplete,
  className,
  disabled = false,
  headers,
}: ChatUIProps) {
  const [input, setInput] = useState('');
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { messages, status, error, toolCalls, sendMessage, clearMessages, abort } = useSSEChat({
    endpoint,
    initialMessages,
    onToolCall,
    onComplete,
    headers,
  });

  const isLoading = status === 'connecting' || status === 'streaming';

  // メッセージが更新されたらコンテナ内でスクロール（ページ全体ではなくインナースクロール）
  const lastMessage = messages.at(-1);
  // biome-ignore lint/correctness/useExhaustiveDependencies: メッセージ更新時にスクロールするため意図的に依存
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages.length, lastMessage?.content]);

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();

      const trimmedInput = input.trim();
      if (!trimmedInput || isLoading || disabled) {
        return;
      }

      setInput('');
      await sendMessage(trimmedInput);
    },
    [input, isLoading, disabled, sendMessage]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // IME入力中（変換確定時）は送信しない
      if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const handleClear = useCallback(() => {
    if (isLoading) {
      abort();
    }
    clearMessages();
    setInput('');
    textareaRef.current?.focus();
  }, [isLoading, abort, clearMessages]);

  return (
    <Card className={cn('flex flex-col', className)}>
      {title && (
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-lg font-medium">{title}</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            disabled={messages.length === 0 && !isLoading}
            className="h-8 w-8 p-0"
          >
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">クリア</span>
          </Button>
        </CardHeader>
      )}

      <CardContent className="flex flex-1 flex-col gap-4 p-4 pt-0 overflow-hidden">
        {/* Messages area */}
        <div ref={messagesContainerRef} className="flex-1 overflow-y-auto min-h-0 pr-2">
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              メッセージがありません
            </div>
          ) : (
            <ChatMessageList messages={messages} />
          )}
        </div>

        {/* Tool call indicator */}
        <ToolCallIndicator toolCalls={toolCalls} />

        {/* Error display */}
        {error && (
          <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Input area */}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled || isLoading}
            className="min-h-[60px] max-h-[120px] resize-none"
            rows={2}
          />
          <div className="flex flex-col gap-2">
            {isLoading ? (
              <Button
                type="button"
                variant="destructive"
                size="icon"
                onClick={abort}
                className="h-[60px] w-10"
              >
                <Square className="h-4 w-4" />
                <span className="sr-only">停止</span>
              </Button>
            ) : (
              <Button
                type="submit"
                size="icon"
                disabled={!input.trim() || disabled}
                className="h-[60px] w-10"
              >
                <Send className="h-4 w-4" />
                <span className="sr-only">送信</span>
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
