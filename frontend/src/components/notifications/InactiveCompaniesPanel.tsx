import { useNavigate } from 'react-router-dom';
import { Building2, ChevronLeft, Globe, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCRMStore } from '@/store/crmStore';
import { getInactiveCompanies, slugifyCompany } from '@/lib/inactiveCompanies';
import { etapaLabels, companyRubroLabels, companyTipoLabels } from '@/data/mock';
import { cn } from '@/lib/utils';
import type { Etapa } from '@/types';

interface InactiveCompaniesPanelProps {
  onBack: () => void;
  /** Si se proporciona, muestra botón X en la misma fila del header */
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
  const { contacts } = useCRMStore();
  const inactiveCompanies = getInactiveCompanies(contacts);

  const handleCompanyClick = (company: string) => {
    navigate(`/empresas/${slugifyCompany(company)}`);
    onBack();
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onBack}
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400">
              <Building2 className="size-4" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate font-semibold text-foreground">
                Empresas inactivas
              </h2>
              <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                Sistema
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

      {/* List */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="space-y-2 p-4">
          {inactiveCompanies.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Building2 className="size-12 text-muted-foreground/40" />
              <p className="mt-3 text-sm font-medium text-foreground">
                No hay empresas inactivas
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Todas tus empresas tienen actividad reciente
              </p>
            </div>
          ) : (
            inactiveCompanies.map((emp) => (
              <button
                key={emp.id}
                type="button"
                onClick={() => handleCompanyClick(emp.company)}
                className={cn(
                  'flex w-full flex-col gap-2 rounded-xl border p-4 text-left transition-colors',
                  'hover:bg-muted/60 hover:border-muted-foreground/20',
                  'focus:outline-none focus:ring-2 focus:ring-primary/30',
                )}
              >
                {/* Fila 1: Nombre ... Etapa */}
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate font-semibold text-foreground">
                    {emp.company}
                  </span>
                  <span
                    className={cn(
                      'shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium',
                      etapaBadgeColors[emp.etapa] ?? 'bg-muted text-muted-foreground',
                    )}
                  >
                    {etapaLabels[emp.etapa as Etapa] ?? emp.etapa}
                  </span>
                </div>
                {/* Fila 2: Dominio | Tipo | Rubro */}
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  {emp.domain && (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Globe className="size-3.5 shrink-0" />
                      {emp.domain}
                    </span>
                  )}
                  {(emp.domain && (emp.companyTipo || emp.companyRubro)) && (
                    <span className="text-muted-foreground/50">·</span>
                  )}
                  {emp.companyTipo && (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                      Tipo {companyTipoLabels[emp.companyTipo] ?? emp.companyTipo}
                    </span>
                  )}
                  {emp.companyRubro && (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                      {companyRubroLabels[emp.companyRubro] ?? emp.companyRubro}
                    </span>
                  )}
                </div>
                {/* Fila 3: Asesor */}
                <p className="text-xs text-muted-foreground">
                  {emp.assignedToName}
                </p>
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
