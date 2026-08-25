import { useEffect, useMemo, useState } from 'react';
import { Copy, Loader2, MessageCircle, Phone, Search, Users } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Pagination } from '@/components/shared/Pagination';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/notify';
import { formatDateDMY } from '@/lib/formatters';
import {
  crmTableHeaderRowClass,
  crmTableBodyRowClassInteractive,
  crmTableFooterClass,
} from '@/lib/crmTableSurface';
import { comercialFilterButtonClass } from '@/lib/comercialFilterSurface';
import type { FlotaMasivoProspecto } from '@/lib/flotaWhatsappApi';
import { FLOTA_PROSPECTO_ESTADOS, formatProspectoEstado } from './prospectoEstado';
import { ConductorCodigoBadge } from './ui/ConductorCodigoBadge';
import { useChatpoolStore } from './store';
import { phoneKey, getConductorCodigo } from './utils';

const estadoColors: Record<string, string> = {
  Nuevo: 'text-gray-700 dark:text-gray-300',
  Afiliado: 'text-purple-700 dark:text-purple-300',
  Citado: 'text-blue-700 dark:text-blue-300',
  Seguimiento: 'text-green-700 dark:text-green-300',
  Informacion: 'text-cyan-700 dark:text-cyan-300',
  'Sin Requisitos': 'text-red-700 dark:text-red-300',
  'No Responde': 'text-yellow-700 dark:text-yellow-300',
};

function prospectPhone(prospecto: FlotaMasivoProspecto): string {
  return (prospecto.celular || prospecto.movil || '').trim();
}

