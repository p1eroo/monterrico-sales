import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, RefreshCw, Loader2, Calendar, Filter, Eye, Send, CheckCircle2, Trash2, AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import { Pagination } from '@/components/shared/Pagination';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  fetchFacebookLeads, fetchFacebookForms, fetchFacebookAccounts, syncFacebookLeads,
  sendLeadToComercial, sendLeadToFlota, deleteFacebookLead, bulkDeleteFacebookLeads,
  type FacebookLead, type FacebookForm,
} from '@/lib/marketingApi';
import { toast } from 'sonner';

function LeadDetailModal({ lead, open, onOpenChange, onSent }: { lead: FacebookLead | null; open: boolean; onOpenChange: (v: boolean) => void; onSent: () => void }) {
  const [sendingComercial, setSendingComercial] = useState(false);
  const [sendingFlota, setSendingFlota] = useState(false);

  if (!lead) return null;

  const fieldData = (lead.fieldData || []) as Array<{ name: string; values: string[] }>;

  const handleSendComercial = async () => {
    setSendingComercial(true);
    try {
      await sendLeadToComercial(lead.id);
      toast.success('Lead enviado a Comercial como Contacto');
      onSent();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al enviar');
    } finally {
      setSendingComercial(false);
    }
  };

  const handleSendFlota = async () => {
    setSendingFlota(true);
    try {
      await sendLeadToFlota(lead.id);
      toast.success('Lead enviado a Flota como Prospecto');
      onSent();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al enviar');
    } finally {
      setSendingFlota(false);
    }
  };

  const alreadyComercial = !!lead.importedAsContactId;
  const alreadyFlota = !!lead.importedAsFlotaProspectoId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalle del Lead</DialogTitle>
          <DialogDescription>
            Formulario: {lead.form.name} · {new Date(lead.createdTime).toLocaleString('es-PE')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><p className="text-xs text-muted-foreground mb-1">Nombre</p><p className="text-sm font-medium">{lead.fullName || '—'}</p></div>
            <div><p className="text-xs text-muted-foreground mb-1">Teléfono</p><p className="text-sm font-medium font-mono">{lead.phone || '—'}</p></div>
            <div><p className="text-xs text-muted-foreground mb-1">Email</p><p className="text-sm font-medium">{lead.email || '—'}</p></div>
            <div><p className="text-xs text-muted-foreground mb-1">Anuncio</p><p className="text-sm font-medium">{lead.adName || '—'}</p></div>
          </div>
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-xs text-muted-foreground mb-3 font-medium">Campos del formulario</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
              {fieldData.map((f, i) => (
                <div key={i} className="flex flex-col">
                  <span className="text-xs text-muted-foreground">{f.name}</span>
                  <span className="text-sm">{f.values?.join(', ') || '—'}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="default" className="flex-1 gap-2" onClick={handleSendComercial} disabled={sendingComercial || alreadyComercial}>
              {alreadyComercial ? <CheckCircle2 className="size-4" /> : <Send className="size-4" />}
              {sendingComercial ? <Loader2 className="size-4 animate-spin" /> : null}
              {alreadyComercial ? 'Enviado a Comercial' : 'Enviar a Comercial'}
            </Button>
            <Button variant="outline" className="flex-1 gap-2" onClick={handleSendFlota} disabled={sendingFlota || alreadyFlota}>
              {alreadyFlota ? <CheckCircle2 className="size-4" /> : <Send className="size-4" />}
              {sendingFlota ? <Loader2 className="size-4 animate-spin" /> : null}
              {alreadyFlota ? 'Enviado a Flota' : 'Enviar a Flota'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type DeleteTarget = {
  type: 'single' | 'bulk';
  id?: string;
  count?: number;
  name?: string;
};

export default function MarketingLeads() {
  const [searchParams] = useSearchParams();
  const [leads, setLeads] = useState<FacebookLead[]>([]);
  const [forms, setForms] = useState<FacebookForm[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [formFilter, setFormFilter] = useState(searchParams.get('formId') || 'all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [detailLead, setDetailLead] = useState<FacebookLead | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectAllMode, setSelectAllMode] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);

  const load = async (p: number) => {
    setLoading(true);
    try {
      const res = await fetchFacebookLeads({
        page: p, limit: pageSize,
        search: search || undefined,
        formId: formFilter !== 'all' ? formFilter : undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      setLeads(res.data);
      setTotal(res.total);
    } catch {
      setLeads([]);
    } finally {
      setLoading(false);
    }
  };

  const loadForms = async () => {
    try { const data = await fetchFacebookForms(); setForms(data); } catch {}
  };

  useEffect(() => { loadForms(); }, []);

  useEffect(() => {
    setPage(1);
    setSelected(new Set());
    setSelectAllMode(false);
    load(1);
  }, [search, formFilter, dateFrom, dateTo, pageSize]);

  useEffect(() => { load(page); }, [page]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const handleSync = async () => {
    setSyncing(true);
    try {
      const accounts = await fetchFacebookAccounts();
      let totalImported = 0;
      for (const acc of accounts) {
        const r = await syncFacebookLeads(acc.id);
        totalImported += r.imported;
      }
      toast.success(`${totalImported} leads importados`);
      load(page);
    } catch {
      toast.error('Error al sincronizar');
    } finally {
      setSyncing(false);
    }
  };

  const toggleSelect = (id: string) => {
    if (selectAllMode) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectAllMode) {
      setSelectAllMode(false);
      setSelected(new Set());
      return;
    }
    if (selected.size === leads.length) {
      setSelected(new Set());
    } else {
      const allOnPage = new Set(leads.map((l) => l.id));
      if (leads.length < total) {
        setSelected(allOnPage);
        setSelectAllMode(false);
      } else {
        setSelected(allOnPage);
      }
    }
  };

  const handleSelectAllPages = () => {
    setSelectAllMode(true);
    setSelected(new Set(leads.map((l) => l.id)));
  };

  const executeDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.type === 'single' && deleteTarget.id) {
        await deleteFacebookLead(deleteTarget.id);
        toast.success('Lead eliminado');
      } else {
        const result = await bulkDeleteFacebookLeads(
          selectAllMode
            ? {
                selectAll: true,
                formId: formFilter !== 'all' ? formFilter : undefined,
                search: search || undefined,
                dateFrom: dateFrom || undefined,
                dateTo: dateTo || undefined,
              }
            : { ids: Array.from(selected) },
        );
        toast.success(`${result.deleted} lead(s) eliminados`);
      }
      setDeleteTarget(null);
      setSelected(new Set());
      setSelectAllMode(false);
      load(page);
    } catch {
      toast.error('Error al eliminar');
    } finally {
      setDeleting(false);
    }
  };

  const allPageSelected = leads.length > 0 && selected.size === leads.length;

  return (
    <div className="space-y-6">
      <PageHeader title="Leads Facebook" description="Leads importados desde formularios de Facebook Lead Ads">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleSync} disabled={syncing}>
            {syncing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Sincronizar
          </Button>
        </div>
      </PageHeader>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative max-w-md flex-1 min-w-[240px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre, teléfono o email..." className="h-9 pl-9 text-sm bg-card" />
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Filter className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Select value={formFilter} onValueChange={setFormFilter}>
              <SelectTrigger className="h-9 w-44 pl-8 text-xs bg-card">
                <SelectValue placeholder="Todos los formularios" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los formularios</SelectItem>
                {forms.map((f) => (<SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Calendar className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="h-9 w-40 pl-8 text-xs bg-card" />
          </div>
          <span className="text-xs text-muted-foreground">—</span>
          <div className="relative">
            <Calendar className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="h-9 w-40 pl-8 text-xs bg-card" />
          </div>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/50 px-4 py-2.5">
          {selectAllMode ? (
            <span className="text-sm font-medium">Todos los {total} leads seleccionados</span>
          ) : (
            <span className="text-sm font-medium">{selected.size} de {total} seleccionados</span>
          )}
          {!selectAllMode && allPageSelected && total > leads.length && (
            <Button variant="link" size="sm" className="gap-1 text-xs px-1" onClick={handleSelectAllPages}>
              Seleccionar todos los {total} leads
            </Button>
          )}
          <Button
            variant="destructive" size="sm" className="gap-1.5 ml-auto"
            onClick={() => setDeleteTarget({ type: 'bulk', count: selectAllMode ? total : selected.size })}
          >
            <Trash2 className="size-4" />
            Eliminar {selectAllMode ? `(${total})` : `(${selected.size})`}
          </Button>
        </div>
      )}

      <div className="rounded-xl border bg-card overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-10 py-3">
                <Checkbox
                  checked={selectAllMode || (leads.length > 0 && selected.size === leads.length)}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead className="py-3">Nombre</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Formulario</TableHead>
              <TableHead>Destino</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead className="text-center">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} className="py-12 text-center text-muted-foreground"><Loader2 className="mx-auto size-5 animate-spin" /></TableCell></TableRow>
            ) : leads.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                {search || formFilter !== 'all' || dateFrom || dateTo ? 'Sin resultados' : 'No hay leads importados aún.'}
              </TableCell></TableRow>
            ) : (
              leads.map((lead) => (
                <TableRow key={lead.id} className={selected.has(lead.id) || selectAllMode ? 'bg-muted/30' : ''}>
                  <TableCell className="py-3">
                    <Checkbox checked={selectAllMode || selected.has(lead.id)} onCheckedChange={() => toggleSelect(lead.id)} disabled={selectAllMode} />
                  </TableCell>
                  <TableCell className="py-3 font-medium">{lead.fullName || '—'}</TableCell>
                  <TableCell className="py-3 font-mono text-xs">{lead.phone || '—'}</TableCell>
                  <TableCell className="py-3 text-muted-foreground">{lead.email || '—'}</TableCell>
                  <TableCell className="py-3"><Badge className="bg-blue-100 text-blue-700 text-xs">{lead.form.name}</Badge></TableCell>
                  <TableCell className="py-3">
                    {lead.importedAsContactId ? (
                      <Badge className="bg-emerald-100 text-emerald-700 text-xs gap-1"><CheckCircle2 className="size-3" /> Comercial</Badge>
                    ) : lead.importedAsFlotaProspectoId ? (
                      <Badge className="bg-amber-100 text-amber-700 text-xs gap-1"><CheckCircle2 className="size-3" /> Flota</Badge>
                    ) : (<span className="text-xs text-muted-foreground">Pendiente</span>)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(lead.createdTime).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="flex items-center justify-center gap-1">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setDetailLead(lead)} title="Ver detalle"><Eye className="size-3.5" /></Button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-600" onClick={() => setDeleteTarget({ type: 'single', id: lead.id, name: lead.fullName || 'este lead' })} title="Eliminar"><Trash2 className="size-3.5" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} totalItems={total} pageSize={pageSize}
          onPageChange={setPage} onPageSizeChange={setPageSize} pageSizeOptions={[10, 25, 50]} />
      )}

      {/* Delete confirmation modal */}
      <Dialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-full bg-red-100">
                <AlertTriangle className="size-5 text-red-600" />
              </div>
              <div>
                <DialogTitle>Eliminar lead{deleteTarget?.type === 'bulk' ? 's' : ''}</DialogTitle>
                <DialogDescription>
                  Esta acción no se puede deshacer.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="py-2">
            {deleteTarget?.type === 'single' ? (
              <p className="text-sm">
                ¿Estás seguro de eliminar <strong>{deleteTarget.name}</strong>?
              </p>
            ) : (
              <p className="text-sm">
                ¿Estás seguro de eliminar <strong>{deleteTarget?.count ?? 0} lead(s)</strong>?
                {selectAllMode && (
                  <span className="block mt-1 text-xs text-muted-foreground">
                    Se eliminarán todos los leads que coinciden con el filtro actual.
                  </span>
                )}
              </p>
            )}
          </div>

          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button variant="outline" size="sm">Cancelar</Button>
            </DialogClose>
            <Button
              variant="destructive"
              size="sm"
              className="gap-1.5"
              onClick={executeDelete}
              disabled={deleting}
            >
              {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              {deleting ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <LeadDetailModal lead={detailLead} open={!!detailLead}
        onOpenChange={(v) => { if (!v) setDetailLead(null); }}
        onSent={() => load(page)} />
    </div>
  );
}
