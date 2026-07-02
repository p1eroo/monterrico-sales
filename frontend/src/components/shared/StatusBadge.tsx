import { Badge } from '@/components/ui/badge';
import { etapaLabels } from '@/data/mock';
import { getStageBadgeTone } from '@/lib/etapaConfig';
import { cn } from '@/lib/utils';
import { useCrmConfigStore, getStageLabelFromCatalog } from '@/store/crmConfigStore';

/** Estados de actividad / oportunidad: no son etapas del pipeline CRM. */
const NON_PIPELINE_STATUS = new Set([
  'pendiente',
  'completada',
  'vencida',
  'en_progreso',
  'potencial',
  'abierta',
  'ganada',
  'perdida',
]);

const activityStatusConfig: Record<string, { label: string; className: string }> = {
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
  const bundle = useCrmConfigStore((s) => s.bundle);

  if (NON_PIPELINE_STATUS.has(status)) {
    const config = activityStatusConfig[status] ?? {
      label: status.charAt(0).toUpperCase() + status.slice(1),
      className: 'border-border bg-muted text-text-secondary',
    };
    return (
      <Badge variant="outline" className={cn('text-[11px] font-medium', config.className)}>
        {config.label}
      </Badge>
    );
  }

  const tone = getStageBadgeTone(bundle, status);
  const label = getStageLabelFromCatalog(status, bundle, etapaLabels as Record<string, string>);
  return (
    <Badge
      variant="outline"
      className={cn('text-[11px] font-medium', tone.className)}
      style={tone.style}
    >
      {label}
    </Badge>
  );
}
