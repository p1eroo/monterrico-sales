import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Send,
  Copy,
  Pencil,
  BarChart3,
  Plus,
  Search,
  MoreHorizontal,
  Mail,
  Smartphone,
  Trash2,
} from 'lucide-react';
import type { CampaignListItem, CampaignStatus } from '@/types';
import { deleteCampaignApi, listCampaignSummariesApi } from '@/lib/campaignApi';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PageHeader } from '@/components/shared/PageHeader';
import { formatDate } from '@/lib/formatters';
import { toast } from 'sonner';

const STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: 'Borrador',
  sending: 'Enviando',
  sent: 'Enviada',
  failed: 'Fallida',
  cancelled: 'Cancelada',
};

const STATUS_VARIANTS: Record<CampaignStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'secondary',
  sending: 'default',
  sent: 'default',
  failed: 'destructive',
  cancelled: 'secondary',
};

const CHANNEL_ICONS = {
  email: Mail,
  sms: Smartphone,
  whatsapp: Smartphone,
} as const;

const PAGE_SIZE = 30;

export default function CampaignHistoryPage() {
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const [searchInput, setSearchInput] = useState('');
  const [serverSearch, setServerSearch] = useState('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<CampaignListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setServerSearch(searchInput.trim()), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [serverSearch]);

  const refresh = useCallback(() => {
    setPage(1);
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await listCampaignSummariesApi({
          page,
          limit: PAGE_SIZE,
          search: serverSearch || undefined,
        });
        if (cancelled) return;
        setLoadError(null);
        setTotal(res.total);
        setItems((prev) => (page === 1 ? res.items : [...prev, ...res.items]));
      } catch (e) {
        if (!cancelled) {
          setLoadError(e instanceof Error ? e.message : 'Error al cargar campañas');
          if (page === 1) setItems([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [page, serverSearch, refreshKey]);

  const hasMore = items.length < total;

  const handleDelete = async (c: CampaignListItem) => {
    if (!hasPermission('campanas.crear')) return;
    if (!window.confirm(`¿Eliminar la campaña «${c.name}»?`)) return;
    try {
      await deleteCampaignApi(c.id);
      toast.success('Campaña eliminada');
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo eliminar');
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Historial de campañas"
        description={
          loadError
            ? `No se pudo cargar el historial desde el servidor: ${loadError}`
            : 'Gestiona y revisa el historial de campañas de mensajería masiva'
        }
      >
        <Button
          className="bg-[#13944C] hover:bg-[#0f7a3d]"
          onClick={() => navigate('/campaigns/new')}
        >
          <Plus className="size-4" />
          Nueva campaña
        </Button>
      </PageHeader>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Campañas</CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="h-9 w-64 pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading && items.length === 0 && (
            <p className="mb-4 text-sm text-muted-foreground">Cargando campañas…</p>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Canal</TableHead>
                <TableHead>Destinatarios</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Resultados</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead>Creado por</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((campaign) => {
                const ChannelIcon = CHANNEL_ICONS[campaign.channel];
                const status = campaign.status as CampaignStatus;
                return (
                  <TableRow key={campaign.id}>
                    <TableCell>
                      <button
                        type="button"
                        className="font-medium text-left hover:underline"
                        onClick={() =>
                          campaign.status === 'sent' &&
                          navigate(`/campaigns/${campaign.id}/results`)
                        }
                      >
                        {campaign.name}
                      </button>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1.5">
                        <ChannelIcon className="size-4 text-muted-foreground" />
                        {campaign.channel}
                      </span>
                    </TableCell>
                    <TableCell>{campaign.recipientCount}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[status] ?? 'secondary'}>
                        {STATUS_LABELS[status] ?? campaign.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {campaign.status === 'sent' && campaign.sentCount != null ? (
                        <span className="text-sm text-muted-foreground">
                          {campaign.deliveredCount ?? 0}/{campaign.sentCount} entregados
                          {campaign.openedCount != null && (
                            <> · {campaign.openedCount} abiertos</>
                          )}
                        </span>
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {campaign.sentAt
                        ? formatDate(campaign.sentAt)
                        : formatDate(campaign.createdAt)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {campaign.createdByName}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {campaign.status === 'sent' && (
                            <DropdownMenuItem
                              onClick={() =>
                                navigate(`/campaigns/${campaign.id}/results`)
                              }
                            >
                              <BarChart3 className="size-4" />
                              Ver resultados
                            </DropdownMenuItem>
                          )}
                          {hasPermission('campanas.crear') && campaign.status === 'draft' && (
                              <DropdownMenuItem
                                onClick={() =>
                                  navigate('/campaigns/new', {
                                    state: { draftId: campaign.id },
                                  })
                                }
                              >
                                <Pencil className="size-4" />
                                Editar borrador
                              </DropdownMenuItem>
                            )}
                          {hasPermission('campanas.crear') && (
                            <DropdownMenuItem
                              onClick={() =>
                                navigate(`/campaigns/new?duplicate=${encodeURIComponent(campaign.id)}`)
                              }
                            >
                              <Copy className="size-4" />
                              Duplicar campaña
                            </DropdownMenuItem>
                          )}
                          {hasPermission('campanas.crear') && campaign.status === 'draft' && (
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => void handleDelete(campaign)}
                              >
                                <Trash2 className="size-4" />
                                Eliminar
                              </DropdownMenuItem>
                            )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {hasMore && !loading && (
            <div className="mt-4 flex justify-center">
              <Button variant="outline" onClick={() => setPage((p) => p + 1)}>
                Cargar más
              </Button>
            </div>
          )}
          {loading && items.length > 0 && (
            <p className="mt-4 text-center text-sm text-muted-foreground">Cargando…</p>
          )}
          {items.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center py-16">
              <Send className="size-12 text-muted-foreground/50" />
              <p className="mt-2 text-sm text-muted-foreground">
                No hay campañas. Crea una nueva para comenzar.
              </p>
              <Button
                className="mt-4 bg-[#13944C] hover:bg-[#0f7a3d]"
                onClick={() => navigate('/campaigns/new')}
              >
                <Plus className="size-4" />
                Nueva campaña
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
