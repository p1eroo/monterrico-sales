import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  CalendarDays,
  DollarSign,
  Funnel,
  Globe,
  Home,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Target,
  User,
  UserCheck,
  Users,
} from 'lucide-react';
import { contactSourceLabels, etapaLabels, companyRubroLabels, companyTipoLabels } from '@/data/mock';
import type { CompanySummaryRow } from '@/lib/companyApi';
import { isLikelyCompanyCuid } from '@/lib/companyApi';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { api } from '@/lib/api';
import type { ApiCompanyRecord } from '@/lib/companyApi';
import {
  contactListAll,
  mapApiContactRowToContact,
  type ApiContactListRow,
} from '@/lib/contactApi';
import {
  opportunityListAll,
  mapApiOpportunityToOpportunity,
  type ApiOpportunityListRow,
} from '@/lib/opportunityApi';
import {
  companyDetailHref,
  contactDetailHref,
  opportunityDetailHref,
} from '@/lib/detailRoutes';
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
import type { ContactSource, Etapa, CompanyRubro, CompanyTipo } from '@/types';
import { cn } from '@/lib/utils';

type EmpresaPreviewRow = CompanySummaryRow & { isLocalOnly?: boolean };

type CompanyPreviewSheetProps = {
  row: EmpresaPreviewRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenFullDetail: () => void;
  onEdit: () => void;
};

