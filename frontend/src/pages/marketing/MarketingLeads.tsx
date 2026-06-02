import { useState, useEffect, useMemo } from 'react';
import { Search, RefreshCw, Loader2, Calendar } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Pagination } from '@/components/shared/Pagination';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { fetchLeads, type MarketingLead } from '@/lib/marketingApi';
import { toast } from 'sonner';

const SOURCE_COLORS: Record<string, string> = {
  facebook: 'bg-blue-100 text-blue-700',
  tiktok: 'bg-black/10 text-black dark:bg-white/10 dark:text-white',
};

export default function MarketingLeads() {
  const [leads, setLeads] = useState<MarketingLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    fetchLeads().then((res) => { setLeads(res.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let list = leads;
    if (search.trim()) {
      const s = search.trim().toLowerCase();
      list = list.filter((l) => l.fullName.toLowerCase().includes(s) || l.phone.includes(s) || l.email.toLowerCase().includes(s));
    }
    if (dateFrom) {
      list = list.filter((l) => l.createdAt >= dateFrom);
    }
    if (dateTo) {
      list = list.filter((l) => l.createdAt.split('T')[0] <= dateTo);
    }
    return list;
  }, [leads, search, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => { setPage(1); }, [search, dateFrom, dateTo]);

  return (
    <div className="space-y-6">
      <PageHeader title="Leads" description="Importaciones de formularios externos">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => { toast.success('Sincronización iniciada (mock)'); }}>
            <RefreshCw className="size-4" /> Sincronizar
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
              <TableHead>Campaña</TableHead>
              <TableHead>Fuente</TableHead>
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
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                  {search ? 'Sin resultados' : 'No hay leads importados aún'}
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell className="py-3 font-medium">{lead.fullName}</TableCell>
                  <TableCell className="py-3 font-mono text-xs">{lead.phone}</TableCell>
                  <TableCell className="py-3 text-muted-foreground">{lead.email}</TableCell>
                  <TableCell className="py-3">{lead.campaignName}</TableCell>
                  <TableCell className="py-3">
                    <Badge className={`text-xs ${SOURCE_COLORS[lead.source] || 'bg-gray-100 text-gray-700'}`}>
                      {lead.source}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(lead.createdAt).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
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
          totalItems={filtered.length}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={[10, 25, 50]}
        />
      )}
    </div>
  );
}
