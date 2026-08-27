import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import {
  Bold,
  Code,
  FileText,
  Image as ImageIcon,
  Info,
  Italic,
  MapPin,
  Minus,
  Plus,
  Smile,
  Strikethrough,
  Trash2,
  Loader2,
  Video,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  FormDialogField,
  FormDialogGrid,
  FormDialogShell,
  formDialogInputClass,
} from '@/components/ui/form-dialog';
import { cn } from '@/lib/utils';
import { PhonePreview } from './PhonePreview';
import {
  WHATSAPP_CATEGORY_META,
  extractWhatsAppPlaceholders,
  type WhatsAppHeaderMedia,
  type WhatsAppParameterFormat,
  type WhatsAppTemplate,
  type WhatsAppTemplateButton,
  type WhatsAppTemplateCategory,
} from './mockData';

const LANGUAGE_OPTIONS = [
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'Inglés' },
  { value: 'pt', label: 'Portugués' },
];

const QUICK_EMOJIS = ['😀', '👍', '🙏', '🎉', '🚕', '🔥', '✅', '👋', '💼', '📅', '🙌', '⭐'];

const HEADER_MAX = 60;
const BODY_MAX = 1024;
const FOOTER_MAX = 60;
const BODY_VAR_MAX = 10;

const HEADER_MEDIA_OPTIONS: { value: WhatsAppHeaderMedia; label: string; icon: typeof ImageIcon }[] = [
  { value: 'none', label: 'Ninguna', icon: Minus },
  { value: 'image', label: 'Imagen', icon: ImageIcon },
  { value: 'video', label: 'Video', icon: Video },
  { value: 'document', label: 'Documento', icon: FileText },
  { value: 'location', label: 'Ubicación', icon: MapPin },
];

const MEDIA_ACCEPT: Partial<Record<WhatsAppHeaderMedia, string>> = {
  image: 'image/jpeg,image/png,image/webp',
  video: 'video/mp4,video/3gpp',
  document: '.pdf,.doc,.docx,.xls,.xlsx',
};

const MEDIA_HINT: Partial<Record<WhatsAppHeaderMedia, string>> = {
  image: 'JPG o PNG. Meta lo usa como muestra para revisar la plantilla.',
  video: 'MP4. Meta lo usa como muestra para revisar la plantilla.',
  document: 'PDF u Office. Meta lo usa como muestra para revisar la plantilla.',
};

type DraftButton = { type: 'quick_reply' | 'url'; text: string; url: string };

const whiteFieldClass = cn(formDialogInputClass, '!bg-white dark:!bg-input/30');

function renderPreviewText(text: string): string {
  return text.replace(/\{\{([a-z][a-z0-9_]*|\d+)\}\}/gi, (_, key) => `«${key}»`);
}

function insertAt(
  value: string,
  setValue: (next: string) => void,
  ref: RefObject<HTMLInputElement | HTMLTextAreaElement | null>,
  insert: string,
  maxLen: number,
  caretFromInsertStart?: number,
) {
  const el = ref.current;
  const start = el?.selectionStart ?? value.length;
  const end = el?.selectionEnd ?? value.length;
  const next = `${value.slice(0, start)}${insert}${value.slice(end)}`.slice(0, maxLen);
  setValue(next);
  const pos = Math.min(start + (caretFromInsertStart ?? insert.length), next.length);
  requestAnimationFrame(() => {
    el?.focus();
    el?.setSelectionRange(pos, pos);
  });
}

function wrapSelection(
  value: string,
  setValue: (next: string) => void,
  ref: RefObject<HTMLTextAreaElement | null>,
  left: string,
  right: string,
  maxLen: number,
) {
  const el = ref.current;
  const start = el?.selectionStart ?? value.length;
  const end = el?.selectionEnd ?? value.length;
  const selected = value.slice(start, end);
  const wrapped = selected ? `${left}${selected}${right}` : `${left}${right}`;
  const next = `${value.slice(0, start)}${wrapped}${value.slice(end)}`.slice(0, maxLen);
  setValue(next);
  const caret = selected ? start + wrapped.length : start + left.length;
  requestAnimationFrame(() => {
    el?.focus();
    el?.setSelectionRange(caret, caret);
  });
}

