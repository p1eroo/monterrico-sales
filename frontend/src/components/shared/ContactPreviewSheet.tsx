import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  CalendarDays,
  DollarSign,
  Funnel,
  Globe,
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
import type { Contact } from '@/types';
import { contactSourceLabels, etapaLabels } from '@/data/mock';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { api } from '@/lib/api';
import {
  type ApiContactDetail,
  isLikelyContactCuid,
  linkedContactsFromApiDetail,
  opportunitiesFromApiContactDetail,
} from '@/lib/contactApi';
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
import { Badge } from '@/components/ui/badge';
import { rightDrawerSheetContentClass } from '@/lib/rightPanelShell';
import { cn } from '@/lib/utils';

type ContactPreviewSheetProps = {
  contact: Contact | null;
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

function PreviewSectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground first:mt-2">
      {children}
    </h3>
  );
}

export function ContactPreviewSheet({
  contact,
  open,
  onOpenChange,
  onOpenFullDetail,
  onEdit,
}: ContactPreviewSheetProps) {
  const [linkDetail, setLinkDetail] = useState<ApiContactDetail | null>(null);
  const [linksLoading, setLinksLoading] = useState(false);

  useEffect(() => {
    if (!open || !contact?.id || !isLikelyContactCuid(contact.id)) {
      setLinkDetail(null);
      return;
    }
    let cancelled = false;
    setLinksLoading(true);
    void api<ApiContactDetail>(`/contacts/${contact.id}`)
      .then((row) => {
        if (!cancelled) setLinkDetail(row);
      })
      .catch(() => {
        if (!cancelled) setLinkDetail(null);
      })
      .finally(() => {
        if (!cancelled) setLinksLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, contact?.id]);

  const linkedContacts = useMemo(
    () => (linkDetail ? linkedContactsFromApiDetail(linkDetail) : []),
    [linkDetail],
  );
  const linkedOpportunities = useMemo(
    () => (linkDetail ? opportunitiesFromApiContactDetail(linkDetail) : []),
    [linkDetail],
  );

  const companiesSorted = useMemo(() => {
    if (!contact) return [];
    const list = [...(contact.companies ?? [])];
    list.sort((a, b) => {
      if (a.isPrimary && !b.isPrimary) return -1;
      if (!a.isPrimary && b.isPrimary) return 1;
      return a.name.localeCompare(b.name, 'es');
    });
    return list;
  }, [contact]);

  if (!contact) return null;

  const cliRec =
    contact.clienteRecuperado === 'si'
      ? 'Sí'
      : contact.clienteRecuperado === 'no'
        ? 'No'
        : '—';

  const etapaLabel = etapaLabels[contact.etapa] ?? contact.etapa;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={rightDrawerSheetContentClass('md', 'min-h-0')}
      >
        <SheetHeader className="space-y-1 border-b pb-4 text-left">
          <SheetTitle className="pr-8 leading-snug">{contact.name}</SheetTitle>
          {contact.cargo ? (
            <p className="text-sm text-muted-foreground">{contact.cargo}</p>
          ) : null}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-2">
          <PreviewRow icon={Funnel} label="Etapa" value={etapaLabel} />
          <PreviewRow icon={Phone} label="Teléfono" value={contact.telefono} />
          <PreviewRow icon={Mail} label="Correo" value={contact.correo} />
          <PreviewRow icon={Globe} label="Fuente" value={contactSourceLabels[contact.fuente] ?? contact.fuente} />
          <PreviewRow icon={User} label="Asesor" value={contact.assignedToName ?? 'Sin asignar'} />
          <PreviewRow icon={DollarSign} label="Valor estimado" value={formatCurrency(contact.estimatedValue)} />
          <PreviewRow icon={UserCheck} label="Cliente recuperado" value={cliRec} />

          {(contact.departamento || contact.direccion) && (
            <>
              <Separator className="my-2" />
              {contact.departamento ? (
                <PreviewRow icon={MapPin} label="Ubicación" value={contact.departamento} />
              ) : null}
              {contact.direccion ? (
                <div className="py-2 text-sm text-muted-foreground">
                  <span className="text-xs">Dirección: </span>
                  {contact.direccion}
                </div>
              ) : null}
            </>
          )}

          <PreviewRow
            icon={CalendarDays}
            label="Fecha de creación"
            value={formatDate(contact.createdAt)}
          />

          <Separator className="my-3" />

          <PreviewSectionTitle>Empresas vinculadas</PreviewSectionTitle>
          {companiesSorted.length === 0 ? (
            <p className="py-1 text-sm text-muted-foreground">Ninguna</p>
          ) : (
            <ul className="space-y-2 pt-1">
              {companiesSorted.map((c) => {
                const href =
                  c.id != null && c.id !== ''
                    ? companyDetailHref({ urlSlug: c.urlSlug, id: c.id })
                    : null;
                const cardClass = cn(
                  'flex flex-col gap-0.5 rounded-md border border-border/60 bg-card/40 px-3 py-2 transition-colors',
                  href &&
                    'cursor-pointer hover:border-primary/40 hover:bg-card/80',
                );
                const body = (
                  <>
                    <span className="flex items-start gap-2 font-medium text-primary">
                      <Building2 className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                      <span className="break-words">{c.name}</span>
                    </span>
                    {c.isPrimary ? (
                      <span className="pl-5">
                        <Badge variant="secondary" className="text-[10px] font-normal">
                          Principal
                        </Badge>
                      </span>
                    ) : null}
                  </>
                );
                return (
                  <li key={`${c.id ?? c.name}-${c.name}`} className="text-sm">
                    {href ? (
                      <Link
                        to={href}
                        className={cardClass}
                        onClick={() => onOpenChange(false)}
                      >
                        {body}
                      </Link>
                    ) : (
                      <div className={cardClass}>{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <PreviewSectionTitle>Contactos vinculados</PreviewSectionTitle>
          {linksLoading ? (
            <p className="flex items-center gap-2 py-1 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Cargando…
            </p>
          ) : linkedContacts.length === 0 ? (
            <p className="py-1 text-sm text-muted-foreground">Ninguno</p>
          ) : (
            <ul className="space-y-2 pt-1">
              {linkedContacts.map((c) => {
                const subtitle =
                  [c.cargo?.trim(), c.correo?.trim(), c.telefono?.trim()]
                    .find((s) => s && s !== '-') ?? '';
                return (
                  <li key={c.id} className="text-sm">
                    <Link
                      to={contactDetailHref(c)}
                      className={cn(
                        'flex cursor-pointer flex-col gap-0.5 rounded-md border border-border/60 bg-card/40 px-3 py-2 transition-colors',
                        'hover:border-primary/40 hover:bg-card/80',
                      )}
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
          {linksLoading ? (
            <p className="flex items-center gap-2 py-1 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Cargando…
            </p>
          ) : linkedOpportunities.length === 0 ? (
            <p className="py-1 text-sm text-muted-foreground">Ninguna</p>
          ) : (
            <ul className="space-y-2 pt-1">
              {linkedOpportunities.map((o) => (
                <li key={o.id} className="text-sm">
                  <Link
                    to={opportunityDetailHref(o)}
                    className={cn(
                      'flex flex-col gap-0.5 rounded-md border border-border/60 bg-card/40 px-3 py-2 transition-colors',
                      'hover:border-primary/40 hover:bg-card/80',
                    )}
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
