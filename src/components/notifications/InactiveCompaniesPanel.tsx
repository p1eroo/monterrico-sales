import { useNavigate } from 'react-router-dom';
import { Building2, ChevronLeft, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCRMStore } from '@/store/crmStore';
import { getInactiveCompanies, slugifyCompany } from '@/lib/inactiveCompanies';
import { etapaLabels } from '@/data/mock';
import { cn } from '@/lib/utils';
import type { Etapa } from '@/types';

interface InactiveCompaniesPanelProps {
  onBack: () => void;
}

const etapaBadgeColors: Record<string, string> = {
  inactivo: 'bg-gray-100 text-gray-700',
  cierre_perdido: 'bg-red-50 text-red-700',
  lead: 'bg-blue-50 text-blue-700',
  contacto: 'bg-sky-50 text-sky-700',
  reunion_agendada: 'bg-amber-50 text-amber-700',
  propuesta_economica: 'bg-orange-50 text-orange-700',
  cierre_ganado: 'bg-emerald-50 text-emerald-700',
};

export function InactiveCompaniesPanel({ onBack }: InactiveCompaniesPanelProps) {
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
      <div className="flex items-start gap-3 border-b px-4 py-3">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onBack}
          className="shrink-0 text-muted-foreground"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
              <Bell className="size-5" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">
                Empresas inactivas
              </h2>
              <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                Sistema
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* List */}
      <ScrollArea className="flex-1">
        <div className="space-y-1 p-3">
          {inactiveCompanies.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
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
                  'flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors',
                  'hover:bg-muted/60 hover:border-muted-foreground/20',
                  'focus:outline-none focus:ring-2 focus:ring-[#13944C]/30',
                )}
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                  <Building2 className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground truncate">
                    {emp.company}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {emp.assignedToName}
                  </p>
                  <span
                    className={cn(
                      'mt-2 inline-block rounded-md px-2 py-0.5 text-[11px] font-medium',
                      etapaBadgeColors[emp.etapa] ?? 'bg-muted text-muted-foreground',
                    )}
                  >
                    {etapaLabels[emp.etapa as Etapa] ?? emp.etapa}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
