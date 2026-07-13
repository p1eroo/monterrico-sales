import type { DragEvent, ReactNode } from 'react';
import type { Editor } from '@tiptap/core';
import {
  ChevronDown,
  ImagePlus,
  Loader2,
  Maximize2,
  Paperclip,
  Send,
  Signature,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmailRecipientsInput } from '@/components/shared/EmailRecipientsInput';
import { CampaignEmailEditor } from '@/components/shared/CampaignEmailEditor';
import { cn } from '@/lib/utils';

function formatComposeFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) {
    const kb = Math.round(bytes / 1024);
    return `${kb.toLocaleString('es-PE')} K`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export type ComposeEmailPanelProps = {
  minimized?: boolean;
  fullscreen?: boolean;
  subject: string;
  onSubjectChange: (value: string) => void;
  to: string;
  onToChange: (value: string) => void;
  cc: string;
  onCcChange: (value: string) => void;
  bcc: string;
  onBccChange: (value: string) => void;
  showCc: boolean;
  showBcc: boolean;
  onShowCc: () => void;
  onShowBcc: () => void;
  bodyHtml: string;
  onBodyChange: (html: string) => void;
  bodyResetKey: number;
  onEditorReady?: (editor: Editor | null) => void;
  attachments: File[];
  onRemoveAttachment: (index: number) => void;
  onAttachClick: () => void;
  onInsertSignature: () => void;
  onInsertInlineImage?: () => void;
  sending: boolean;
  onSend: () => void;
  onClose: () => void;
  onToggleMinimized?: () => void;
  onToggleFullscreen?: () => void;
  dragOver?: boolean;
  dropOverlay?: ReactNode;
  onDragEnter?: (e: DragEvent) => void;
  onDragLeave?: (e: DragEvent) => void;
  onDragOver?: (e: DragEvent) => void;
  onDrop?: (e: DragEvent) => void;
};

export function ComposeEmailPanel({
  minimized = false,
  fullscreen = false,
  subject,
  onSubjectChange,
  to,
  onToChange,
  cc,
  onCcChange,
  bcc,
  onBccChange,
  showCc,
  showBcc,
  onShowCc,
  onShowBcc,
  bodyHtml,
  onBodyChange,
  bodyResetKey,
  onEditorReady,
  attachments,
  onRemoveAttachment,
  onAttachClick,
  onInsertSignature,
  onInsertInlineImage,
  sending,
  onSend,
  onClose,
  onToggleMinimized,
  onToggleFullscreen,
  dragOver,
  dropOverlay,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
}: ComposeEmailPanelProps) {
  const attachmentsPreview =
    attachments.length > 0 ? (
      <div className="shrink-0 divide-y border-t bg-muted/30">
        {attachments.map((file, i) => (
          <div key={`${file.name}-${file.size}-${i}`} className="flex items-center gap-2 px-4 py-2">
            <Paperclip className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate text-sm text-[#0b57d0] dark:text-[#8ab4f8]">
              {file.name}
              <span className="text-muted-foreground"> ({formatComposeFileSize(file.size)})</span>
            </span>
            <button
              type="button"
              className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Quitar adjunto"
              onClick={() => onRemoveAttachment(i)}
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    ) : null;

  const header = (
    <div
      className={cn(
        'flex shrink-0 items-center justify-between px-4 py-2.5',
        minimized ? 'rounded-lg' : 'rounded-t-lg border-b border-border/80',
      )}
    >
      <span className="text-sm font-semibold text-foreground">
        {minimized ? subject || 'Nuevo mensaje' : 'Nuevo mensaje'}
      </span>
      <div className="flex items-center gap-0.5">
        {onToggleFullscreen ? (
          <button
            type="button"
            onClick={onToggleFullscreen}
            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title={fullscreen ? 'Vista flotante' : 'Pantalla completa'}
          >
            {fullscreen ? <ChevronDown className="size-3.5" /> : <Maximize2 className="size-3.5" />}
          </button>
        ) : null}
        {onToggleMinimized ? (
          <button
            type="button"
            onClick={onToggleMinimized}
            className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title={minimized ? 'Maximizar' : 'Minimizar'}
          >
            <ChevronDown className={cn('size-3.5 transition-transform', minimized && 'rotate-180')} />
          </button>
        ) : null}
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title="Cerrar"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  );

  const body = !minimized ? (
    <div
      className="relative flex min-h-0 flex-1 flex-col"
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {dropOverlay}

      <div className="shrink-0 border-b border-border/80">
        <div className="flex items-center gap-2 px-4 py-2">
          <span className="w-14 shrink-0 text-sm text-muted-foreground">Para</span>
          <div className="min-w-0 flex-1">
            <EmailRecipientsInput value={to} onChange={onToChange} />
          </div>
          {!showCc || !showBcc ? (
            <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
              {!showCc ? (
                <button type="button" onClick={onShowCc} className="hover:text-foreground hover:underline">
                  Cc
                </button>
              ) : null}
              {!showBcc ? (
                <button type="button" onClick={onShowBcc} className="hover:text-foreground hover:underline">
                  Cco
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        {showCc ? (
          <div className="flex items-center gap-2 border-t border-border/60 px-4 py-2">
            <span className="w-14 shrink-0 text-sm text-muted-foreground">Cc</span>
            <input
              className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
              placeholder="Cc"
              value={cc}
              onChange={(e) => onCcChange(e.target.value)}
            />
          </div>
        ) : null}

        {showBcc ? (
          <div className="flex items-center gap-2 border-t border-border/60 px-4 py-2">
            <span className="w-14 shrink-0 text-sm text-muted-foreground">Cco</span>
            <input
              className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
              placeholder="Cco"
              value={bcc}
              onChange={(e) => onBccChange(e.target.value)}
            />
          </div>
        ) : null}

        <div className="flex items-center gap-2 border-t border-border/60 px-4 py-2">
          <span className="w-14 shrink-0 text-sm text-muted-foreground">Asunto</span>
          <input
            className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50"
            placeholder="Asunto"
            value={subject}
            onChange={(e) => onSubjectChange(e.target.value)}
          />
        </div>
      </div>

      <div
        className={cn(
          'flex min-h-0 flex-1 flex-col overflow-y-auto bg-muted/20',
          '[&_.campaign-email-editor]:flex [&_.campaign-email-editor]:min-h-0 [&_.campaign-email-editor]:flex-1 [&_.campaign-email-editor]:flex-col',
          '[&_.campaign-email-editor-content]:min-h-0 [&_.campaign-email-editor-content]:flex-1',
          '[&_.tiptap]:min-h-[220px]',
          dragOver && 'bg-primary/5',
        )}
      >
        <CampaignEmailEditor
          initialHtml={bodyHtml}
          onChange={onBodyChange}
          resetKey={bodyResetKey}
          placeholder="Escribe tu mensaje..."
          compact
          bordered={false}
          onEditorReady={onEditorReady}
        />
      </div>

      {attachmentsPreview}

      <div className="flex shrink-0 items-center justify-between border-t border-border/80 px-4 py-3">
        <div className="flex items-center gap-1">
          {onInsertInlineImage ? (
            <button
              type="button"
              className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              title="Insertar imagen"
              onClick={onInsertInlineImage}
            >
              <ImagePlus className="size-4" />
            </button>
          ) : null}
          <button
            type="button"
            className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Adjuntar archivos"
            onClick={onAttachClick}
          >
            <Paperclip className="size-4" />
          </button>
          <button
            type="button"
            className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Insertar firma"
            onClick={onInsertSignature}
          >
            <Signature className="size-4" />
          </button>
        </div>

        <Button
          className="h-9 gap-2 rounded-md bg-[#13944C] px-5 hover:bg-[#0f7a3d]"
          disabled={sending}
          onClick={onSend}
        >
          {sending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Enviando…
            </>
          ) : (
            <>
              Enviar
              <Send className="size-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  ) : null;

  return (
    <div
      className={cn(
        'flex min-h-0 flex-1 flex-col overflow-hidden bg-card',
        fullscreen && 'h-full rounded-xl border border-border shadow-2xl',
      )}
    >
      {header}
      {body}
    </div>
  );
}
