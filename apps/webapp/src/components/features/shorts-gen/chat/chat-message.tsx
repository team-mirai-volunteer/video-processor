'use client';

import { cn } from '@/lib/utils';
import { Bot, User } from 'lucide-react';
import Markdown from 'react-markdown';
import type { ChatMessage as ChatMessageType } from './types';

interface ChatMessageProps {
  message: ChatMessageType;
  className?: string;
}

function MessageAvatar({ role }: { role: ChatMessageType['role'] }) {
  if (role === 'user') {
    return (
      <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-md border bg-background shadow">
        <User className="h-4 w-4" />
      </div>
    );
  }

  if (role === 'assistant') {
    return (
      <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-md border bg-primary text-primary-foreground shadow">
        <Bot className="h-4 w-4" />
      </div>
    );
  }

  return null;
}

function StreamingIndicator() {
  return (
    <span className="inline-flex items-center">
      <span className="animate-pulse">|</span>
    </span>
  );
}

export function ChatMessage({ message, className }: ChatMessageProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  if (isSystem) {
    return (
      <div className={cn('flex justify-center py-2', className)}>
        <div className="rounded-md bg-muted px-3 py-1.5 text-xs text-muted-foreground">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'group relative mb-4 flex items-start gap-3',
        isUser ? 'flex-row-reverse' : '',
        className
      )}
    >
      <MessageAvatar role={message.role} />
      <div className={cn('flex-1 space-y-2 overflow-hidden', isUser ? 'flex justify-end' : '')}>
        <div
          className={cn(
            'inline-block rounded-lg px-4 py-2 text-sm',
            isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'
          )}
        >
          <div className="prose prose-sm dark:prose-invert max-w-none break-words">
            <Markdown>{message.content}</Markdown>
            {message.isStreaming && <StreamingIndicator />}
          </div>
        </div>
      </div>
    </div>
  );
}

interface ChatMessageListProps {
  messages: ChatMessageType[];
  className?: string;
}

export function ChatMessageList({ messages, className }: ChatMessageListProps) {
  return (
    <div className={cn('space-y-4', className)}>
      {messages.map((message) => (
        <ChatMessage key={message.id} message={message} />
      ))}
    </div>
  );
}
