'use client';

import { useCallback, useRef, useState } from 'react';
import type {
  ChatMessage,
  ChatStatus,
  SSEEvent,
  ToolCall,
  UseSSEChatOptions,
  UseSSEChatReturn,
} from './types';

function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function parseSSEData(data: string): SSEEvent | null {
  try {
    return JSON.parse(data) as SSEEvent;
  } catch {
    return null;
  }
}

export function useSSEChat(options: UseSSEChatOptions): UseSSEChatReturn {
  const { endpoint, onToolCall, onComplete, onError, initialMessages = [], headers = {} } = options;

  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [status, setStatus] = useState<ChatStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);

  const abortControllerRef = useRef<AbortController | null>(null);
  const currentAssistantMessageIdRef = useRef<string | null>(null);

  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setStatus('idle');
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setToolCalls([]);
    setError(null);
  }, []);

  const sendMessage = useCallback(
    async (content: string) => {
      if (status === 'streaming' || status === 'connecting') {
        return;
      }

      const userMessage: ChatMessage = {
        id: generateId(),
        role: 'user',
        content,
        createdAt: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setStatus('connecting');
      setError(null);
      setToolCalls([]);

      abortControllerRef.current = new AbortController();

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...headers,
          },
          body: JSON.stringify({
            message: content,
            history: messages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`);
        }

        if (!response.body) {
          throw new Error('Response body is null');
        }

        setStatus('streaming');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        // Create assistant message placeholder
        const assistantMessageId = generateId();
        currentAssistantMessageIdRef.current = assistantMessageId;

        const assistantMessage: ChatMessage = {
          id: assistantMessageId,
          role: 'assistant',
          content: '',
          createdAt: new Date(),
          isStreaming: true,
        };

        setMessages((prev) => [...prev, assistantMessage]);

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });

          // Process SSE format: "data: {...}\n\n"
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);

              if (data === '[DONE]') {
                continue;
              }

              const event = parseSSEData(data);

              if (!event) {
                continue;
              }

              // Handle both frontend format (content_delta) and backend format (text_delta)
              // Backend sends: { type: 'text_delta', textDelta: '...' }
              // Frontend expects: { type: 'content_delta', data: { content: '...' } }
              const backendEvent = event as unknown as {
                type: string;
                textDelta?: string;
                toolCall?: { id: string; name: string; arguments: Record<string, unknown> };
                savedPlanning?: unknown;
                toolCompleted?: boolean;
                error?: string;
              };

              switch (event.type) {
                case 'content_delta':
                  if (event.data?.content) {
                    const deltaContent = event.data.content;
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantMessageId
                          ? { ...m, content: m.content + deltaContent }
                          : m
                      )
                    );
                  }
                  break;

                // Backend format: text_delta
                case 'text_delta':
                  if (backendEvent.textDelta) {
                    const deltaContent = backendEvent.textDelta;
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantMessageId
                          ? { ...m, content: m.content + deltaContent }
                          : m
                      )
                    );
                  }
                  break;

                case 'tool_call':
                  // Frontend format: { data: { toolName, toolArgs } }
                  if (event.data?.toolName) {
                    const toolCall: ToolCall = {
                      name: event.data.toolName,
                      args: event.data.toolArgs || {},
                      status: 'running',
                    };
                    setToolCalls((prev) => [...prev, toolCall]);
                    onToolCall?.(toolCall);
                  }
                  // Backend format: { toolCall: { name, arguments }, savedPlanning?, toolCompleted? }
                  else if (backendEvent.toolCall) {
                    const toolName = backendEvent.toolCall.name;
                    const hasResult = !!backendEvent.savedPlanning;
                    const isCompleted = hasResult || backendEvent.toolCompleted;

                    if (isCompleted) {
                      // Update existing tool call to completed
                      const completedToolCall: ToolCall = {
                        name: toolName,
                        args: backendEvent.toolCall.arguments || {},
                        result: backendEvent.savedPlanning,
                        status: 'completed',
                      };
                      setToolCalls((prev) =>
                        prev.map((tc) => (tc.name === toolName ? completedToolCall : tc))
                      );
                      onToolCall?.(completedToolCall);
                    } else {
                      // Add new running tool call
                      const toolCall: ToolCall = {
                        name: toolName,
                        args: backendEvent.toolCall.arguments || {},
                        status: 'running',
                      };
                      setToolCalls((prev) => [...prev, toolCall]);
                      onToolCall?.(toolCall);
                    }
                  }
                  break;

                case 'tool_result':
                  if (event.data?.toolName) {
                    const toolName = event.data.toolName;
                    const toolResult = event.data.toolResult;
                    setToolCalls((prev) =>
                      prev.map((tc) =>
                        tc.name === toolName
                          ? { ...tc, result: toolResult, status: 'completed' }
                          : tc
                      )
                    );
                  }
                  break;

                case 'error':
                  setError(event.data?.error || backendEvent.error || 'Unknown error');
                  setStatus('error');
                  onError?.(event.data?.error || backendEvent.error || 'Unknown error');
                  break;

                case 'done':
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMessageId ? { ...m, isStreaming: false } : m
                    )
                  );
                  setToolCalls([]);
                  setStatus('idle');
                  onComplete?.();
                  break;
              }
            }
          }
        }

        // Finalize if stream ended without explicit done event
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantMessageId ? { ...m, isStreaming: false } : m))
        );
        setStatus('idle');
        currentAssistantMessageIdRef.current = null;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          // User aborted, mark message as not streaming
          if (currentAssistantMessageIdRef.current) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === currentAssistantMessageIdRef.current ? { ...m, isStreaming: false } : m
              )
            );
          }
          setStatus('idle');
          return;
        }

        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(errorMessage);
        setStatus('error');
        onError?.(errorMessage);
      } finally {
        abortControllerRef.current = null;
      }
    },
    [endpoint, headers, messages, status, onToolCall, onComplete, onError]
  );

  return {
    messages,
    status,
    error,
    toolCalls,
    sendMessage,
    clearMessages,
    abort,
  };
}
