import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, FileText, Loader2, MoreVertical, RefreshCw, Search, UserPlus } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { GlassCard } from '@/components/shared/GlassCard';
import { EmptyState } from '@/components/shared/EmptyState';
import { Pagination } from '@/components/shared/Pagination';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from '@/lib/notify';
import { cn } from '@/lib/utils';
import {
  crmTableBodyRowClass,
  crmTableFooterClass,
  crmTableHeaderRowClass,
} from '@/lib/crmTableSurface';
import { comercialTableCheckboxWrapClass } from '@/lib/comercialTableLayout';
import {
  fetchFacebookAccounts, syncFacebookForms, syncFacebookLeads,
  type FacebookAccount, type FacebookForm,
} from '@/lib/marketingApi';

type FormRow = FacebookForm & { accountId: string; pageName: string };

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export default function MarketingFacebook() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<FacebookAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingForms, setSyncingForms] = useState(false);
  const [syncingFormId, setSyncingFormId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [pageFilter, setPageFilter] = useState('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchFacebookAccounts();
      setAccounts(data);
    } catch {
      // empty
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const forms: FormRow[] = useMemo(
    () => accounts.flatMap((a) => a.forms.map((f) => ({ ...f, accountId: a.id, pageName: a.pageName }))),
    [accounts],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return forms.filter((f) => {
      if (pageFilter !== 'all' && f.accountId !== pageFilter) return false;
      if (statusFilter !== 'all' && f.status !== statusFilter) return false;
      if (!q) return true;
      return f.name.toLowerCase().includes(q) || f.pageName.toLowerCase().includes(q) || f.facebookFormId.includes(q);
    });
  }, [forms, search, statusFilter, pageFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageSafe = Math.min(page, totalPages);
  const paged = filtered.slice((pageSafe - 1) * pageSize, pageSafe * pageSize);
  const allPageSelected = paged.length > 0 && paged.every((f) => selected.has(f.id));

  const handleSyncAllForms = async () => {
    if (accounts.length === 0) return;
    setSyncingForms(true);
    try {
      await Promise.all(accounts.map((a) => syncFacebookForms(a.id)));
      toast.success('Formularios sincronizados');
      await load();
    } catch {
      toast.error('Error al sincronizar formularios');
    } finally {
      setSyncingForms(false);
    }
  };

  const handleSyncFormLeads = async (form: FormRow) => {
    setSyncingFormId(form.id);
    try {
      const r = await syncFacebookLeads(form.accountId, form.id);
      toast.success(`${r.imported} leads importados de "${form.name}"`);
      await load();
      navigate(`/marketing/leads?formId=${form.id}`);
    } catch {
      toast.error('Error al sincronizar');
    } finally {
      setSyncingFormId(null);
    }
  };

  const toggleSelectAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        for (const f of paged) next.delete(f.id);
      } else {
        for (const f of paged) next.add(f.id);
      }
      return next;
    });
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div>
      <PageHeader
        title="Facebook"
        description="Formularios de Lead Ads de las páginas conectadas"
        className="mb-4"
      >
        {accounts.length > 0 && (
          <Button
            className="h-9 text-sm font-normal shadow-md"
            onClick={() => void handleSyncAllForms()}
            disabled={syncingForms}
          >
            {syncingForms ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Sinc. Formularios
          </Button>
        )}
      </PageHeader>

      {loading ? (
        <GlassCard>
          <div className="flex min-h-[280px] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </GlassCard>
      ) : accounts.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No hay una página conectada"
          description="Conecta la página en Integraciones para ver los formularios."
          actionLabel="Ir a Integraciones"
          onAction={() => navigate('/marketing/integrations')}
        />
      ) : (
        <GlassCard>
          <div className="flex min-w-0 flex-col gap-2 px-5 py-3 lg:flex-row lg:items-center">
            <div className="relative w-full min-w-0 max-w-[400px]">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#8a9aab] dark:text-gray-400" />
              <Input
                placeholder="Buscar por formulario o página..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="!h-10 rounded-lg border border-[#e1e7ee] dark:border-gray-700 bg-white/60 dark:bg-gray-800/60 pl-8 text-[13px] text-black dark:text-gray-100 placeholder:text-[#8a9aab] dark:placeholder:text-gray-400 transition-colors hover:border-primary focus-visible:ring-1 shadow-none"
              />
            </div>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    '!h-10 w-[190px] rounded-lg border border-[#e1e7ee] dark:border-gray-700 bg-white/60 dark:bg-gray-800/60 px-3 text-[13px] hover:border-primary transition-colors shadow-none cursor-pointer flex items-center gap-1.5 text-left',
                    statusFilter === 'all' ? 'text-[#8a9aab] dark:text-gray-400' : 'text-black dark:text-gray-100',
                  )}
                >
                  <span className="truncate flex-1">
                    {statusFilter === 'all' ? 'Estado' : statusFilter === 'active' ? 'Activo' : 'Inactivo'}
                  </span>
                  <ChevronDown className="size-3.5 shrink-0 opacity-50" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-[180px] p-1.5" align="start" sideOffset={8}>
                {([
                  ['all', 'Todos'],
                  ['active', 'Activo'],
                  ['inactive', 'Inactivo'],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                    onClick={() => {
                      setStatusFilter(value);
                      setPage(1);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
            {accounts.length > 1 && (
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className={cn(
                      '!h-10 w-[190px] rounded-lg border border-[#e1e7ee] dark:border-gray-700 bg-white/60 dark:bg-gray-800/60 px-3 text-[13px] hover:border-primary transition-colors shadow-none cursor-pointer flex items-center gap-1.5 text-left',
                      pageFilter === 'all' ? 'text-[#8a9aab] dark:text-gray-400' : 'text-black dark:text-gray-100',
                    )}
                  >
                    <span className="truncate flex-1">
                      {pageFilter === 'all' ? 'Página' : accounts.find((a) => a.id === pageFilter)?.pageName ?? 'Página'}
                    </span>
                    <ChevronDown className="size-3.5 shrink-0 opacity-50" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-[220px] p-1.5" align="start" sideOffset={8}>
                  <button
                    type="button"
                    className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                    onClick={() => { setPageFilter('all'); setPage(1); }}
                  >
                    Todas
                  </button>
                  {accounts.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      className="flex w-full items-center rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                      onClick={() => { setPageFilter(a.id); setPage(1); }}
                    >
                      {a.pageName}
                    </button>
                  ))}
                </PopoverContent>
              </Popover>
            )}
          </div>

          {forms.length === 0 ? (
            <div className="border-t border-border/40 p-5">
              <EmptyState
                icon={FileText}
                title="No hay formularios"
                description="Sincroniza para obtenerlos desde Facebook."
                actionLabel="Sinc. Formularios"
                onAction={() => void handleSyncAllForms()}
              />
            </div>
          ) : filtered.length === 0 ? (
            <div className="border-t border-border/40 p-8 text-center text-sm text-muted-foreground">
              No hay formularios que coincidan con el filtro.
            </div>
          ) : (
            <div className="max-h-[calc(100vh-330px)] overflow-auto border-t border-border/40 scrollbar-thin">
              <table className="w-full">
                <thead>
                  <tr className={cn('h-[36px] text-left', crmTableHeaderRowClass)}>
                    <th className="w-11 px-2">
                      <div className={comercialTableCheckboxWrapClass}>
                        <Checkbox
                          checked={allPageSelected}
                          onCheckedChange={toggleSelectAll}
                          className="h-4 w-4 rounded border border-gray-400 data-[state=checked]:border-primary data-[state=checked]:bg-primary"
                        />
                      </div>
                    </th>
                    <th className="w-10" />
                    <th className="px-3 text-[11px] font-bold">Formulario</th>
                    <th className="px-3 text-[11px] font-bold">Página</th>
                    <th className="px-3 text-[11px] font-bold">Estado</th>
                    <th className="px-3 text-center text-[11px] font-bold">Leads</th>
                    <th className="px-3 text-[11px] font-bold">Último lead</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((f) => {
                    const busy = syncingFormId === f.id;
                    const active = f.status === 'active';
                    return (
                      <tr
                        key={f.id}
                        className={cn('h-[48px] last:border-b-0 cursor-pointer', crmTableBodyRowClass)}
                        onClick={() => navigate(`/marketing/leads?formId=${f.id}`)}
                      >
                        <td className="w-11 px-2" onClick={(e) => e.stopPropagation()}>
                          <div className={comercialTableCheckboxWrapClass}>
                            <Checkbox
                              checked={selected.has(f.id)}
                              onCheckedChange={() => toggleSelect(f.id)}
                              className="h-4 w-4 rounded border border-gray-400 data-[state=checked]:border-primary data-[state=checked]:bg-primary"
                            />
                          </div>
                        </td>
                        <td className="w-10" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon-sm" aria-label="Acciones" disabled={busy}>
                                {busy ? <Loader2 className="size-4 animate-spin" /> : <MoreVertical className="size-4" />}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                              <DropdownMenuItem onClick={() => void handleSyncFormLeads(f)}>
                                <RefreshCw /> Sincronizar leads
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => navigate(`/marketing/leads?formId=${f.id}`)}>
                                <UserPlus /> Ver leads
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                        <td className="px-3">
                          <div className="flex min-w-0 items-center gap-2">
                            <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                              <FileText className="size-4 text-muted-foreground" />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-[13px] font-semibold text-[#0F172A] dark:text-gray-100" title={f.name}>
                                {f.name}
                              </p>
                              <p className="truncate font-mono text-[11px] text-muted-foreground">{f.facebookFormId}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3">
                          <span className="text-[13px] text-[#475569] dark:text-gray-400">{f.pageName}</span>
                        </td>
                        <td className="px-3">
                          <Badge
                            variant="outline"
                            className={cn(
                              'inline-flex h-6 items-center rounded-full px-2.5 text-[11px] font-semibold',
                              active
                                ? 'border-emerald-300/60 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200'
                                : 'border-border bg-muted text-muted-foreground',
                            )}
                          >
                            {active ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </td>
                        <td className="px-3">
                          <div className="flex justify-center">
                            <span className="inline-flex size-7 items-center justify-center rounded-full bg-muted text-[12px] font-medium text-[#0F172A] dark:text-gray-100">
                              {f.leadsCount}
                            </span>
                          </div>
                        </td>
                        <td className="px-3">
                          <span className="text-[13px] text-[#475569] dark:text-gray-400">
                            {f.lastLeadAt ? new Date(f.lastLeadAt).toLocaleDateString('es-PE') : '—'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {filtered.length > 0 && (
            <div className={cn('flex h-14 items-center px-5', crmTableFooterClass)}>
              <Pagination
                page={pageSafe}
                totalPages={totalPages}
                onPageChange={setPage}
                totalItems={filtered.length}
                pageSize={pageSize}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setPage(1);
                }}
                pageSizeOptions={PAGE_SIZE_OPTIONS}
              />
            </div>
          )}
        </GlassCard>
      )}
    </div>
  );
}
