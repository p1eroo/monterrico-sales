import { useState } from 'react';
import { X, BookOpen, Database, Globe, Braces } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ToolChoice } from '../flows/AddToolDialog';

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (tool: ToolChoice) => void;
  className?: string;
};

const OPTIONS: {
  id: ToolChoice;
  icon: typeof BookOpen;
  title: string;
  description: string;
}[] = [
  {
    id: 'knowledge',
    icon: BookOpen,
    title: 'Base de conocimiento',
    description:
      'Indexación semántica, top-K y políticas de recuperación para RAG.',
  },
  {
    id: 'database',
    icon: Database,
    title: 'Base de datos',
    description:
      'Consultas parametrizadas de solo lectura con credenciales en vault.',
  },
  {
    id: 'api',
    icon: Globe,
    title: 'API REST',
    description: 'HTTP con plantillas de cuerpo, auth segmentada y variables.',
  },
  {
    id: 'static',
    icon: Braces,
    title: 'Datos estáticos',
    description: 'Bloques KV/JSON embebidos para handoff y políticas fijas.',
  },
];

export function AddToolSidePanel({
  open,
  onOpenChange,
  onConfirm,
  className,
}: Props) {
  const [pick, setPick] = useState<ToolChoice | null>(null);

  if (!open) return null;

  return (
    <aside
      className={cn(
        'flex w-full max-w-[440px] shrink-0 flex-col border-l border-border bg-card shadow-xl',
        'max-lg:fixed max-lg:inset-y-0 max-lg:right-0 max-lg:z-40 max-lg:h-full',
        className,
      )}
    >
      <header className="flex shrink-0 items-start gap-2 border-b border-border px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-info">
            Nueva herramienta
          </p>
          <h2 className="text-base font-semibold text-foreground">
            Agregar al flujo
          </h2>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:bg-accent"
          onClick={() => {
            setPick(null);
            onOpenChange(false);
          }}
        >
          <X className="size-4" />
        </Button>
      </header>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4 pb-24">
        {OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const sel = pick === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setPick(opt.id)}
              className={cn(
                'flex w-full gap-3 rounded-xl border p-3 text-left transition-all',
                sel
                  ? 'border-info/60 bg-info/10 shadow-lg'
                  : 'border-border bg-muted/50 hover:border-muted-foreground/30',
              )}
            >
              <div
                className={cn(
                  'flex size-10 shrink-0 items-center justify-center rounded-lg',
                  sel
                    ? 'bg-info/20 text-info'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                <Icon className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{opt.title}</p>
                <p className="mt-1 text-xs leading-snug text-muted-foreground">
                  {opt.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      <footer className="sticky bottom-0 border-t border-border bg-card/95 px-4 py-3 backdrop-blur">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className="flex-1 border-border text-foreground"
            onClick={() => {
              setPick(null);
              onOpenChange(false);
            }}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={!pick}
            className="flex-1 bg-info font-semibold text-info-foreground hover:bg-info/90"
            onClick={() => {
              if (pick) {
                onConfirm(pick);
                setPick(null);
                onOpenChange(false);
              }
            }}
          >
            Agregar
          </Button>
        </div>
      </footer>
    </aside>
  );
}
