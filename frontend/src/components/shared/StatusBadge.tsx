import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const statusConfig: Record<string, { label: string; className: string }> = {
  // Etapas (Contactos, Empresas, Oportunidades)
  lead: { label: 'Lead', className: 'border-stage-lead/30 bg-stage-lead/15 text-stage-lead' },
  contacto: { label: 'Contacto', className: 'border-stage-prospect/30 bg-stage-prospect/15 text-stage-prospect' },
  reunion_agendada: { label: 'Reunión Agendada', className: 'border-stage-prospect/30 bg-stage-prospect/15 text-stage-prospect' },
  reunion_efectiva: { label: 'Reunión Efectiva', className: 'border-info/30 bg-info/15 text-info' },
  propuesta_economica: { label: 'Propuesta Económica', className: 'border-activity-task/30 bg-activity-task/15 text-activity-task' },
  negociacion: { label: 'Negociación', className: 'border-activity-note/30 bg-activity-note/15 text-activity-note' },
  licitacion: { label: 'Licitación', className: 'border-activity-note/30 bg-activity-note/15 text-activity-note' },
  licitacion_etapa_final: { label: 'Licitación Etapa Final', className: 'border-warning/30 bg-warning/15 text-warning' },
  cierre_ganado: { label: 'Cierre Ganado', className: 'border-stage-client/30 bg-stage-client/15 text-stage-client' },
  firma_contrato: { label: 'Firma de Contrato', className: 'border-stage-client/30 bg-stage-client/15 text-stage-client' },
  activo: { label: 'Activo', className: 'border-stage-client/30 bg-stage-client/15 text-stage-client' },
  cierre_perdido: { label: 'Cierre Perdido', className: 'border-stage-lost/30 bg-stage-lost/15 text-stage-lost' },
  inactivo: { label: 'Inactivo', className: 'border-border bg-muted text-text-secondary' },
  // Activity status
  pendiente: { label: 'Pendiente', className: 'border-warning/30 bg-warning/15 text-warning' },
  completada: { label: 'Completada', className: 'border-stage-client/30 bg-stage-client/15 text-stage-client' },
  vencida: { label: 'Vencida', className: 'border-stage-lost/30 bg-stage-lost/15 text-stage-lost' },
  en_progreso: { label: 'En progreso', className: 'border-stage-prospect/30 bg-stage-prospect/15 text-stage-prospect' },
  potencial: { label: 'Potencial', className: 'border-stage-prospect/30 bg-stage-prospect/15 text-stage-prospect' },
  abierta: { label: 'Abierta', className: 'border-stage-prospect/30 bg-stage-prospect/15 text-stage-prospect' },
  ganada: { label: 'Ganada', className: 'border-stage-client/30 bg-stage-client/15 text-stage-client' },
  perdida: { label: 'Perdida', className: 'border-stage-lost/30 bg-stage-lost/15 text-stage-lost' },
};

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status] ?? {
    label: status.charAt(0).toUpperCase() + status.slice(1),
    className: 'border-border bg-muted text-text-secondary',
  };
  return (
    <Badge variant="outline" className={cn('text-[11px] font-medium', config.className)}>
      {config.label}
    </Badge>
  );
}
