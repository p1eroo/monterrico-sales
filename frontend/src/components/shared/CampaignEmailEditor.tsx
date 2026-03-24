import { useRef, useState, type ChangeEvent } from 'react';
import type { Editor } from '@tiptap/core';
import { Color } from '@tiptap/extension-color';
import { Highlight } from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import { TextAlign } from '@tiptap/extension-text-align';
import { TextStyle, FontSize } from '@tiptap/extension-text-style';
import Placeholder from '@tiptap/extension-placeholder';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Image as ImageIcon,
  Italic,
  Link2,
  List,
  ListOrdered,
  RemoveFormatting,
  Strikethrough,
  Underline,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

/** Imágenes incrustadas como data URL en el HTML del correo (sin servidor de subida) */
const MAX_INLINE_IMAGE_BYTES = 3 * 1024 * 1024;

const FONT_SIZE_OPTIONS: { value: string; label: string }[] = [
  { value: 'default', label: 'Predeterminado' },
  { value: '12px', label: '12 px' },
  { value: '14px', label: '14 px' },
  { value: '16px', label: '16 px' },
  { value: '18px', label: '18 px' },
  { value: '20px', label: '20 px' },
  { value: '22px', label: '22 px' },
  { value: '24px', label: '24 px' },
  { value: '28px', label: '28 px' },
  { value: '32px', label: '32 px' },
  { value: '36px', label: '36 px' },
];

type LinkDialogState = {
  value: string;
  /** Rango al abrir el diálogo: al enfocar el modal el editor pierde la selección */
  from: number;
  to: number;
};

