import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  CalendarDays,
  DollarSign,
  Funnel,
  Loader2,
  Pencil,
  Percent,
  Target,
  TrendingUp,
  User,
  Users,
} from 'lucide-react';
import type { Contact, Opportunity } from '@/types';
import { etapaLabels, priorityLabels } from '@/data/mock';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { api } from '@/lib/api';
import {
  type ApiOpportunityDetail,
  isLikelyOpportunityCuid,
  mapApiContactToContact,
  mapApiOpportunityToOpportunity,
} from '@/lib/opportunityApi';
import { companyDetailHref, contactDetailHref } from '@/lib/detailRoutes';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { rightDrawerSheetContentClass } from '@/lib/rightPanelShell';
import { cn } from '@/lib/utils';

type OpportunityPreviewSheetProps = {
  opportunity: Opportunity | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenFullDetail: () => void;
  onEdit: () => void;
};

const statusLabels: Record<string, string> = {
  abierta: 'Abierta',
  ganada: 'Ganada',
  perdida: 'Perdida',
  suspendida: 'Suspendida',
};

function PreviewRow({ icon: Icon, label, value }: { icon: typeof User; label: string; value: string }) {
  return (
    <div className="flex gap-3 py-2 text-sm">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="break-words font-medium">{value || '—'}</p>
      </div>
    </div>
  );
}

function PreviewSectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground first:mt-2">
      {children}
    </h3>
  );
}

function linkCardClass(href?: boolean) {
  return cn(
    'flex flex-col gap-0.5 rounded-md border border-border/60 bg-card/40 px-3 py-2 transition-colors',
    href && 'cursor-pointer hover:border-primary/40 hover:bg-card/80',
  );
}

export function OpportunityPreviewSheet({
  opportunity,
  open,
  onOpenChange,
  onOpenFullDetail,
  onEdit,
}: OpportunityPreviewSheetProps) {
  const [apiRecord, setApiRecord] = useState<ApiOpportunityDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const canLoadServer =
    opportunity != null && isLikelyOpportunityCuid(opportunity.id);

  useEffect(() => {
    if (!open || !opportunity?.id || !canLoadServer) {
      setApiRecord(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void api<ApiOpportunityDetail>(`/opportunities/${opportunity.id}`)
      .then((row) => {
        if (!cancelled) setApiRecord(row);
      })
      .catch(() => {
        if (!cancelled) setApiRecord(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, opportunity?.id, canLoadServer]);

  const display = useMemo(() => {
    if (!opportunity) return null;
    if (canLoadServer && apiRecord) {
      return mapApiOpportunityToOpportunity(apiRecord);
    }
    return opportunity;
  }, [opportunity, canLoadServer, apiRecord]);

  const linkedContact: Contact | null = useMemo(() => {
    if (!display) return null;
    if (canLoadServer && apiRecord?.contacts?.[0]?.contact) {
      return mapApiContactToContact(apiRecord.contacts[0].contact);
    }
    if (display.contactId && display.contactName) {
      return {
        id: display.contactId,
        urlSlug: undefined,
        name: display.contactName,
        cargo: undefined,
        companies: [],
        telefono: '',
        correo: '',
        fuente: 'base',
        etapa: display.etapa,
        assignedTo: '',
        assignedToName: '',
        estimatedValue: 0,
        createdAt: display.createdAt,
      } satisfies Contact;
    }
    return null;
  }, [display, canLoadServer, apiRecord]);

  const linkedCompany = useMemo(() => {
    if (!canLoadServer || !apiRecord?.companies?.[0]?.company) return null;
    return apiRecord.companies[0].company;
  }, [canLoadServer, apiRecord]);

  if (!opportunity) return null;

  const etapaLabel = display ? etapaLabels[display.etapa] ?? display.etapa : '—';
  const priorityLabel =
    display?.priority && priorityLabels[display.priority]
      ? priorityLabels[display.priority]
      : display?.priority ?? '—';
  const statusLabel = display ? statusLabels[display.status] ?? display.status : '—';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className={rightDrawerSheetContentClass('md', 'min-h-0')}>
        <SheetHeader className="space-y-1 border-b pb-4 text-left">
          <SheetTitle className="pr-8 leading-snug">{opportunity.title}</SheetTitle>
          {canLoadServer && loading && !apiRecord ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              Actualizando datos…
            </p>
          ) : null}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-2">
          <PreviewRow icon={Funnel} label="Etapa" value={etapaLabel} />
          <PreviewRow
            icon={DollarSign}
            label="Monto"
            value={display ? formatCurrency(display.amount) : '—'}
          />
          <PreviewRow
            icon={Percent}
            label="Probabilidad"
            value={display != null ? `${display.probability}%` : '—'}
          />
          <PreviewRow icon={TrendingUp} label="Prioridad" value={priorityLabel} />
          <PreviewRow
            icon={CalendarDays}
            label="Fecha de cierre"
            value={display?.expectedCloseDate ? formatDate(display.expectedCloseDate) : '—'}
          />
          <PreviewRow
            icon={User}
            label="Asesor"
            value={display?.assignedToName?.trim() ? display.assignedToName : 'Sin asignar'}
          />
          <PreviewRow icon={Target} label="Estado" value={statusLabel} />
          <PreviewRow
            icon={CalendarDays}
            label="Fecha de creación"
            value={display?.createdAt ? formatDate(display.createdAt) : '—'}
          />

          {!canLoadServer ? (
            <p className="py-2 text-xs text-muted-foreground">
              Cuando la oportunidad se guarde en el servidor podrás abrir la ficha completa y los vínculos.
            </p>
          ) : null}

          <Separator className="my-3" />

          <PreviewSectionTitle>Contacto vinculado</PreviewSectionTitle>
          {!linkedContact ? (
            <p className="py-1 text-sm text-muted-foreground">Ninguno</p>
          ) : (
            <ul className="space-y-2 pt-1">
              <li className="text-sm">
                <Link
                  to={contactDetailHref(linkedContact)}
                  className={linkCardClass(true)}
                  onClick={() => onOpenChange(false)}
                >
                  <span className="flex items-start gap-2 font-medium text-primary">
                    <Users className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                    <span className="break-words">{linkedContact.name}</span>
                  </span>
                  {linkedContact.correo && linkedContact.correo !== '-' ? (
                    <span className="line-clamp-2 pl-5 text-xs text-muted-foreground">
                      {linkedContact.correo}
                    </span>
                  ) : null}
                </Link>
              </li>
            </ul>
          )}

          <PreviewSectionTitle>Empresa vinculada</PreviewSectionTitle>
          {!linkedCompany?.id ? (
            <p className="py-1 text-sm text-muted-foreground">Ninguna</p>
          ) : (
            <ul className="space-y-2 pt-1">
              <li className="text-sm">
                <Link
                  to={companyDetailHref({
                    id: linkedCompany.id,
                    urlSlug: (linkedCompany as { urlSlug?: string }).urlSlug,
                  })}
                  className={linkCardClass(true)}
                  onClick={() => onOpenChange(false)}
                >
                  <span className="flex items-start gap-2 font-medium text-primary">
                    <Building2 className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                    <span className="break-words">{linkedCompany.name}</span>
                  </span>
                </Link>
              </li>
            </ul>
          )}
        </div>

        <SheetFooter className="mt-auto flex-col gap-2 border-t pt-4 sm:flex-col">
          <Button className="w-full" variant="default" onClick={onOpenFullDetail}>
            Abrir ficha completa
          </Button>
          <Button className="w-full" variant="outline" onClick={onEdit}>
            <Pencil className="size-4" />
            Editar
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
