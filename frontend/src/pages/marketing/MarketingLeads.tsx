import { useState, useEffect, useMemo } from 'react';
import { Search, RefreshCw, Loader2, Calendar, Filter } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Pagination } from '@/components/shared/Pagination';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { fetchFacebookLeads, fetchFacebookForms, syncFacebookLeads, type FacebookLead, type FacebookForm } from '@/lib/marketingApi';
import { toast } from 'sonner';

export default function MarketingLeads() {
  const [leads, setLeads] = useState<FacebookLead[]>([]);
  const [forms, setForms] = useState<FacebookForm[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [formFilter, setFormFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const load = async (p: number) => {
    setLoading(true);
    try {
      const res = await fetchFacebookLeads({
        page: p,
        limit: pageSize,
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
    try {
      const data = await fetchFacebookForms();
      setForms(data);
    } catch {
      // ignore
    }
  };

  useEffect(() => { loadForms(); }, []);

  useEffect(() => {
    setPage(1);
    load(1);
  }, [search, formFilter, dateFrom, dateTo, pageSize]);

  useEffect(() => { load(page); }, [page]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const handleSync = async () => {
    setSyncing(true);
    try {
      const accountsRes = await fetch('/api/facebook/accounts');
      const accounts = await accountsRes.json() as { id: string }[];
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
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, teléfono o email..."
            className="h-9 pl-9 text-sm bg-card"
          />
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
                {forms.map((f) => (
                  <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                ))}
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

      <div className="rounded-xl border bg-card overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="py-3">Nombre</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Formulario</TableHead>
              <TableHead>Anuncio</TableHead>
              <TableHead>Fecha</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                  <Loader2 className="mx-auto size-5 animate-spin" />
                </TableCell>
              </TableRow>
            ) : leads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                  {search || formFilter !== 'all' || dateFrom || dateTo
                    ? 'Sin resultados'
                    : 'No hay leads importados aún. Conecta tu página de Facebook y sincroniza.'}
                </TableCell>
              </TableRow>
            ) : (
              leads.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell className="py-3 font-medium">{lead.fullName || '—'}</TableCell>
                  <TableCell className="py-3 font-mono text-xs">{lead.phone || '—'}</TableCell>
                  <TableCell className="py-3 text-muted-foreground">{lead.email || '—'}</TableCell>
                  <TableCell className="py-3">
                    <Badge className="bg-blue-100 text-blue-700 text-xs">{lead.form.name}</Badge>
                  </TableCell>
                  <TableCell className="py-3 text-xs text-muted-foreground max-w-[160px] truncate" title={lead.adName || undefined}>
                    {lead.adName || '—'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(lead.createdTime).toLocaleDateString('es-PE', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          totalItems={total}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={[10, 25, 50]}
        />
      )}
    </div>
  );
}
