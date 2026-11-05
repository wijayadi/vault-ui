import { useEffect, useRef } from 'react';
import { createJSONEditor } from 'vanilla-jsoneditor';
import Box from '@mui/material/Box';

type EditorInstance = ReturnType<typeof createJSONEditor>;
type ChangeContent = { json: unknown } | { text: string };
type ChangeStatus = { contentErrors?: unknown };

export interface JsonEditorProps {
  value: unknown;
  onChange?: (value: unknown, valid: boolean) => void;
  readOnly?: boolean;
  mode?: 'tree' | 'text' | 'table';
  height?: number | string;
  dark?: boolean;
}

/**
 * Thin React wrapper around vanilla-jsoneditor. It is created imperatively so
 * the editor keeps its own undo history and selection while React owns the
 * surrounding layout.
 */
export function JsonEditor({
  value,
  onChange,
  readOnly = false,
  mode = 'tree',
  height = 360,
  dark = false,
}: JsonEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<EditorInstance | null>(null);
  const lastValueRef = useRef<string>('');
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const target = containerRef.current;
    if (!target) return;
    lastValueRef.current = JSON.stringify(value ?? null);

    const editor = createJSONEditor({
      target,
      props: {
        content: { json: value ?? {} },
        mode,
        readOnly,
        mainMenuBar: !readOnly,
        navigationBar: true,
        statusBar: true,
        onChange: (content: ChangeContent, _previous: ChangeContent, status: ChangeStatus) => {
          if (!('json' in content)) {
            onChangeRef.current?.(null, false);
            return;
          }
          const valid = !status.contentErrors;
          lastValueRef.current = JSON.stringify(content.json ?? null);
          onChangeRef.current?.(content.json, valid);
        },
      },
    });
    editorRef.current = editor;

    return () => {
      void editor.destroy();
      editorRef.current = null;
      // StrictMode mounts effects twice in development; make sure a stale
      // editor does not leave duplicate DOM behind.
      target.replaceChildren();
    };
    // The editor is intentionally created once. Prop changes are applied below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const serialized = JSON.stringify(value ?? null);
    if (serialized === lastValueRef.current) return;
    lastValueRef.current = serialized;
    editorRef.current?.update({ json: value ?? {} });
  }, [value]);

  useEffect(() => {
    editorRef.current?.updateProps({ mode: mode as never, readOnly });
  }, [mode, readOnly]);

  return (
    <Box
      ref={containerRef}
      className={dark ? 'jse-theme-dark' : undefined}
      sx={{
        height,
        width: '100%',
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        overflow: 'hidden',
        '& .jse-main': { minHeight: '100%' },
      }}
    />
  );
}
