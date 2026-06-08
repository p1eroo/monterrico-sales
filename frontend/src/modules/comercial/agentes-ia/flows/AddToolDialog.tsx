import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Database, BookOpen, Globe, Braces } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { toast } from 'sonner';

export type ToolChoice =
  | 'knowledge'
  | 'database'
  | 'api'
  | 'static';

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAdd?: (tool: ToolChoice) => void;
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
      'Recuperación semántica sobre fragmentos indexados y control de versión.',
  },
  {
    id: 'database',
    icon: Database,
    title: 'Base de datos',
    description:
      'Consultas parametrizadas a tablas aprobadas con auditoría de lectura.',
  },
  {
    id: 'api',
    icon: Globe,
    title: 'API REST',
    description:
      'Llamadas HTTP con plantillas de auth, cabeceras y cuerpo validado.',
  },
  {
    id: 'static',
    icon: Braces,
    title: 'Datos estáticos',
    description:
      'Pares clave/valor o JSON embebido para reglas y plantillas fijas.',
  },
];

export function AddToolDialog({ open, onOpenChange, onAdd }: Props) {
  const [selected, setSelected] = useState<ToolChoice | null>(null);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) setSelected(null);
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Agregar herramienta</DialogTitle>
          <DialogDescription>
            El nodo aparecerá en el lienzo y podrás enlazarlo al agente o al
            modelo. Esta acción es local al flujo (demo).
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 py-2 sm:grid-cols-2">
          {OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const isSel = selected === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSelected(opt.id)}
                className={cn(
                  'flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-colors',
                  isSel
                    ? 'border-[#13944C] bg-[#13944C]/10'
                    : 'border-border bg-card hover:bg-muted/40',
                )}
              >
                <Icon
                  className={cn(
                    'size-5',
                    isSel ? 'text-[#13944C]' : 'text-muted-foreground',
                  )}
                />
                <span className="text-sm font-medium">{opt.title}</span>
                <span className="text-xs text-muted-foreground leading-snug">
                  {opt.description}
                </span>
              </button>
            );
          })}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="bg-[#13944C] hover:bg-[#0f7a3d]"
            disabled={!selected}
            onClick={() => {
              if (!selected) return;
              onAdd?.(selected);
              toast.success('Herramienta añadida al lienzo (demo)');
              setSelected(null);
              onOpenChange(false);
            }}
          >
            Agregar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
