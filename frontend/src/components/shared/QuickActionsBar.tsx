import { Button } from '@/components/ui/button';
import { activityTypeSvgIcon } from '@/lib/activityTypeSvgIcons';

interface QuickActionsBarProps {
  onAction: (type: string) => void;
}

const actions = [
  { type: 'nota', label: 'Nota' },
  { type: 'llamada', label: 'Llamada' },
  { type: 'reunion', label: 'Reunión' },
  { type: 'correo', label: 'Correo' },
  { type: 'archivo', label: 'Archivo' },
  { type: 'tarea', label: 'Tarea' },
] as const;

export function QuickActionsBar({ onAction }: QuickActionsBarProps) {
  return (
    <div className="flex flex-wrap gap-1 rounded-lg bg-muted/40 p-1.5 border border-border/40">
      {actions.map((a) => {
        const Icon = activityTypeSvgIcon(a.type);
        return (
        <Button
          key={a.type}
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => onAction(a.type)}
        >
          <Icon className="size-4" /> {a.label}
        </Button>
        );
      })}
    </div>
  );
}
