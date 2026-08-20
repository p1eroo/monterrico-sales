import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  ArrowLeft,
  MoreVertical,
  Monitor,
  Paperclip,
  Smartphone,
  Star,
  X,
} from 'lucide-react';
import type { CampaignAttachment, CampaignRecipient } from '@/types';
import { GmailMessageBody } from '@/components/shared/GmailMessageBody';
import { SenderAvatar } from '@/components/shared/SenderAvatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const FROM_DISPLAY = 'Taxi Monterrico';
const FROM_EMAIL = 'monterrico@taximonterrico.info';
const FROM_HEADER = `${FROM_DISPLAY} <${FROM_EMAIL}>`;

export type CampaignGmailPreviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  device: 'desktop' | 'mobile';
  onDeviceChange: (device: 'desktop' | 'mobile') => void;
  subject: string;
  html: string;
  recipient?: CampaignRecipient | null;
  attachments?: CampaignAttachment[];
};

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function recipientLine(recipient?: CampaignRecipient | null) {
  const name = recipient?.name?.trim();
  const email = recipient?.email?.trim();
  if (name && email) return `para ${name} <${email}>`;
  if (email) return `para ${email}`;
  return 'para (sin destinatarios aún)';
}

function AttachmentStrip({ attachments }: { attachments?: CampaignAttachment[] }) {
  if (!attachments?.length) return null;
  return (
    <div className="mt-5 rounded-xl bg-[#f1f3f4] p-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-[#5f6368]">
        <Paperclip className="size-3.5" />
        {attachments.length} {attachments.length === 1 ? 'adjunto' : 'adjuntos'}
      </p>
      <div className="flex flex-wrap gap-2">
        {attachments.map((a) => (
          <div
            key={a.id}
            className="rounded-lg border border-[#e8eaed] bg-white px-3 py-2"
          >
            <p className="max-w-[180px] truncate text-sm font-medium">{a.fileName}</p>
            <p className="text-xs text-[#5f6368]">{formatBytes(a.sizeBytes)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function GmailWebPane({
  subject,
  html,
  recipient,
  attachments,
}: {
  subject: string;
  html: string;
  recipient?: CampaignRecipient | null;
  attachments?: CampaignAttachment[];
}) {
  const when = format(new Date(), "d MMM, HH:mm", { locale: es });

  return (
    <div className="min-h-full bg-white px-8 py-6 text-[#202124]">
      <h2 className="text-[22px] leading-tight font-normal tracking-tight text-[#1f1f1f]">
        {subject.trim() || '(Sin asunto)'}
      </h2>
      <div className="mt-5 flex items-start gap-3">
        <SenderAvatar from={FROM_HEADER} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-medium">{FROM_DISPLAY}</span>
            <span className="text-xs text-[#5f6368]">&lt;{FROM_EMAIL}&gt;</span>
          </div>
          <p className="mt-0.5 truncate text-xs text-[#5f6368]">
            {recipientLine(recipient)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-[#5f6368]">
          <span className="text-xs whitespace-nowrap">{when}</span>
          <Star className="size-4 opacity-35" />
        </div>
      </div>
      <div className="mt-6">
        {html.trim() ? (
          <GmailMessageBody
            bodyHtml={html}
            subject={subject}
            tone="canvas"
            contentAlign="start"
          />
        ) : (
          <p className="text-sm italic text-[#5f6368]">Sin contenido</p>
        )}
      </div>
      <AttachmentStrip attachments={attachments} />
    </div>
  );
}

function GmailMobilePane({
  subject,
  html,
  recipient,
  attachments,
}: {
  subject: string;
  html: string;
  recipient?: CampaignRecipient | null;
  attachments?: CampaignAttachment[];
}) {
  const when = format(new Date(), "d MMM", { locale: es });

  return (
    <div className="flex h-full min-h-0 flex-col bg-white text-[#202124]">
      <div className="flex shrink-0 items-center justify-between px-2 pt-9 pb-1">
        <span className="flex size-9 items-center justify-center text-[#5f6368]">
          <ArrowLeft className="size-5" />
        </span>
        <div className="flex items-center gap-1 text-[#5f6368]">
          <Star className="size-5 opacity-40" />
          <MoreVertical className="size-5" />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">
        <h2 className="text-[20px] leading-snug font-normal text-[#1f1f1f]">
          {subject.trim() || '(Sin asunto)'}
        </h2>
        <div className="mt-4 flex items-start gap-3">
          <SenderAvatar from={FROM_HEADER} className="size-9" />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-sm font-medium">{FROM_DISPLAY}</span>
              <span className="shrink-0 text-[11px] text-[#5f6368]">{when}</span>
            </div>
            <p className="truncate text-[11px] text-[#5f6368]">
              {recipientLine(recipient)}
            </p>
          </div>
        </div>
        <div className="mt-4">
          {html.trim() ? (
            <GmailMessageBody
              bodyHtml={html}
              subject={subject}
              tone="canvas"
              contentAlign="start"
            />
          ) : (
            <p className="text-sm italic text-[#5f6368]">Sin contenido</p>
          )}
        </div>
        <AttachmentStrip attachments={attachments} />
      </div>
    </div>
  );
}

function DeviceToggle({
  device,
  onDeviceChange,
}: {
  device: 'desktop' | 'mobile';
  onDeviceChange: (device: 'desktop' | 'mobile') => void;
}) {
  return (
    <div className="inline-flex rounded-full bg-muted p-1">
      <button
        type="button"
        onClick={() => onDeviceChange('desktop')}
        className={cn(
          'inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition-colors',
          device === 'desktop'
            ? 'bg-[#13944C] text-white shadow-sm'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <Monitor className="size-3.5" />
        Computadora
      </button>
      <button
        type="button"
        onClick={() => onDeviceChange('mobile')}
        className={cn(
          'inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition-colors',
          device === 'mobile'
            ? 'bg-[#13944C] text-white shadow-sm'
            : 'text-muted-foreground hover:text-foreground',
        )}
      >
        <Smartphone className="size-3.5" />
        Celular
      </button>
    </div>
  );
}

export function CampaignGmailPreviewDialog({
  open,
  onOpenChange,
  device,
  onDeviceChange,
  subject,
  html,
  recipient,
  attachments,
}: CampaignGmailPreviewDialogProps) {
  const isMobile = device === 'mobile';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          '!fixed z-[201] flex h-[min(90vh,880px)] max-h-[90vh] w-full flex-col gap-0 overflow-hidden rounded-3xl border border-border/60 bg-background p-0 shadow-xl',
          isMobile ? 'sm:max-w-[520px]' : 'sm:max-w-5xl',
        )}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 px-6 pt-6 pb-4">
          <DialogHeader className="gap-1 p-0 text-left">
            <DialogTitle className="text-xl font-bold tracking-tight">
              Vista previa
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              {isMobile
                ? 'Así se vería el correo en Gmail en un celular.'
                : 'Así se vería el correo en Gmail en una computadora.'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex shrink-0 items-center gap-2">
            <DeviceToggle device={device} onDeviceChange={onDeviceChange} />
            <DialogClose asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9 shrink-0 rounded-full bg-muted/70 text-muted-foreground shadow-none hover:bg-muted"
              >
                <X className="size-4" />
                <span className="sr-only">Cerrar</span>
              </Button>
            </DialogClose>
          </div>
        </div>

        <div
          className={cn(
            'min-h-0 flex-1 overflow-hidden',
            isMobile ? 'flex items-center justify-center bg-muted/50 px-6 pb-6' : 'bg-[#f6f8fc]',
          )}
        >
          {isMobile ? (
            <div className="flex h-full w-full items-center justify-center">
              <div className="aspect-[9/19.5] h-[min(100%,740px)] max-w-full">
                <div className="h-full rounded-[2.4rem] bg-[#1c1c1e] p-[10px] shadow-2xl ring-1 ring-black/20">
                  <div className="relative h-full overflow-hidden rounded-[1.85rem] bg-white">
                    <div className="pointer-events-none absolute top-2.5 left-1/2 z-20 h-[22px] w-[92px] -translate-x-1/2 rounded-full bg-black" />
                    <GmailMobilePane
                      subject={subject}
                      html={html}
                      recipient={recipient}
                      attachments={attachments}
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full overflow-y-auto">
              <GmailWebPane
                subject={subject}
                html={html}
                recipient={recipient}
                attachments={attachments}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
