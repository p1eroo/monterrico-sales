import { useEffect, useMemo, useState } from 'react';
import { Loader2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { fetchChatwootTemplates } from '@/lib/chatwootApi';
import {
  formDialogInputClass,
  formDialogScrollListClass,
} from '@/components/ui/form-dialog';

export interface ChatwootWhatsappTemplate {
  name: string;
  language: string;
  category: string;
  content?: string;
  kind?: 'standard' | 'flow';
  apiSendable?: boolean;
}

export function isTemplateSendable(template: ChatwootWhatsappTemplate): boolean {
  return template.apiSendable !== false && template.kind !== 'flow';
}

export function pickDefaultSendableTemplate(
  templates: ChatwootWhatsappTemplate[],
): string {
  const sendable = templates.find(isTemplateSendable);
  return sendable?.name ?? templates[0]?.name ?? 'afiliacion_atu';
}

export function useWhatsappTemplates(enabled: boolean) {
  const [templates, setTemplates] = useState<ChatwootWhatsappTemplate[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);
    fetchChatwootTemplates()
      .then((tpls) => {
        if (!cancelled) setTemplates(tpls);
      })
      .catch(() => {
        if (!cancelled) setTemplates([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const sendableTemplates = useMemo(
    () => templates.filter(isTemplateSendable),
    [templates],
  );

  return { templates, sendableTemplates, loading };
}

export function resolveSelectedTemplate(
  templates: ChatwootWhatsappTemplate[],
  selectedName: string,
): ChatwootWhatsappTemplate {
  const found = templates.find((t) => t.name === selectedName);
  if (found && isTemplateSendable(found)) return found;
  const fallback = templates.find(isTemplateSendable);
  if (fallback) return fallback;
  return {
    name: selectedName || 'afiliacion_atu',
    language: 'es_pe',
    category: 'UTILITY',
    content: '',
    kind: 'standard',
    apiSendable: true,
  };
}

interface WhatsappTemplatePickerProps {
  templates: ChatwootWhatsappTemplate[];
  loading?: boolean;
  selectedName: string;
  onSelect: (name: string) => void;
  className?: string;
  maxHeightClass?: string;
  /** Si true, oculta plantillas con WhatsApp Flow (no enviables por API). */
  sendableOnly?: boolean;
}

export function WhatsappTemplatePicker({
  templates,
  loading = false,
  selectedName,
  onSelect,
  className,
  maxHeightClass = 'max-h-52',
  sendableOnly = false,
}: WhatsappTemplatePickerProps) {
  const [query, setQuery] = useState('');

  const visibleTemplates = useMemo(
    () => (sendableOnly ? templates.filter(isTemplateSendable) : templates),
    [templates, sendableOnly],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return visibleTemplates;
    return visibleTemplates.filter(
      (t) =>
        t.name.toLowerCase().includes(q)
        || t.category.toLowerCase().includes(q)
        || (t.content ?? '').toLowerCase().includes(q),
    );
  }, [visibleTemplates, query]);

  if (loading) {
    return (
      <div className={cn('flex items-center gap-2 text-sm text-muted-foreground py-4', className)}>
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando plantillas...
      </div>
    );
  }

  if (visibleTemplates.length === 0) {
    return (
      <p className={cn('text-sm text-muted-foreground py-2', className)}>
        No hay plantillas disponibles.
      </p>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar plantillas"
          className={cn(formDialogInputClass, 'pl-9')}
        />
      </div>
      <div
        className={cn(
          formDialogScrollListClass,
          maxHeightClass,
          'flex flex-col gap-2 rounded-xl border border-border/70 bg-muted/20 p-2',
        )}
      >
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No se encontraron plantillas.
          </p>
        ) : (
          filtered.map((t) => {
            const sendable = isTemplateSendable(t);
            const selected = sendable && selectedName === t.name;
            return (
              <button
                key={t.name}
                type="button"
                disabled={!sendable}
                onClick={() => {
                  if (sendable) onSelect(t.name);
                }}
                className={cn(
                  'rounded-xl border bg-background px-3.5 py-3 text-left transition-colors',
                  !sendable && 'cursor-not-allowed opacity-55',
                  selected
                    ? 'border-[#13944C]/70 bg-[#13944C]/5 ring-1 ring-[#13944C]/25'
                    : sendable
                      ? 'border-border/80 hover:border-[#13944C]/40 hover:bg-muted/30'
                      : 'border-border/60',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className={cn('font-semibold text-sm', selected && 'text-[#13944C]')}>
                    {t.name}
                  </p>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="rounded-full border border-border/70 bg-muted/50 px-2 py-0.5 text-[10px] text-muted-foreground">
                      Idioma: {t.language}
                    </span>
                    {!sendable ? (
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">
                        Solo Chatwoot
                      </span>
                    ) : null}
                  </div>
                </div>
                <p className="mt-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Categoría · {t.category}
                </p>
                {t.content ? (
                  <p className="mt-2 text-[13px] leading-relaxed whitespace-pre-line text-foreground/85">
                    {t.content}
                  </p>
                ) : null}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
