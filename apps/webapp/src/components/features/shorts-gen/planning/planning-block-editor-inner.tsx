'use client';

import type { Block } from '@blocknote/core';
import { useCreateBlockNote } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/shadcn';
import { useCallback, useEffect, useRef } from 'react';

interface BlockNoteEditorInnerProps {
  initialContent: string;
  onChange: (markdown: string) => void;
}

async function parseMarkdownToBlocks(
  editor: ReturnType<typeof useCreateBlockNote>,
  markdown: string
): Promise<Block[]> {
  try {
    const blocks = await editor.tryParseMarkdownToBlocks(markdown);
    return blocks;
  } catch {
    return [
      {
        id: 'default',
        type: 'paragraph',
        props: {
          textColor: 'default',
          backgroundColor: 'default',
          textAlignment: 'left',
        },
        content: [{ type: 'text', text: markdown, styles: {} }],
        children: [],
      },
    ];
  }
}

export function BlockNoteEditorInner({ initialContent, onChange }: BlockNoteEditorInnerProps) {
  const editor = useCreateBlockNote();
  const initializedRef = useRef(false);
  const initialContentRef = useRef(initialContent);

  useEffect(() => {
    if (!initializedRef.current && editor) {
      initializedRef.current = true;
      parseMarkdownToBlocks(editor, initialContentRef.current).then((blocks) => {
        editor.replaceBlocks(editor.document, blocks);
      });
    }
  }, [editor]);

  useEffect(() => {
    if (initialContent !== initialContentRef.current && editor) {
      initialContentRef.current = initialContent;
      parseMarkdownToBlocks(editor, initialContent).then((blocks) => {
        editor.replaceBlocks(editor.document, blocks);
      });
    }
  }, [initialContent, editor]);

  const handleChange = useCallback(async () => {
    const markdown = await editor.blocksToMarkdownLossy(editor.document);
    onChange(markdown);
  }, [editor, onChange]);

  return (
    <BlockNoteView
      editor={editor}
      onChange={handleChange}
      theme="light"
      data-theming-css-variables-demo
    />
  );
}
