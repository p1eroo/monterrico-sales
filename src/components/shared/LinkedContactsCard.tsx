import { useNavigate } from 'react-router-dom';
import { Users, Phone, Mail, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { etapaLabels } from '@/data/mock';
import { StatusBadge } from '@/components/shared/StatusBadge';
import type { Lead } from '@/types';

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

function getPrimaryCompany(lead: Lead) {
  return lead.companies?.find((c) => c.isPrimary) ?? lead.companies?.[0];
}

export interface LinkedContact {
  id: string;
  name: string;
  cargo?: string;
  etapa: string;
  phone?: string;
  email?: string;
  estimatedValue: number;
  companies?: Lead['companies'];
}

interface LinkedContactsCardProps {
  contacts: LinkedContact[];
  title?: string;
  onCreate?: () => void;
  onAddExisting?: () => void;
  maxItems?: number;
  variant?: 'full' | 'compact';
}

export function LinkedContactsCard({ contacts, title = 'Contactos vinculados', onCreate, onAddExisting, maxItems = 3, variant = 'full' }: LinkedContactsCardProps) {
  const navigate = useNavigate();
  const hasActions = onCreate || onAddExisting;

  return (
    <Card className="gap-2">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-0 -mt-1">
        <CardTitle className="flex items-center gap-1.5 text-[14px]">
          <Users className="size-4.5 text-muted-foreground" />
          {title}
          <span className="text-muted-foreground font-normal">({contacts.length})</span>
        </CardTitle>
        {hasActions && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost" className="h-6 w-6 shrink-0 p-0"><Plus className="size-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onCreate && <DropdownMenuItem onClick={onCreate}>Crear nuevo</DropdownMenuItem>}
              {onAddExisting && <DropdownMenuItem onClick={onAddExisting}>Agregar existente</DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        {contacts.length === 0 ? (
          <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
            <p className="text-center text-xs text-muted-foreground">Sin contactos vinculados.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {contacts.slice(0, maxItems).map((contact) => {
              const primaryCompany = getPrimaryCompany(contact as Lead);
              return (
                <div key={contact.id} className="rounded-xl border bg-card p-3.5 hover:shadow-sm transition-shadow cursor-pointer" onClick={() => navigate(`/contactos/${contact.id}`)}>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-[14px] font-semibold leading-tight truncate">{contact.name}</p>
                    {variant === 'full' ? (
                      <Badge variant="outline" className={`text-[11px] font-medium shrink-0 border-0 ${etapaColors[contact.etapa] ?? 'bg-gray-100 text-gray-700'}`}>{etapaLabels[contact.etapa]}</Badge>
                    ) : (
                      <StatusBadge status={contact.etapa} />
                    )}
                  </div>
                  {contact.cargo && <p className="text-[13px] text-muted-foreground mb-1">{contact.cargo}{primaryCompany ? ` · ${primaryCompany.name}` : ''}</p>}
                  {variant === 'full' ? (
                    <div className="flex items-center gap-4 text-[12px] text-muted-foreground">
                      {contact.phone && <span className="flex items-center gap-1"><Phone className="size-3" />{contact.phone}</span>}
                      {contact.email && <span className="flex items-center gap-1 truncate"><Mail className="size-3 shrink-0" />{contact.email}</span>}
                    </div>
                  ) : (
                    <p className="text-[12px] text-muted-foreground">{formatCurrency(contact.estimatedValue)}</p>
                  )}
                </div>
              );
            })}
            {contacts.length > maxItems && <p className="text-[11px] text-muted-foreground text-center pt-1">+{contacts.length - maxItems} más</p>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
