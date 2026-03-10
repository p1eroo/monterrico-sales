import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const statusConfig: Record<string, { label: string; className: string }> = {
  // Etapas (Contactos, Empresas, Oportunidades)
  lead: { label: 'Lead', className: 'bg-slate-100 text-slate-700 border-slate-200' },
  contacto: { label: 'Contacto', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  reunion_agendada: { label: 'Reunión Agendada', className: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
  reunion_efectiva: { label: 'Reunión Efectiva', className: 'bg-cyan-100 text-cyan-700 border-cyan-200' },
  propuesta_economica: { label: 'Propuesta Económica', className: 'bg-purple-100 text-purple-700 border-purple-200' },
  negociacion: { label: 'Negociación', className: 'bg-orange-100 text-orange-700 border-orange-200' },
  licitacion: { label: 'Licitación', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  licitacion_etapa_final: { label: 'Licitación Etapa Final', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  cierre_ganado: { label: 'Cierre Ganado', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  firma_contrato: { label: 'Firma de Contrato', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  activo: { label: 'Activo', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  cierre_perdido: { label: 'Cierre Perdido', className: 'bg-red-100 text-red-700 border-red-200' },
  inactivo: { label: 'Inactivo', className: 'bg-gray-100 text-gray-700 border-gray-200' },
  // Activity status
  pendiente: { label: 'Pendiente', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  completada: { label: 'Completada', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  vencida: { label: 'Vencida', className: 'bg-red-100 text-red-700 border-red-200' },
  reprogramada: { label: 'Reprogramada', className: 'bg-sky-100 text-sky-700 border-sky-200' },
  potencial: { label: 'Potencial', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  abierta: { label: 'Abierta', className: 'bg-blue-100 text-blue-700 border-blue-200' },
  ganada: { label: 'Ganada', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  perdida: { label: 'Perdida', className: 'bg-red-100 text-red-700 border-red-200' },
  suspendida: { label: 'Suspendida', className: 'bg-gray-100 text-gray-700 border-gray-200' },
};

interface StatusBadgeProps {
  status: string;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status] ?? {
    label: status.charAt(0).toUpperCase() + status.slice(1),
    className: 'bg-gray-100 text-gray-700 border-gray-200',
  };
  return (
    <Badge variant="outline" className={cn('text-[11px] font-medium', config.className)}>
      {config.label}
    </Badge>
  );
}
