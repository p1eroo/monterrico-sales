import { useNavigate } from 'react-router-dom';
import { Building2, Globe, Star, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { companyRubroLabels } from '@/data/mock';
import type { LinkedCompany } from '@/types';

const rubroColors: Record<string, string> = {
  mineria: 'bg-amber-100 text-amber-700',
  hoteleria: 'bg-purple-100 text-purple-700',
  banca: 'bg-blue-100 text-blue-700',
  construccion: 'bg-orange-100 text-orange-700',
  salud: 'bg-rose-100 text-rose-700',
  retail: 'bg-pink-100 text-pink-700',
  telecomunicaciones: 'bg-indigo-100 text-indigo-700',
  educacion: 'bg-cyan-100 text-cyan-700',
  energia: 'bg-yellow-100 text-yellow-700',
  consultoria: 'bg-teal-100 text-teal-700',
  diplomatico: 'bg-violet-100 text-violet-700',
  aviacion: 'bg-sky-100 text-sky-700',
  consumo_masivo: 'bg-lime-100 text-lime-700',
  otros: 'bg-gray-100 text-gray-700',
};

const tipoColors: Record<string, string> = {
  A: 'bg-emerald-100 text-emerald-700',
  B: 'bg-blue-100 text-blue-700',
  C: 'bg-slate-100 text-slate-600',
};

interface LinkedCompaniesCardProps {
  companies: LinkedCompany[];
  onCreate?: () => void;
  onAddExisting?: () => void;
  maxItems?: number;
}

export function LinkedCompaniesCard({ companies, onCreate, onAddExisting, maxItems = 3 }: LinkedCompaniesCardProps) {
  const navigate = useNavigate();
  const hasActions = onCreate || onAddExisting;

  return (
    <Card className="gap-2">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-0 -mt-1">
        <CardTitle className="flex items-center gap-1.5 text-[14px]">
          <Building2 className="size-4.5 text-muted-foreground" />
          Empresas vinculadas
          <span className="text-muted-foreground font-normal">({companies.length})</span>
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
        {companies.length === 0 ? (
          <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
            <p className="text-center text-xs text-muted-foreground">Sin empresas vinculadas.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {companies.slice(0, maxItems).map((comp, idx) => (
              <div key={`${comp.name}-${idx}`} className="rounded-xl border bg-card p-3.5 hover:shadow-sm transition-shadow cursor-pointer" onClick={() => navigate(`/empresas/${encodeURIComponent(comp.name)}`)}>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {comp.isPrimary && <Star className="size-3.5 shrink-0 fill-amber-400 text-amber-500" />}
                    <p className="text-[14px] font-semibold leading-tight truncate">{comp.name}</p>
                  </div>
                  {comp.rubro && <Badge variant="outline" className={`text-[11px] font-medium shrink-0 border-0 ${rubroColors[comp.rubro] ?? 'bg-gray-100 text-gray-700'}`}>{companyRubroLabels[comp.rubro]}</Badge>}
                </div>
                <div className="flex items-center gap-4 text-[12px] text-muted-foreground">
                  {comp.domain && <span className="flex items-center gap-1"><Globe className="size-3" />{comp.domain}</span>}
                  {comp.tipo && <Badge variant="outline" className={`text-[10px] px-1.5 py-0 font-medium border-0 ${tipoColors[comp.tipo]}`}>Tipo {comp.tipo}</Badge>}
                </div>
              </div>
            ))}
            {companies.length > maxItems && <p className="text-[11px] text-muted-foreground text-center pt-1">+{companies.length - maxItems} más</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