function Toolbar({ editor }: { editor: Editor | null }) {
  const [linkDialog, setLinkDialog] = useState<LinkDialogState | null>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const imageInsertAtRef = useRef(0);
  const imageFileInputRef = useRef<HTMLInputElement>(null);

  const snap = useEditorState({
    editor,
    selector: ({ editor: ed }) => {
      if (!ed) return null;
      return {
        bold: ed.isActive('bold'),
        italic: ed.isActive('italic'),
        strike: ed.isActive('strike'),
        underline: ed.isActive('underline'),
        bullet: ed.isActive('bulletList'),
        ordered: ed.isActive('orderedList'),
        alignLeft: ed.isActive({ textAlign: 'left' }),
        alignCenter: ed.isActive({ textAlign: 'center' }),
        alignRight: ed.isActive({ textAlign: 'right' }),
        link: ed.isActive('link'),
        fontSize:
          (ed.getAttributes('textStyle').fontSize as string | undefined) || 'default',
      };
    },
  });

  if (!editor || !snap) return null;

  const setFontSize = (v: string) => {
    if (v === 'default') {
      editor.chain().focus().unsetFontSize().run();
    } else {
      editor.chain().focus().setFontSize(v).run();
    }
  };

  const fontSizeRaw = snap.fontSize === 'default' ? '' : snap.fontSize;
  const sizeMenuOptions =
    fontSizeRaw &&
    !FONT_SIZE_OPTIONS.some((o) => o.value === fontSizeRaw)
      ? [...FONT_SIZE_OPTIONS, { value: fontSizeRaw, label: fontSizeRaw }]
      : FONT_SIZE_OPTIONS;
  const fontSizeValue = fontSizeRaw || 'default';

  const openLinkDialog = () => {
    const { from, to } = editor.state.selection;
    const prev = editor.getAttributes('link').href as string | undefined;
    setLinkDialog({
      value: prev ?? 'https://',
      from,
      to,
    });
  };

  const openImageFilePicker = () => {
    imageInsertAtRef.current = editor.state.selection.from;
    imageFileInputRef.current?.click();
  };

  const handleImageFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Elige un archivo de imagen (PNG, JPEG, GIF, WebP…).');
      return;
    }
    if (file.size > MAX_INLINE_IMAGE_BYTES) {
      toast.error('La imagen no puede superar 3 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const src = reader.result as string;
      if (!src) return;
      editor
        .chain()
        .focus()
        .setTextSelection(imageInsertAtRef.current)
        .setImage({ src })
        .run();
    };
    reader.onerror = () => {
      toast.error('No se pudo leer la imagen.');
    };
    reader.readAsDataURL(file);
  };

  const closeLinkDialog = () => setLinkDialog(null);

  const confirmLinkDialog = () => {
    if (!linkDialog) return;
    const v = linkDialog.value.trim();
    const { from, to } = linkDialog;
    if (v === '') {
      editor
        .chain()
        .focus()
        .setTextSelection({ from, to })
        .extendMarkRange('link')
        .unsetLink()
        .run();
    } else {
      editor
        .chain()
        .focus()
        .setTextSelection({ from, to })
        .extendMarkRange('link')
        .setLink({ href: v })
        .run();
    }
    closeLinkDialog();
  };

  return (
    <>
    <div
      className="flex flex-wrap items-center gap-0.5 rounded-t-md border border-b-0 bg-muted/50 px-1 py-1"
      onMouseDown={(e) => e.preventDefault()}
    >
      <Select value={fontSizeValue} onValueChange={setFontSize}>
        <SelectTrigger className="h-8 w-[118px] border-0 bg-transparent text-xs shadow-none">
          <SelectValue placeholder="Tamaño" />
        </SelectTrigger>
        <SelectContent>
          {sizeMenuOptions.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Separator orientation="vertical" className="mx-0.5 h-6" />

      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        className={cn(snap.bold && 'bg-muted')}
        onClick={() => editor.chain().focus().toggleBold().run()}
        aria-label="Negrita"
      >
        <Bold className="size-4" />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        className={cn(snap.italic && 'bg-muted')}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        aria-label="Cursiva"
      >
        <Italic className="size-4" />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        className={cn(snap.underline && 'bg-muted')}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        aria-label="Subrayado"
      >
        <Underline className="size-4" />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        className={cn(snap.strike && 'bg-muted')}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        aria-label="Tachado"
      >
        <Strikethrough className="size-4" />
      </Button>

      <label className="inline-flex size-8 cursor-pointer items-center justify-center rounded-md hover:bg-muted">
        <span className="sr-only">Color de texto</span>
        <input
          type="color"
          className="size-5 cursor-pointer border-0 bg-transparent p-0"
          title="Color de texto"
          onInput={(e) => {
            const v = (e.target as HTMLInputElement).value;
            editor.chain().focus().setColor(v).run();
          }}
        />
      </label>
      <label className="inline-flex size-8 cursor-pointer items-center justify-center rounded-md hover:bg-muted">
        <span className="sr-only">Resaltar</span>
        <input
          type="color"
          className="size-5 cursor-pointer border-0 bg-transparent p-0"
          title="Resaltar"
          defaultValue="#fef08a"
          onInput={(e) => {
            const v = (e.target as HTMLInputElement).value;
            editor.chain().focus().setHighlight({ color: v }).run();
          }}
        />
      </label>

      <Separator orientation="vertical" className="mx-0.5 h-6" />

      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        className={cn(snap.ordered && 'bg-muted')}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        aria-label="Lista numerada"
      >
        <ListOrdered className="size-4" />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        className={cn(snap.bullet && 'bg-muted')}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        aria-label="Lista con viñetas"
      >
        <List className="size-4" />
      </Button>

      <Separator orientation="vertical" className="mx-0.5 h-6" />

      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        className={cn(snap.alignLeft && 'bg-muted')}
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        aria-label="Alinear izquierda"
      >
        <AlignLeft className="size-4" />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        className={cn(snap.alignCenter && 'bg-muted')}
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        aria-label="Centrar"
      >
        <AlignCenter className="size-4" />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        className={cn(snap.alignRight && 'bg-muted')}
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
        aria-label="Alinear derecha"
      >
        <AlignRight className="size-4" />
      </Button>

      <Separator orientation="vertical" className="mx-0.5 h-6" />

      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        className={cn(snap.link && 'bg-muted')}
        onClick={openLinkDialog}
        aria-label="Enlace"
      >
        <Link2 className="size-4" />
      </Button>
      <input
        ref={imageFileInputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={handleImageFileChange}
      />
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        onClick={openImageFilePicker}
        aria-label="Insertar imagen"
        title="Insertar imagen desde tu equipo"
      >
        <ImageIcon className="size-4" />
      </Button>

      <Separator orientation="vertical" className="mx-0.5 h-6" />

      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
        aria-label="Quitar formato"
        title="Quitar formato"
      >
        <RemoveFormatting className="size-4" />
      </Button>
    </div>

    <Dialog
      open={linkDialog !== null}
      onOpenChange={(open) => {
        if (!open) closeLinkDialog();
      }}
    >
      <DialogContent
        className="sm:max-w-md"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          urlInputRef.current?.focus();
          urlInputRef.current?.select();
        }}
      >
        {linkDialog ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              confirmLinkDialog();
            }}
          >
            <DialogHeader>
              <DialogTitle>Enlace</DialogTitle>
              <DialogDescription>
                Escribe o pega la URL. Si la dejas vacía y aceptas, se quita el enlace del texto
                seleccionado.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-2 py-2">
              <Label htmlFor="campaign-editor-url-input">URL del enlace</Label>
              <Input
                ref={urlInputRef}
                id="campaign-editor-url-input"
                type="url"
                inputMode="url"
                autoComplete="url"
                placeholder="https://"
                value={linkDialog.value}
                onChange={(e) => setLinkDialog({ ...linkDialog, value: e.target.value })}
                className="font-mono text-sm"
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={closeLinkDialog}>
                Cancelar
              </Button>
              <Button type="submit">Aplicar</Button>
            </DialogFooter>
          </form>
        ) : null}
      </DialogContent>
    </Dialog>
    </>
  );
}