export function ProspectosTableModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const contactProspects = useChatpoolStore((s) => s.contactProspects);
  const contactsLoading = useChatpoolStore((s) => s.contactsLoading);
  const contactsError = useChatpoolStore((s) => s.contactsError);
  const loadContactProspects = useChatpoolStore((s) => s.loadContactProspects);
  const conductorCodigoByPhone = useChatpoolStore((s) => s.conductorCodigoByPhone);
  const openProspectoConversation = useChatpoolStore((s) => s.openProspectoConversation);
  const setSidebarView = useChatpoolStore((s) => s.setSidebarView);

  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterEstado, setFilterEstado] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  useEffect(() => {
    if (open) void loadContactProspects();
  }, [open, loadContactProspects]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const searchQuery = debouncedSearch.toLowerCase();
  const filtered = useMemo(() => {
    const all = contactProspects ?? [];
    return all.filter((p) => {
      if (filterEstado && (p.estado ?? '') !== filterEstado) return false;
      if (!searchQuery) return true;
      const phone = prospectPhone(p);
      return (
        (p.nombreCompleto ?? '').toLowerCase().includes(searchQuery) ||
        phone.toLowerCase().includes(searchQuery)
      );
    });
  }, [contactProspects, filterEstado, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  async function handleOpenChat(prospecto: FlotaMasivoProspecto) {
    try {
      await openProspectoConversation(prospecto);
      setSidebarView('chats');
      onOpenChange(false);
    } catch {
      toast.error('No se pudo abrir la conversación');
    }
  }

  async function handleCopyPhone(prospecto: FlotaMasivoProspecto) {
    const phone = prospectPhone(prospecto);
    if (!phone) return;
    try {
      await navigator.clipboard.writeText(phone);
      toast.success('Número copiado');
    } catch {
      toast.error('No se pudo copiar el número');
    }
  }

  const loading = contactsLoading && contactProspects === null;
  const hasError = contactsError !== null && contactProspects === null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Prospectos del CRM
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#72808f] dark:text-gray-500" />
              <Input
                type="text"
                placeholder="Buscar por nombre o teléfono..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="h-10 rounded-lg border border-[#e1e7ee] bg-white/60 pl-9 text-[13px] shadow-none transition-colors hover:border-primary focus-visible:border-primary dark:border-gray-700 dark:bg-gray-800/60"
              />
            </div>
            <Select
              value={filterEstado ?? '__all__'}
              onValueChange={(value) => {
                setFilterEstado(value === '__all__' ? null : value);
                setPage(1);
              }}
            >
              <SelectTrigger className={comercialFilterButtonClass(false)}>
                <SelectValue placeholder="Filtrar por estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos los estados</SelectItem>
                {FLOTA_PROSPECTO_ESTADOS.map((estado) => (
                  <SelectItem key={estado} value={estado}>
                    {formatProspectoEstado(estado)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center rounded-xl border border-border bg-card/30 py-16 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Cargando prospectos…
            </div>
          ) : hasError ? (
            <div className="flex items-center justify-center rounded-xl border border-border bg-card/30 py-16 text-sm text-muted-foreground">
              {contactsError}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card/30 px-6 py-16 text-center">
              <Users className="mb-3 h-10 w-10 text-muted-foreground opacity-40" />
              <p className="text-sm font-medium text-muted-foreground">Sin prospectos</p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                {debouncedSearch
                  ? 'Prueba con otro término de búsqueda'
                  : filterEstado
                    ? `No hay prospectos en estado ${formatProspectoEstado(filterEstado)}`
                    : 'No hay prospectos en el CRM'}
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-card/30">
              <div className="scrollbar-thin max-h-[55vh] overflow-auto">
                <table className="w-full table-fixed bg-transparent">
                  <colgroup>
                    <col style={{ width: '24%' }} />
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '20%' }} />
                    <col style={{ width: '10%' }} />
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '12%' }} />
                    <col style={{ width: '120px' }} />
                  </colgroup>
                  <thead>
                    <tr className={cn('h-[36px] text-left', crmTableHeaderRowClass)}>
                      <th className="px-3">Nombre</th>
                      <th className="px-3">Red Social</th>
                      <th className="px-3">Celular</th>
                      <th className="px-3">Estado</th>
                      <th className="px-3">F. Registro</th>
                      <th className="px-3">Operador</th>
                      <th className="px-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="bg-transparent">
                    {paged.map((p) => {
                      const phone = prospectPhone(p);
                      const hasPhone = phoneKey(phone).length >= 8;
                      const conductorCodigo = getConductorCodigo(phone, conductorCodigoByPhone);
                      return (
                        <tr
                          key={p.id}
                          className={cn(
                            'h-[48px] bg-transparent last:border-b-0',
                            crmTableBodyRowClassInteractive,
                            !hasPhone && 'opacity-60 cursor-not-allowed',
                          )}
                          onClick={() => {
                            if (hasPhone) void handleOpenChat(p);
                          }}
                          title={hasPhone ? 'Abrir conversación' : 'Sin teléfono válido'}
                        >
                          <td className="px-3 align-middle">
                            <span className="truncate block text-[13px] font-medium text-[#1f2933] dark:text-gray-100">
                              {p.nombreCompleto?.trim() || '—'}
                            </span>
                          </td>
                          <td className="px-3 align-middle">
                            <span className="truncate block max-w-full text-xs text-[#1f2933] dark:text-gray-200">
                              {p.redSocial?.trim() || '—'}
                            </span>
                          </td>
                          <td className="px-3 align-middle">
                            <div className="flex items-center gap-1.5">
                              <Phone className="h-3.5 w-3.5 shrink-0 text-[#72808f] dark:text-gray-500" />
                              <span className="truncate font-mono text-xs text-[#1f2933] dark:text-gray-200">
                                {phone || '—'}
                              </span>
                              {conductorCodigo ? (
                                <ConductorCodigoBadge codigo={conductorCodigo} />
                              ) : null}
                            </div>
                          </td>
                          <td className="px-3 align-middle">
                            <span
                              className={cn(
                                'truncate block max-w-full text-xs',
                                p.estado ? estadoColors[p.estado] || '' : 'text-muted-foreground',
                              )}
                            >
                              {p.estado ? formatProspectoEstado(p.estado) : '—'}
                            </span>
                          </td>
                          <td className="px-3 align-middle">
                            <span className="truncate block max-w-full text-xs text-[#1f2933] dark:text-gray-200">
                              {p.fechaRegistro ? formatDateDMY(p.fechaRegistro) : '—'}
                            </span>
                          </td>
                          <td className="px-3 align-middle">
                            <span className="truncate block max-w-full text-xs text-muted-foreground">
                              {p.operador || '—'}
                            </span>
                          </td>
                          <td className="px-3 align-middle text-right">
                            <div
                              className="flex items-center justify-end gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="h-8 w-8 text-[#72808f] dark:text-gray-400"
                                title="Copiar número"
                                disabled={!hasPhone}
                                onClick={() => void handleCopyPhone(p)}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="h-8 w-8 text-emerald-600 dark:text-emerald-400"
                                title="Iniciar conversación"
                                disabled={!hasPhone}
                                onClick={() => void handleOpenChat(p)}
                              >
                                <MessageCircle className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className={cn('flex items-center justify-end px-3 py-2', crmTableFooterClass)}>
                <Pagination
                  page={currentPage}
                  totalPages={totalPages}
                  onPageChange={setPage}
                  totalItems={filtered.length}
                  pageSize={pageSize}
                  onPageSizeChange={setPageSize}
                />
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