function PreviewRow({ icon: Icon, label, value }: { icon: typeof Phone; label: string; value: string }) {
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

function PreviewSectionTitle({ children }: { children: ReactNode }) {
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

export function CompanyPreviewSheet({
  row,
  open,
  onOpenChange,
  onOpenFullDetail,
  onEdit,
}: CompanyPreviewSheetProps) {
  const [apiRecord, setApiRecord] = useState<ApiCompanyRecord | null>(null);
  const [contactRows, setContactRows] = useState<ApiContactListRow[]>([]);
  const [opportunityRows, setOpportunityRows] = useState<ApiOpportunityListRow[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const canLoadServer = row && !row.isLocalOnly && isLikelyCompanyCuid(row.id);

  useEffect(() => {
    if (!open || !row) {
      setApiRecord(null);
      setContactRows([]);
      setOpportunityRows([]);
      return;
    }
    if (!canLoadServer) {
      setApiRecord(null);
      setContactRows([]);
      setOpportunityRows([]);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    void Promise.all([
      api<ApiCompanyRecord>(`/companies/${row.id}`),
      contactListAll(),
      opportunityListAll(),
    ])
      .then(([company, contacts, opps]) => {
        if (cancelled) return;
        setApiRecord(company);
        setContactRows(contacts);
        setOpportunityRows(Array.isArray(opps) ? opps : []);
      })
      .catch(() => {
        if (!cancelled) {
          setApiRecord(null);
          setContactRows([]);
          setOpportunityRows([]);
        }
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, row?.id, canLoadServer, row]);

  const companyContacts = useMemo(() => {
    if (!row || !canLoadServer || !apiRecord) return [];
    const mapped = contactRows.map(mapApiContactRowToContact);
    return mapped.filter((c) =>
      c.companies?.some((comp) => comp.id === apiRecord.id),
    );
  }, [contactRows, row, canLoadServer, apiRecord]);

  const opportunitiesForCompany = useMemo(() => {
    const fromApi = opportunityRows.map(mapApiOpportunityToOpportunity);
    const contactIds = new Set(companyContacts.map((c) => c.id));
    return fromApi.filter((o) => o.contactId && contactIds.has(o.contactId));
  }, [opportunityRows, companyContacts]);

  const linkedOtherCompanies = useMemo(() => {
    if (!row || !apiRecord) return [];
    const seen = new Set<string>();
    const nameLower = row.name.trim().toLowerCase();
    const out: { id?: string; name: string; urlSlug?: string }[] = [];
    for (const c of companyContacts) {
      for (const comp of c.companies ?? []) {
        const key = (comp.id ?? comp.name).toLowerCase();
        if (comp.name.trim().toLowerCase() === nameLower || seen.has(key)) continue;
        seen.add(key);
        out.push({ id: comp.id, name: comp.name, urlSlug: comp.urlSlug });
      }
    }
    return out;
  }, [companyContacts, row, apiRecord]);

  if (!row) return null;

  const etapa = (canLoadServer && apiRecord?.etapa ? apiRecord.etapa : row.displayEtapa) as Etapa;
  const etapaLabel = etapaLabels[etapa] ?? etapa;
  const fuenteRaw = canLoadServer && apiRecord?.fuente != null ? apiRecord.fuente : row.displayFuente;
  const fuenteLabel =
    fuenteRaw && fuenteRaw in contactSourceLabels
      ? contactSourceLabels[fuenteRaw as ContactSource]
      : fuenteRaw ?? '—';
  const asesor =
    canLoadServer && apiRecord?.user?.name
      ? apiRecord.user.name
      : (row.displayAdvisorName ?? '—');
  const valor =
    canLoadServer && apiRecord
      ? (apiRecord.facturacionEstimada ?? row.totalEstimatedValue)
      : row.totalEstimatedValue;
  const ruc = canLoadServer && apiRecord?.ruc ? apiRecord.ruc : '—';
  const telefono = canLoadServer && apiRecord?.telefono ? apiRecord.telefono : '—';
  const correo = canLoadServer && apiRecord?.correo ? apiRecord.correo : '—';
  const domain = canLoadServer && apiRecord?.domain ? apiRecord.domain : null;
  const rubro =
    canLoadServer && apiRecord?.rubro
      ? companyRubroLabels[apiRecord.rubro as CompanyRubro] ?? apiRecord.rubro
      : row.rubro
        ? companyRubroLabels[row.rubro as CompanyRubro] ?? row.rubro
        : '—';
  const tipo =
    canLoadServer && apiRecord?.tipo
      ? companyTipoLabels[apiRecord.tipo as CompanyTipo] ?? apiRecord.tipo
      : row.tipo
        ? companyTipoLabels[row.tipo as CompanyTipo] ?? row.tipo
        : '—';
  const cliRec =
    canLoadServer && apiRecord?.clienteRecuperado
      ? apiRecord.clienteRecuperado === 'si'
        ? 'Sí'
        : apiRecord.clienteRecuperado === 'no'
          ? 'No'
          : '—'
      : row.clienteRecuperado === 'si'
        ? 'Sí'
        : row.clienteRecuperado === 'no'
          ? 'No'
          : '—';
  const createdAt = canLoadServer && apiRecord?.createdAt ? apiRecord.createdAt : row.createdAt;

  const ubicacion =
    canLoadServer && apiRecord
      ? [apiRecord.departamento, apiRecord.provincia, apiRecord.distrito]
          .map((x) => (x ?? '').trim())
          .filter(Boolean)
          .join(' · ') || ''
      : '';

  const contactCardsFromPreview = row.contactsPreview ?? [];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={rightDrawerSheetContentClass('md', 'min-h-0')}
      >
        <SheetHeader className="space-y-1 border-b pb-4 text-left">
          <SheetTitle className="pr-8 leading-snug">{row.name}</SheetTitle>
          {domain ? (
            <p className="text-sm text-muted-foreground">{domain}</p>
          ) : null}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-2">
          <PreviewRow icon={Funnel} label="Etapa" value={etapaLabel} />
          <PreviewRow icon={Globe} label="Fuente" value={fuenteLabel} />
          <PreviewRow icon={User} label="Asesor" value={asesor} />
          <PreviewRow
            icon={DollarSign}
            label="Facturación / valor estimado"
            value={formatCurrency(valor ?? 0)}
          />
          <PreviewRow icon={Building2} label="RUC" value={ruc} />
          <PreviewRow icon={Phone} label="Teléfono" value={telefono} />
          <PreviewRow icon={Mail} label="Correo" value={correo} />
          <PreviewRow icon={Building2} label="Rubro" value={rubro} />
          <PreviewRow icon={Building2} label="Tipo" value={tipo} />
          <PreviewRow icon={UserCheck} label="Cliente recuperado" value={cliRec} />

          {ubicacion ? (
            <PreviewRow icon={MapPin} label="Ubicación" value={ubicacion} />
          ) : null}
          {canLoadServer && apiRecord?.direccion ? (
            <PreviewRow icon={Home} label="Dirección" value={apiRecord.direccion} />
          ) : null}

          <PreviewRow
            icon={CalendarDays}
            label="Fecha de creación"
            value={formatDate(createdAt)}
          />

          <Separator className="my-3" />

          <PreviewSectionTitle>Contactos vinculados</PreviewSectionTitle>
          {!canLoadServer ? (
            <>
              {contactCardsFromPreview.length === 0 ? (
                <p className="py-1 text-sm text-muted-foreground">Ninguno</p>
              ) : (
                <ul className="space-y-2 pt-1">
                  {contactCardsFromPreview.map((c) => (
                    <li key={c.id} className="text-sm">
                      <Link
                        to={contactDetailHref(c)}
                        className={linkCardClass(true)}
                        onClick={() => onOpenChange(false)}
                      >
                        <span className="flex items-start gap-2 font-medium text-primary">
                          <Users className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                          <span className="break-words">{c.name}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : detailLoading ? (
            <p className="flex items-center gap-2 py-1 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Cargando…
            </p>
          ) : companyContacts.length === 0 ? (
            <p className="py-1 text-sm text-muted-foreground">Ninguno</p>
          ) : (
            <ul className="space-y-2 pt-1">
              {companyContacts.map((c) => {
                const subtitle =
                  [c.cargo?.trim(), c.correo?.trim(), c.telefono?.trim()]
                    .find((s) => s && s !== '-') ?? '';
                return (
                  <li key={c.id} className="text-sm">
                    <Link
                      to={contactDetailHref(c)}
                      className={linkCardClass(true)}
                      onClick={() => onOpenChange(false)}
                    >
                      <span className="flex items-start gap-2 font-medium text-primary">
                        <Users className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                        <span className="break-words">{c.name}</span>
                      </span>
                      {subtitle ? (
                        <span className="line-clamp-2 pl-5 text-xs text-muted-foreground">
                          {subtitle}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          <PreviewSectionTitle>Oportunidades vinculadas</PreviewSectionTitle>
          {!canLoadServer ? (
            <p className="py-1 text-sm text-muted-foreground">Abre la ficha para ver oportunidades</p>
          ) : detailLoading ? (
            <p className="flex items-center gap-2 py-1 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Cargando…
            </p>
          ) : opportunitiesForCompany.length === 0 ? (
            <p className="py-1 text-sm text-muted-foreground">Ninguna</p>
          ) : (
            <ul className="space-y-2 pt-1">
              {opportunitiesForCompany.map((o) => (
                <li key={o.id} className="text-sm">
                  <Link
                    to={opportunityDetailHref(o)}
                    className={linkCardClass(true)}
                    onClick={() => onOpenChange(false)}
                  >
                    <span className="flex items-start gap-2 font-medium text-primary">
                      <Target className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                      <span className="break-words">{o.title}</span>
                    </span>
                    <span className="pl-5 text-xs text-muted-foreground">
                      {formatCurrency(o.amount)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {linkedOtherCompanies.length > 0 ? (
            <>
              <PreviewSectionTitle>Otras empresas vinculadas (vía contactos)</PreviewSectionTitle>
              <ul className="space-y-2 pt-1">
                {linkedOtherCompanies.map((c) => {
                  const href =
                    c.id != null && c.id !== ''
                      ? companyDetailHref({ urlSlug: c.urlSlug, id: c.id })
                      : null;
                  const body = (
                    <span className="flex items-start gap-2 font-medium text-primary">
                      <Building2 className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                      <span className="break-words">{c.name}</span>
                    </span>
                  );
                  return (
                    <li key={`${c.id ?? ''}-${c.name}`} className="text-sm">
                      {href ? (
                        <Link
                          to={href}
                          className={linkCardClass(true)}
                          onClick={() => onOpenChange(false)}
                        >
                          {body}
                        </Link>
                      ) : (
                        <div className={linkCardClass(false)}>{body}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          ) : null}
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