export type CampaignEmailEditorProps = {
  /** HTML inicial; al cambiar `resetKey` se recrea el editor con este contenido */
  initialHtml: string;
  onChange: (html: string) => void;
  resetKey: number;
  placeholder?: string;
};

export function CampaignEmailEditor({
  initialHtml,
  onChange,
  resetKey,
  placeholder = 'Escribe tu mensaje. Usa {{nombre}} para personalizar.',
}: CampaignEmailEditorProps) {
  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({
          heading: false,
          link: {
            openOnClick: false,
            autolink: true,
            HTMLAttributes: {
              class: 'text-[#13944C] underline underline-offset-2',
            },
          },
        }),
        TextAlign.configure({
          types: ['paragraph'],
        }),
        TextStyle,
        FontSize,
        Color,
        Highlight.configure({ multicolor: true }),
        Image.configure({
          inline: true,
          allowBase64: true,
          HTMLAttributes: {
            // Sin h-auto: si no, el CSS anula height al redimensionar
            class: 'max-w-full rounded-md my-2 align-middle',
          },
          resize: {
            enabled: true,
            minWidth: 48,
            minHeight: 48,
            alwaysPreserveAspectRatio: true,
          },
        }),
        Placeholder.configure({
          placeholder,
        }),
      ],
      content: initialHtml?.trim() ? initialHtml : '<p></p>',
      editorProps: {
        attributes: {
          class: cn(
            'tiptap max-w-none min-h-[260px] px-3 py-2 text-sm leading-relaxed',
            'focus:outline-none',
            '[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5',
            '[&_blockquote]:border-l-2 [&_blockquote]:border-muted-foreground/30 [&_blockquote]:pl-3 [&_blockquote]:italic',
          ),
        },
      },
      onUpdate: ({ editor: ed }) => onChange(ed.getHTML()),
    },
    [resetKey],
  );

  return (
    <div className="campaign-email-editor rounded-md border bg-background shadow-sm focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 ring-offset-background">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} className="campaign-email-editor-content" />
    </div>
  );
}
