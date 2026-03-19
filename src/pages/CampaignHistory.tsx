import { useState } from 'react';
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
} from 'lucide-react';
import type { CampaignStatus } from '@/types';
import { campaigns } from '@/data/campaignMock';
import { useAppStore } from '@/store';
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
const STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: 'Borrador',
  scheduled: 'Programada',
  sending: 'Enviando',
  sent: 'Enviada',
  failed: 'Fallida',
  cancelled: 'Cancelada',
};

const STATUS_VARIANTS: Record<CampaignStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'secondary',
  scheduled: 'outline',
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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('es-PE', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function CampaignHistoryPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const sentCampaigns = useAppStore((s) => s.sentCampaigns);
  const allCampaigns = [...sentCampaigns, ...campaigns];

  const filteredCampaigns = allCampaigns.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.createdByName.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col gap-6 p-6">
      <PageHeader
        title="Historial de campañas"
        description="Gestiona y revisa el historial de campañas de mensajería masiva"
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
                placeholder="Buscar campaña..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 w-64 pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
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
              {filteredCampaigns.map((campaign) => {
                const ChannelIcon = CHANNEL_ICONS[campaign.channel];
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
                    <TableCell>{campaign.recipients.length}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[campaign.status]}>
                        {STATUS_LABELS[campaign.status]}
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
                      ) : campaign.status === 'scheduled' && campaign.scheduledFor ? (
                        <span className="text-sm text-muted-foreground">
                          {formatDateTime(campaign.scheduledFor)}
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
                          {campaign.status === 'draft' && (
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
                          <DropdownMenuItem
                            onClick={() => {
                              /* duplicate */
                            }}
                          >
                            <Copy className="size-4" />
                            Duplicar campaña
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {filteredCampaigns.length === 0 && (
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
