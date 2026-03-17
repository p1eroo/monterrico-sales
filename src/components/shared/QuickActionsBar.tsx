import {
  MessageSquare, Phone, Calendar, Mail, Paperclip, ClipboardList,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface QuickActionsBarProps {
  onAction: (type: string) => void;
}

const actions = [
  { type: 'nota', icon: MessageSquare, label: 'Nota' },
  { type: 'llamada', icon: Phone, label: 'Llamada' },
  { type: 'reunion', icon: Calendar, label: 'Reunión' },
  { type: 'correo', icon: Mail, label: 'Correo' },
  { type: 'archivo', icon: Paperclip, label: 'Archivo' },
  { type: 'tarea', icon: ClipboardList, label: 'Tarea' },
];

export function QuickActionsBar({ onAction }: QuickActionsBarProps) {
  return (
    <div className="flex flex-wrap gap-1 rounded-lg bg-muted/40 p-1.5 border border-border/40">
      {actions.map((a) => (
        <Button
          key={a.type}
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground"
          onClick={() => onAction(a.type)}
        >
          <a.icon className="size-4" /> {a.label}
        </Button>
      ))}
    </div>
  );
}
