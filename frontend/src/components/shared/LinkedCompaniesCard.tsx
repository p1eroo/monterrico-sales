import { useNavigate } from 'react-router-dom';
import { Building2, Globe, Star } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { companyRubroLabels } from '@/data/mock';
import { LinkedEntitiesCard } from './LinkedEntitiesCard';
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

export function LinkedCompaniesCard({
  companies,
  onCreate,
  onAddExisting,
  maxItems = 3,
}: LinkedCompaniesCardProps) {
  const navigate = useNavigate();

  return (
    <LinkedEntitiesCard<LinkedCompany>
      title="Empresas vinculadas"
      icon={Building2}
      items={companies}
      maxItems={maxItems}
      emptyMessage="Sin empresas vinculadas."
      createLabel="Crear nueva"
      onCreate={onCreate}
      onAddExisting={onAddExisting}
      getItemKey={(c, idx) => `${c.name}-${idx ?? 0}`}
      onItemClick={(c) => navigate(`/empresas/${encodeURIComponent(c.name)}`)}
      renderItem={(comp) => (
        <>
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="flex items-center gap-1.5 min-w-0">
              {comp.isPrimary && <Star className="size-3.5 shrink-0 fill-amber-400 text-amber-500" />}
              <p className="text-[14px] font-semibold leading-tight truncate">{comp.name}</p>
            </div>
            {comp.rubro && (
              <Badge
                variant="outline"
                className={`text-[11px] font-medium shrink-0 border-0 ${rubroColors[comp.rubro] ?? 'bg-gray-100 text-gray-700'}`}
              >
                {companyRubroLabels[comp.rubro]}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-4 text-[12px] text-muted-foreground">
            {comp.domain && (
              <span className="flex items-center gap-1">
                <Globe className="size-3" />
                {comp.domain}
              </span>
            )}
            {comp.tipo && (
              <Badge
                variant="outline"
                className={`text-[10px] px-1.5 py-0 font-medium border-0 ${tipoColors[comp.tipo]}`}
              >
                Tipo {comp.tipo}
              </Badge>
            )}
          </div>
        </>
      )}
    />
  );
}