function FieldHint({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex size-4 items-center justify-center text-muted-foreground hover:text-foreground"
          aria-label={text}
        >
          <Info className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="z-[220] max-w-xs text-xs" showArrow={false}>
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

function AddVariableControl({
  format,
  used,
  disabled,
  onInsert,
}: {
  format: WhatsAppParameterFormat;
  used: string[];
  disabled?: boolean;
  onInsert: (token: string, caretFromInsertStart?: number) => void;
}) {
  const insertVariable = () => {
    if (format === 'positional') {
      const nums = used.map((k) => Number(k)).filter((n) => Number.isFinite(n) && n > 0);
      const next = nums.length ? Math.max(...nums) + 1 : 1;
      onInsert(`{{${next}}}`);
      return;
    }
    onInsert('{{}}', 2);
  };

  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        disabled={disabled}
        onClick={insertVariable}
        className="inline-flex items-center gap-1 text-[13px] font-medium text-foreground disabled:opacity-40"
      >
        <Plus className="size-3.5" />
        Agregar variable
      </button>
      <FieldHint
        text={
          format === 'positional'
            ? 'Se inserta {{1}}, {{2}}… Meta las rellena en ese orden al enviar.'
            : 'Se inserta {{ }}. Escribe el nombre en minúsculas y guion bajo, como en Meta.'
        }
      />
    </span>
  );
}

export function CreateTemplateDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (template: WhatsAppTemplate) => void;
}) {
  const headerRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [category, setCategory] = useState<WhatsAppTemplateCategory>('marketing');
  const [language, setLanguage] = useState('es');
  const [parameterFormat, setParameterFormat] = useState<WhatsAppParameterFormat>('named');
  const [headerMedia, setHeaderMedia] = useState<WhatsAppHeaderMedia>('none');
  const [mediaSample, setMediaSample] = useState<{ name: string; url: string; kind: 'image' | 'video' | 'file' } | null>(
    null,
  );
  const [mediaDragOver, setMediaDragOver] = useState(false);
  const [header, setHeader] = useState('');
  const [body, setBody] = useState('');
  const [footer, setFooter] = useState('');
  const [buttons, setButtons] = useState<DraftButton[]>([]);
  const [saving, setSaving] = useState(false);

  const usedVars = useMemo(
    () => extractWhatsAppPlaceholders(header, body),
    [header, body],
  );
  const headerVars = useMemo(() => extractWhatsAppPlaceholders(header), [header]);
  const bodyVars = useMemo(() => extractWhatsAppPlaceholders(body), [body]);

  const addButton = () => {
    if (buttons.length >= 3) return;
    setButtons((prev) => [...prev, { type: 'quick_reply', text: '', url: '' }]);
  };
  const updateButton = (i: number, patch: Partial<DraftButton>) =>
    setButtons((prev) => prev.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  const removeButton = (i: number) => setButtons((prev) => prev.filter((_, idx) => idx !== i));

  const clearMediaSample = () => {
    setMediaSample((prev) => {
      if (prev?.url) URL.revokeObjectURL(prev.url);
      return null;
    });
    if (mediaInputRef.current) mediaInputRef.current.value = '';
  };

  const handleMediaFile = (file: File | undefined) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setMediaSample((prev) => {
      if (prev?.url) URL.revokeObjectURL(prev.url);
      const kind = file.type.startsWith('image/')
        ? 'image'
        : file.type.startsWith('video/')
          ? 'video'
          : 'file';
      return { name: file.name, url, kind };
    });
  };

  useEffect(() => {
    if (open) return;
    setName('');
    setCategory('marketing');
    setLanguage('es');
    setParameterFormat('named');
    setHeaderMedia('none');
    setHeader('');
    setBody('');
    setFooter('');
    setButtons([]);
    setSaving(false);
    setMediaDragOver(false);
    setMediaSample((prev) => {
      if (prev?.url) URL.revokeObjectURL(prev.url);
      return null;
    });
  }, [open]);

  const valid = name.trim().length > 0 && body.trim().length > 0;

  const handleCreate = () => {
    if (!valid) return;
    setSaving(true);
    const buttonsPayload: WhatsAppTemplateButton[] = buttons
      .filter((b) => b.text.trim())
      .map((b) =>
        b.type === 'url'
          ? { type: 'url' as const, text: b.text.trim(), url: b.url.trim() }
          : { type: 'quick_reply' as const, text: b.text.trim() },
      );
    const template: WhatsAppTemplate = {
      id: `tpl-local-${Date.now()}`,
      name: name.trim(),
      category,
      language,
      header: headerMedia === 'none' ? header.trim() || undefined : undefined,
      headerMedia,
      footer: footer.trim() || undefined,
      parameterFormat,
      body: body.trim(),
      sampleVariables: usedVars,
      status: 'pending',
      qualityRating: 'media',
      buttons: buttonsPayload,
      createdAt: new Date().toISOString().slice(0, 10),
    };
    window.setTimeout(() => {
      setSaving(false);
      onCreate(template);
      onOpenChange(false);
    }, 600);
  };

  return (
    <FormDialogShell
      open={open}
      onOpenChange={(v) => {
        if (!saving) onOpenChange(v);
      }}
      maxWidthClassName="sm:max-w-5xl"
      overlayClassName="z-[200] !bg-black/60"
      title="Crear plantilla WhatsApp"
      description="Se enviará a Meta para revisión. Las plantillas aprobadas pueden usarse en envíos masivos."
      bodyClassName="pb-6"
      footerClassName="border-t border-border/60"
      footer={
        <div className="flex flex-row justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-9 text-sm font-normal"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="h-9 text-sm font-normal shadow-md"
            onClick={handleCreate}
            disabled={saving || !valid}
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            {saving ? 'Enviando a Meta…' : 'Enviar a Meta'}
          </Button>
        </div>
      }
    >
      <div className="grid min-w-0 items-stretch gap-10 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-10">
          <FormDialogGrid className="gap-y-6 sm:grid-cols-2 sm:gap-x-5">
            <FormDialogField label="Nombre de la plantilla" required className="sm:col-span-2">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Promoción de bienvenida"
                className={whiteFieldClass}
              />
            </FormDialogField>
            <FormDialogField label="Categoría" required>
              <Select value={category} onValueChange={(v) => setCategory(v as WhatsAppTemplateCategory)}>
                <SelectTrigger className={whiteFieldClass}>
                  <SelectValue placeholder="Categoría" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(WHATSAPP_CATEGORY_META) as WhatsAppTemplateCategory[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {WHATSAPP_CATEGORY_META[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormDialogField>
            <FormDialogField label="Idioma" required>
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className={whiteFieldClass}>
                  <SelectValue placeholder="Idioma" />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormDialogField>
          </FormDialogGrid>

          <div className="space-y-8">
            <div>
              <p className="text-sm font-semibold">Contenido</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Encabezado, cuerpo y pie, como en Meta.
              </p>
            </div>

            <div className="grid grid-cols-1 items-start gap-y-6 sm:grid-cols-2 sm:gap-x-5">
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Tipo de variable</Label>
                  <FieldHint text="Nombre: {{nombre}}. Número: {{1}}, {{2}}. No se pueden mezclar en la misma plantilla." />
                </div>
                <Select
                  value={parameterFormat}
                  onValueChange={(v) => setParameterFormat(v as WhatsAppParameterFormat)}
                >
                  <SelectTrigger className={whiteFieldClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="named">Nombre</SelectItem>
                    <SelectItem value="positional">Número</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Muestra de contenido multimedia
                  </Label>
                  <FieldHint text="El encabezado puede ser texto o un archivo de muestra (imagen, video, documento o ubicación)." />
                </div>
                <Select
                  value={headerMedia}
                  onValueChange={(v) => {
                    const next = v as WhatsAppHeaderMedia;
                    setHeaderMedia(next);
                    if (next !== 'none') setHeader('');
                    clearMediaSample();
                  }}
                >
                  <SelectTrigger className={whiteFieldClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HEADER_MEDIA_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <span className="inline-flex items-center gap-2">
                          <opt.icon className="size-3.5 text-muted-foreground" />
                          {opt.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {headerMedia === 'none' ? (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">
                  Título <span className="font-normal text-muted-foreground/80">· Opcional</span>
                </Label>
                <div className="relative">
                  <Input
                    ref={headerRef}
                    value={header}
                    maxLength={HEADER_MAX}
                    onChange={(e) => setHeader(e.target.value.slice(0, HEADER_MAX))}
                    placeholder="Agrega un encabezado…"
                    className={cn(whiteFieldClass, 'pr-14')}
                  />
                  <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[11px] text-muted-foreground">
                    {header.length}/{HEADER_MAX}
                  </span>
                </div>
                <div className="flex justify-end">
                  <AddVariableControl
                    format={parameterFormat}
                    used={usedVars}
                    disabled={headerVars.length >= 1}
                    onInsert={(token, caret) => insertAt(header, setHeader, headerRef, token, HEADER_MAX, caret)}
                  />
                </div>
              </div>
            ) : headerMedia === 'location' ? (
              <p className="text-xs text-muted-foreground">
                El encabezado mostrará una ubicación de ejemplo en la vista previa.
              </p>
            ) : (
              <div className="space-y-1.5">
                <input
                  ref={mediaInputRef}
                  type="file"
                  accept={MEDIA_ACCEPT[headerMedia]}
                  className="hidden"
                  onChange={(e) => {
                    handleMediaFile(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setMediaDragOver(true);
                  }}
                  onDragLeave={() => setMediaDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setMediaDragOver(false);
                    handleMediaFile(e.dataTransfer.files?.[0]);
                  }}
                  className={cn(
                    'flex min-h-[92px] flex-col items-center justify-center rounded-lg border border-dashed px-4 py-5 text-center transition-colors',
                    mediaDragOver
                      ? 'border-[#13944C] bg-[#13944C]/5'
                      : 'border-border bg-muted/25',
                  )}
                >
                  {mediaSample ? (
                    <div className="flex w-full items-center gap-3 text-left">
                      {mediaSample.kind === 'image' ? (
                        <img
                          src={mediaSample.url}
                          alt=""
                          className="size-12 shrink-0 rounded-md object-cover"
                        />
                      ) : mediaSample.kind === 'video' ? (
                        <video src={mediaSample.url} className="size-12 shrink-0 rounded-md object-cover" muted />
                      ) : (
                        <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-background">
                          <FileText className="size-4 text-muted-foreground" />
                        </span>
                      )}
                      <span className="min-w-0 flex-1 truncate text-sm">{mediaSample.name}</span>
                      <button
                        type="button"
                        className="text-[13px] font-medium text-[#13944C] hover:underline"
                        onClick={() => mediaInputRef.current?.click()}
                      >
                        Cambiar
                      </button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 text-muted-foreground hover:text-destructive"
                        onClick={clearMediaSample}
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                  ) : (
                    <p className="text-sm text-foreground">
                      Arrastra y suelta un archivo para subirlo
                      <br />
                      <span className="text-muted-foreground">O </span>
                      <button
                        type="button"
                        className="font-medium text-[#1877F2] hover:underline"
                        onClick={() => mediaInputRef.current?.click()}
                      >
                        elige archivos de tu dispositivo
                      </button>
                    </p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{MEDIA_HINT[headerMedia]}</p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                Cuerpo <span className="text-destructive"> *</span>
              </Label>
              <div className="overflow-hidden rounded-lg border border-border !bg-white dark:!bg-input/30">
                <div className="relative">
                  <Textarea
                    ref={bodyRef}
                    value={body}
                    maxLength={BODY_MAX}
                    rows={7}
                    onChange={(e) => setBody(e.target.value.slice(0, BODY_MAX))}
                    placeholder={
                      parameterFormat === 'named'
                        ? 'Hola {{nombre}}, este es tu mensaje…'
                        : 'Hola {{1}}, este es tu mensaje…'
                    }
                    className="min-h-[10rem] resize-y rounded-none border-0 bg-transparent pt-8 shadow-none focus-visible:ring-0 dark:bg-transparent"
                  />
                  <span className="pointer-events-none absolute top-2 right-3 text-[11px] text-muted-foreground">
                    {body.length}/{BODY_MAX}
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t px-2 py-1.5">
                  <div className="flex items-center gap-0.5">
                    <Popover modal={false}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                          aria-label="Emoji"
                        >
                          <Smile className="size-4" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="z-[210] w-56 rounded-lg border-border/80 p-1.5 shadow-[0_4px_14px_rgba(15,23,42,0.08)]">
                        <div className="grid grid-cols-6 gap-1">
                          {QUICK_EMOJIS.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              className="flex size-8 items-center justify-center rounded-md text-base hover:bg-muted"
                              onClick={() => insertAt(body, setBody, bodyRef, emoji, BODY_MAX)}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                    <button
                      type="button"
                      className="inline-flex size-8 items-center justify-center rounded-md text-sm font-bold text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label="Negrita"
                      onClick={() => wrapSelection(body, setBody, bodyRef, '*', '*', BODY_MAX)}
                    >
                      <Bold className="size-4" />
                    </button>
                    <button
                      type="button"
                      className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label="Cursiva"
                      onClick={() => wrapSelection(body, setBody, bodyRef, '_', '_', BODY_MAX)}
                    >
                      <Italic className="size-4" />
                    </button>
                    <button
                      type="button"
                      className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label="Tachado"
                      onClick={() => wrapSelection(body, setBody, bodyRef, '~', '~', BODY_MAX)}
                    >
                      <Strikethrough className="size-4" />
                    </button>
                    <button
                      type="button"
                      className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label="Monoespaciado"
                      onClick={() => wrapSelection(body, setBody, bodyRef, '```', '```', BODY_MAX)}
                    >
                      <Code className="size-4" />
                    </button>
                  </div>
                  <AddVariableControl
                    format={parameterFormat}
                    used={usedVars}
                    disabled={bodyVars.length >= BODY_VAR_MAX}
                    onInsert={(token, caret) => insertAt(body, setBody, bodyRef, token, BODY_MAX, caret)}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                Pie de página <span className="font-normal text-muted-foreground/80">· Opcional</span>
              </Label>
              <div className="relative">
                <Input
                  value={footer}
                  maxLength={FOOTER_MAX}
                  onChange={(e) => setFooter(e.target.value.slice(0, FOOTER_MAX))}
                  placeholder="Agrega una breve línea de pie…"
                  className={cn(whiteFieldClass, 'pr-14')}
                />
                <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[11px] text-muted-foreground">
                  {footer.length}/{FOOTER_MAX}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-medium leading-none text-muted-foreground">
              Botones (opcional)
            </Label>
            {buttons.length === 0 ? (
              <button
                type="button"
                onClick={addButton}
                className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-dashed py-6 text-sm font-medium text-muted-foreground transition hover:border-foreground/30 hover:bg-muted/40 hover:text-foreground"
              >
                <Plus className="size-4" />
                Agregar botón
              </button>
            ) : (
              <div className="space-y-3">
                {buttons.map((b, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Select
                        value={b.type}
                        onValueChange={(v) => updateButton(i, { type: v as DraftButton['type'] })}
                      >
                        <SelectTrigger className="h-11 w-[170px] shrink-0">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="quick_reply">Respuesta rápida</SelectItem>
                          <SelectItem value="url">Enlace (URL)</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        value={b.text}
                        onChange={(e) => updateButton(i, { text: e.target.value })}
                        placeholder={b.type === 'url' ? 'Texto del botón' : 'Texto de la respuesta'}
                        className={whiteFieldClass}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-11 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => removeButton(i)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                    {b.type === 'url' && (
                      <Input
                        value={b.url}
                        onChange={(e) => updateButton(i, { url: e.target.value })}
                        placeholder="https://…"
                        className={whiteFieldClass}
                      />
                    )}
                  </div>
                ))}
                {buttons.length < 3 ? (
                  <button
                    type="button"
                    onClick={addButton}
                    className="inline-flex items-center gap-1 text-[13px] font-medium text-foreground"
                  >
                    <Plus className="size-3.5" />
                    Agregar botón
                  </button>
                ) : null}
              </div>
            )}
            {buttons.length === 0 ? (
              <p className="text-xs text-muted-foreground">Hasta 3: respuesta rápida o enlace.</p>
            ) : null}
          </div>
        </div>

        <div className="hidden min-w-0 lg:sticky lg:top-0 lg:flex lg:h-[calc(90vh-11rem)] lg:items-center">
          <div className="w-full">
            <PhonePreview
              senderName="Taxi Monterrico"
              contactName="Contacto"
              header={headerMedia === 'none' ? renderPreviewText(header) : undefined}
              headerMedia={headerMedia}
              headerMediaUrl={mediaSample?.url}
              body={renderPreviewText(body) || 'Escribe el mensaje para previsualizarlo…'}
              footer={footer}
              buttons={buttons}
              time="Ahora"
            />
          </div>
        </div>
      </div>
    </FormDialogShell>
  );
}
