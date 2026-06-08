import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Building2, ChevronLeft, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  companySinCambioEtapaAlert,
  type CompanySinCambioEtapaAlertItem,
} from '@/lib/companyApi';
import { etapaLabels } from '@/data/mock';
import { cn } from '@/lib/utils';
import type { Etapa } from '@/types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface InactiveCompaniesPanelProps {
  onBack: () => void;
  onClose?: () => void;
}

const etapaBadgeColors: Record<string, string> = {
  inactivo: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  cierre_perdido: 'bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  lead: 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  contacto: 'bg-sky-50 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
  reunion_agendada: 'bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  propuesta_economica: 'bg-orange-50 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  cierre_ganado: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
};

export function InactiveCompaniesPanel({ onBack, onClose }: InactiveCompaniesPanelProps) {
  const navigate = useNavigate();
  const [items, setItems] = useState<CompanySinCambioEtapaAlertItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let c = true;
    setLoading(true);
    void companySinCambioEtapaAlert()
      .then((res) => {
        if (c) setItems(res.items);
      })
      .catch(() => {
        if (c) setItems([]);
      })
      .finally(() => {
        if (c) setLoading(false);
      });
    return () => {
      c = false;
    };
  }, []);

  const handleCompanyClick = (row: CompanySinCambioEtapaAlertItem) => {
    navigate(`/empresas/${encodeURIComponent(row.urlSlug)}`);
    onBack();
  };

  const formatLastChange = (iso: string) => {
    try {
      return format(new Date(iso), "d MMM yyyy", { locale: es });
    } catch {
      return iso;
    }
  };

  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onBack}
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400">
              <Building2 className="size-4" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate font-semibold text-foreground">
                Empresas sin cambio de etapa
              </h2>
              <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                11+ semanas · etapas 0 %, 10 %, 30 %
              </span>
            </div>
          </div>
        </div>
        {onClose && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            className="shrink-0 text-muted-foreground hover:text-foreground"
            aria-label="Cerrar"
          >
            <X className="size-4" />
          </Button>
        )}
      </div>

      <ScrollArea className="min-h-0 min-w-0 flex-1">
        <div className="box-border space-y-2 p-4 pr-5 pb-6">
          {loading ? (
            <p className="py-12 text-center text-sm text-muted-foreground">Cargando…</p>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Building2 className="size-12 text-muted-foreground/40" />
              <p className="mt-3 text-sm font-medium text-foreground">
                No hay empresas en esta alerta
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Etapas con probabilidad 0 %, 10 % o 30 % y movimiento de etapa en las últimas 11
                semanas
              </p>
            </div>
          ) : (
            items.map((emp) => (
              <button
                key={emp.id}
                type="button"
                onClick={() => handleCompanyClick(emp)}
                className={cn(
                  'flex w-full min-w-0 max-w-full flex-col gap-2 rounded-xl border p-4 text-left transition-colors',
                  'hover:bg-muted/60 hover:border-muted-foreground/20',
                  'focus:outline-none focus:ring-2 focus:ring-primary/30',
                )}
              >
                <div className="min-w-0 space-y-2">
                  <span className="block break-words font-semibold leading-snug text-foreground">
                    {emp.name}
                  </span>
                  <span
                    className={cn(
                      'inline-flex max-w-full rounded-full px-2.5 py-0.5 text-left text-[11px] font-medium leading-snug',
                      etapaBadgeColors[emp.etapa] ?? 'bg-muted text-muted-foreground',
                    )}
                  >
                    {etapaLabels[emp.etapa as Etapa] ?? emp.etapa}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Último cambio de etapa:{' '}
                  <span className="font-medium text-foreground">{formatLastChange(emp.lastEtapaChangeAt)}</span>
                </p>
                {emp.assignedToName && (
                  <p className="text-xs text-muted-foreground">{emp.assignedToName}</p>
                )}
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
