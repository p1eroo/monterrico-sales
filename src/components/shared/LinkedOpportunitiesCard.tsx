import { useNavigate } from 'react-router-dom';
import { Briefcase, CalendarDays, User, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { etapaLabels } from '@/data/mock';
import type { Opportunity } from '@/types';

const etapaColors: Record<string, string> = {
  lead: 'bg-slate-100 text-slate-700',
  contacto: 'bg-blue-100 text-blue-700',
  reunion_agendada: 'bg-indigo-100 text-indigo-700',
  reunion_efectiva: 'bg-cyan-100 text-cyan-700',
  propuesta_economica: 'bg-purple-100 text-purple-700',
  negociacion: 'bg-amber-100 text-amber-700',
  licitacion: 'bg-amber-100 text-amber-700',
  licitacion_etapa_final: 'bg-amber-100 text-amber-700',
  cierre_ganado: 'bg-emerald-100 text-emerald-700',
  firma_contrato: 'bg-emerald-100 text-emerald-700',
  cierre_perdido: 'bg-red-100 text-red-700',
  inactivo: 'bg-gray-100 text-gray-500',
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(value);
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface LinkedOpportunitiesCardProps {
  opportunities: Opportunity[];
  onCreate?: () => void;
  onAddExisting?: () => void;
  maxItems?: number;
}

export function LinkedOpportunitiesCard({ opportunities, onCreate, onAddExisting, maxItems = 3 }: LinkedOpportunitiesCardProps) {
  const navigate = useNavigate();
  const hasActions = onCreate || onAddExisting;

  return (
    <Card className="gap-2">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-0 -mt-1">
        <CardTitle className="flex items-center gap-1.5 text-[14px]">
          <Briefcase className="size-4.5 text-muted-foreground" />
          Oportunidades
          <span className="text-muted-foreground font-normal">({opportunities.length})</span>
        </CardTitle>
        {hasActions && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" className="h-6 w-6 shrink-0 p-0"><Plus className="size-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onCreate && <DropdownMenuItem onClick={onCreate}>Crear nueva</DropdownMenuItem>}
              {onAddExisting && <DropdownMenuItem onClick={onAddExisting}>Agregar existente</DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        {opportunities.length === 0 ? (
          <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
            <p className="text-center text-xs text-muted-foreground">Sin oportunidades vinculadas.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {opportunities.slice(0, maxItems).map((opp) => (
              <div key={opp.id} className="rounded-xl border bg-card p-3.5 hover:shadow-sm transition-shadow cursor-pointer" onClick={() => navigate(`/opportunities/${opp.id}`)}>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-[14px] font-semibold leading-tight">{opp.title}</p>
                  <Badge variant="outline" className={`text-[11px] font-medium shrink-0 border-0 ${etapaColors[opp.etapa] ?? 'bg-gray-100 text-gray-700'}`}>{etapaLabels[opp.etapa]}</Badge>
                </div>
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-[15px] font-bold text-emerald-600">{formatCurrency(opp.amount)}</span>
                  <span className="text-[12px] text-muted-foreground">{opp.probability}% prob.</span>
                </div>
                <div className="flex items-center gap-4 text-[12px] text-muted-foreground">
                  <span className="flex items-center gap-1"><User className="size-3" />{opp.assignedToName}</span>
                  <span className="flex items-center gap-1"><CalendarDays className="size-3" />Cierre: {formatDate(opp.expectedCloseDate)}</span>
                </div>
              </div>
            ))}
            {opportunities.length > maxItems && <p className="text-[11px] text-muted-foreground text-center pt-1">+{opportunities.length - maxItems} más</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
