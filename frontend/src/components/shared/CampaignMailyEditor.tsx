import '@maily-to/core/style.css';

import { useCallback, useEffect, useMemo } from 'react';
import type { Editor as TiptapEditor, JSONContent } from '@tiptap/core';
import { Editor, Toolbar } from '@maily-to/core';
import {
  ImageUploadExtension,
  VariableExtension,
} from '@maily-to/core/extensions';
import { render } from '@maily-to/render';
import { toast } from '@/lib/notify';

const MAX_INLINE_IMAGE_BYTES = 3 * 1024 * 1024;

const EMPTY_DOC: JSONContent = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
};

const BRAND = '#13944C';

const MAILY_THEME = {
  button: {
    backgroundColor: BRAND,
    color: '#ffffff',
  },
  link: {
    color: BRAND,
  },
  container: {
    backgroundColor: '#ffffff',
    maxWidth: 640,
    borderRadius: 0,
    borderWidth: 0,
    borderColor: 'transparent',
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 0,
    paddingLeft: 0,
  },
  body: {
    backgroundColor: '#ffffff',
    paddingTop: 4,
    paddingRight: 0,
    paddingBottom: 4,
    paddingLeft: 0,
  },
};

const MAIL_RENDER_CONFIG = {
  theme: {
    button: { backgroundColor: BRAND, color: '#ffffff' },
    link: { color: BRAND },
    container: {
      backgroundColor: '#ffffff',
      maxWidth: 640,
      paddingTop: 0,
      paddingRight: 0,
      paddingBottom: 0,
      paddingLeft: 0,
    },
    body: {
      backgroundColor: '#ffffff',
      paddingTop: 0,
      paddingRight: 0,
      paddingBottom: 0,
      paddingLeft: 0,
    },
    font: {
      fontFamily: 'Arial',
      fallbackFontFamily: 'Helvetica',
    },
  },
  variableFormatter: ({ variable }: { variable: string }) => `{{${variable}}}`,
};

/** El lienzo de Maily va centrado (600px). Lo pegamos a la izquierda como el editor. */
function leftAlignMailyLayout(html: string): string {
  return html.replace(/<table\b[^>]*>/gi, (tag) => {
    if (!/align=["']center["']/i.test(tag)) return tag;
    if (/max-width:\s*37\.5em/i.test(tag) || /text-align:\s*center/i.test(tag)) {
      return tag;
    }
    return tag.replace(/align=["']center["']/i, 'align="left"');
  });
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer la imagen'));
    reader.readAsDataURL(file);
  });
}

const MAILY_EXTENSIONS = [
  VariableExtension.configure({
    variables: [
      { id: 'nombre', required: false },
      { id: 'empresa', required: false },
      { id: 'email', required: false },
    ],
  }),
  ImageUploadExtension.configure({
    onImageUpload: async (file, context) => {
      if (file.size > MAX_INLINE_IMAGE_BYTES) {
        toast.error('La imagen supera 3 MB.');
        context.removeImage();
        throw new Error('too large');
      }
      return fileToDataUrl(file);
    },
    onImageUploadError: (_error, _file, context) => {
      toast.error('No se pudo insertar la imagen.');
      context.removeImage();
    },
  }),
];

export function insertMailyVariable(editor: TiptapEditor | null, id: string) {
  if (!editor) return;
  editor
    .chain()
    .focus()
    .insertContent({ type: 'variable', attrs: { id } })
    .run();
}

export async function renderCampaignMailyHtml(json: JSONContent): Promise<string> {
  const html = await render(json, MAIL_RENDER_CONFIG);
  return leftAlignMailyLayout(html);
}

function contentForMaily(
  html: string,
  json?: JSONContent | Record<string, unknown> | null,
): JSONContent | string {
  if (json && typeof json === 'object' && json.type === 'doc') {
    return json as JSONContent;
  }
  const t = html.trim();
  if (!t || t === '<p></p>') return EMPTY_DOC;
  if (/^<!DOCTYPE/i.test(t) || /<html[\s>]/i.test(t)) {
    const d = new DOMParser().parseFromString(t, 'text/html');
    const inner = d.body?.innerHTML?.trim();
    return inner || EMPTY_DOC;
  }
  return t;
}

export type CampaignMailyEditorProps = {
  initialHtml: string;
  initialJson?: JSONContent | Record<string, unknown> | null;
  resetKey: number;
  onChange: (html: string, json: JSONContent) => void;
  onEditorReady?: (editor: TiptapEditor | null) => void;
};

export function CampaignMailyEditor({
  initialHtml,
  initialJson,
  resetKey,
  onChange,
  onEditorReady,
}: CampaignMailyEditorProps) {
  const content = useMemo(
    () => contentForMaily(initialHtml, initialJson),
    // Solo al montar o al cambiar resetKey (plantilla / borrador).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [resetKey],
  );

  const emit = useCallback(
    async (editor: TiptapEditor) => {
      const json = editor.getJSON();
      try {
        const html = leftAlignMailyLayout(await render(json, MAIL_RENDER_CONFIG));
        onChange(html, json);
      } catch {
        onChange(editor.getHTML(), json);
      }
    },
    [onChange],
  );

  useEffect(() => {
    return () => onEditorReady?.(null);
  }, [onEditorReady]);

  return (
    <div key={resetKey} className="campaign-maily-editor">
      <Editor.Root
        content={content}
        immediatelyRender={false}
        autofocus={false}
        theme={MAILY_THEME}
        extensions={MAILY_EXTENSIONS}
        onCreate={({ editor }) => {
          onEditorReady?.(editor);
          void emit(editor);
        }}
        onUpdate={({ editor }) => {
          void emit(editor);
        }}
      >
        <Toolbar.Root>
          <Toolbar.CommonActions />
        </Toolbar.Root>
        <Editor.Frame>
          <Editor.Content />
        </Editor.Frame>
      </Editor.Root>
    </div>
  );
}
