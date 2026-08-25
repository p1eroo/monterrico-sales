import type { ReactNode } from 'react';
import { FileText, Image as ImageIcon, MapPin, Play } from 'lucide-react';
import type { WhatsAppHeaderMedia } from './mockData';

type PhonePreviewProps = {
  senderName: string;
  body: string;
  header?: string;
  footer?: string;
  headerMedia?: WhatsAppHeaderMedia;
  headerMediaUrl?: string;
  contactName: string;
  read?: boolean;
  time?: string;
  buttons?: { text: string }[];
  showIncomingReply?: boolean;
};

function VariableChip({ label }: { label: string }) {
  return (
    <span className="mx-0.5 inline-flex translate-y-px items-center rounded-md bg-emerald-50 px-1 py-px text-[11px] font-semibold tracking-wide text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
      {label}
    </span>
  );
}

function renderFormattedPlain(text: string, keyPrefix: string) {
  const re = /```([\s\S]+?)```|\*(?!\s)([^*\n]+?)\*|_(?!\s)([^_\n]+?)_|~(?!\s)([^~\n]+?)~/g;
  const nodes: ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = re.exec(text))) {
    if (match.index > last) {
      nodes.push(<span key={`${keyPrefix}-t${i++}`}>{text.slice(last, match.index)}</span>);
    }
    if (match[1] != null) {
      nodes.push(
        <code
          key={`${keyPrefix}-c${i++}`}
          className="rounded-sm bg-black/8 px-0.5 font-mono text-[11px] dark:bg-white/10"
        >
          {match[1]}
        </code>,
      );
    } else if (match[2] != null) {
      nodes.push(<strong key={`${keyPrefix}-b${i++}`}>{match[2]}</strong>);
    } else if (match[3] != null) {
      nodes.push(<em key={`${keyPrefix}-i${i++}`}>{match[3]}</em>);
    } else if (match[4] != null) {
      nodes.push(<s key={`${keyPrefix}-s${i++}`}>{match[4]}</s>);
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) {
    nodes.push(<span key={`${keyPrefix}-t${i++}`}>{text.slice(last)}</span>);
  }
  return nodes;
}

function renderWhatsAppText(text: string): ReactNode[] {
  const parts = text.split(/(«[^»]+»|\{\{[a-zA-Z0-9_]+\}\})/g);
  const out: ReactNode[] = [];
  for (const part of parts) {
    if (!part) continue;
    if (/^(«[^»]+»|\{\{[a-zA-Z0-9_]+\}\})$/.test(part)) {
      out.push(<VariableChip key={`v${out.length}`} label={part.replace(/[«»{}]/g, '')} />);
    } else {
      out.push(...renderFormattedPlain(part, `p${out.length}`));
    }
  }
  return out;
}

function HeaderMediaBlock({ type, url }: { type: WhatsAppHeaderMedia; url?: string }) {
  if (type === 'none') return null;
  if (type === 'image' && url) {
    return <img src={url} alt="" className="h-[140px] w-full object-cover" />;
  }
  if (type === 'video' && url) {
    return (
      <div className="relative">
        <video src={url} className="h-[140px] w-full object-cover" muted playsInline />
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-white/90 dark:bg-white/85">
            <Play className="size-5 fill-[#54656f] text-[#54656f]" />
          </span>
        </span>
      </div>
    );
  }
  if (type === 'location') {
    return (
      <div className="flex h-[92px] items-center justify-center gap-1.5 bg-[#d1d7db] text-[12px] font-medium text-[#54656f] dark:bg-[#2a3942] dark:text-[#8696a0]">
        <MapPin className="size-4" />
        Ubicación
      </div>
    );
  }
  if (type === 'document') {
    return (
      <div className="flex h-[72px] items-center gap-2 bg-[#f0f2f5] px-3 text-[12px] font-medium text-[#111b21] dark:bg-[#2a3942] dark:text-[#e9edef]">
        <FileText className="size-5 text-[#54656f] dark:text-[#8696a0]" />
        Documento
      </div>
    );
  }
  return (
    <div className="relative flex h-[140px] items-center justify-center bg-[#3b3b3b]">
      {type === 'video' ? (
        <span className="flex size-12 items-center justify-center rounded-full bg-white/90">
          <Play className="size-5 fill-[#54656f] text-[#54656f]" />
        </span>
      ) : (
        <ImageIcon className="size-8 text-white/50" />
      )}
    </div>
  );
}

export function PhonePreview({
  body,
  header,
  footer,
  headerMedia = 'none',
  headerMediaUrl,
  time,
  buttons = [],
}: PhonePreviewProps) {
  const visibleButtons = buttons.filter((button) => button.text.trim().length > 0);

  return (
    <div className="min-h-[280px] overflow-hidden rounded-xl bg-[#ece5dd] px-3 py-4 [background-image:radial-gradient(rgba(0,0,0,0.04)_0.7px,transparent_0.7px)] [background-size:12px_12px] dark:bg-[#0b141a] dark:[background-image:radial-gradient(rgba(255,255,255,0.055)_0.7px,transparent_0.7px)]">
      <div className="flex justify-start">
        <div className="w-[92%] overflow-hidden rounded-lg rounded-tl-sm bg-white shadow-[0_1px_2px_rgba(11,20,26,0.13)] dark:bg-[#202c33] dark:shadow-[0_1px_2px_rgba(0,0,0,0.35)]">
          <HeaderMediaBlock type={headerMedia} url={headerMediaUrl} />
          <div className="px-2.5 pt-1.5 pb-1 text-[13.5px] leading-relaxed text-[#111b21] dark:text-[#e9edef]">
            {header ? (
              <p className="mb-1 font-semibold whitespace-pre-wrap break-words">{renderWhatsAppText(header)}</p>
            ) : null}
            <p className="whitespace-pre-wrap break-words">{renderWhatsAppText(body)}</p>
            {footer ? (
              <p className="mt-1.5 text-[12px] text-[#667781] dark:text-[#8696a0]">{footer}</p>
            ) : null}
            <div className="mt-1 flex items-end justify-end">
              <span className="text-[11px] text-[#667781] dark:text-[#8696a0]">{time ?? '11:07 p. m.'}</span>
            </div>
          </div>
          {visibleButtons.map((button, index) => (
            <div
              key={`${index}-${button.text}`}
              className="border-t border-[#e9edef] px-3 py-2.5 text-center text-[13px] font-medium text-[#027eb5] dark:border-[#3b4a54] dark:text-[#53bdeb]"
            >
              {button.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
