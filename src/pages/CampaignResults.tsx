import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import type { RecipientStatus } from '@/types';
import { campaigns } from '@/data/campaignMock';
import { useAppStore } from '@/store';
import { Button } from '@/components/ui/button';
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
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { PageHeader } from '@/components/shared/PageHeader';
import { cn } from '@/lib/utils';

const STATUS_LABELS: Record<RecipientStatus, string> = {
  pendiente: 'Pendiente',
  enviado: 'Enviado',
  entregado: 'Entregado',
  abierto: 'Abierto',
  clic: 'Clic',
  fallido: 'Fallido',
  rebote: 'Rebote',
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('es-PE', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function CampaignResultsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const sentCampaigns = useAppStore((s) => s.sentCampaigns);
  const allCampaigns = [...sentCampaigns, ...campaigns];
  const campaign = allCampaigns.find((c) => c.id === id);

  if (!campaign) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-12">
        <p className="text-muted-foreground">Campaña no encontrada</p>
        <Button variant="outline" onClick={() => navigate('/campaigns')}>
          Volver
        </Button>
      </div>
    );
  }

  const results = campaign.results ?? [];
  const deliveryRate =
    (campaign.sentCount ?? 0) > 0
      ? Math.round(((campaign.deliveredCount ?? 0) / (campaign.sentCount ?? 1)) * 100)
      : 0;
  const openRate =
    (campaign.deliveredCount ?? 0) > 0
      ? Math.round(((campaign.openedCount ?? 0) / (campaign.deliveredCount ?? 1)) * 100)
      : 0;
  const clickRate =
    (campaign.deliveredCount ?? 0) > 0
      ? Math.round(((campaign.clickedCount ?? 0) / (campaign.deliveredCount ?? 1)) * 100)
      : 0;

  const chartData = [
    { name: 'Enviados', value: campaign.sentCount ?? 0, fill: '#13944C' },
    { name: 'Entregados', value: campaign.deliveredCount ?? 0, fill: '#22c55e' },
    { name: 'Abiertos', value: campaign.openedCount ?? 0, fill: '#3b82f6' },
    { name: 'Clics', value: campaign.clickedCount ?? 0, fill: '#8b5cf6' },
    { name: 'Fallidos', value: campaign.failedCount ?? 0, fill: '#ef4444' },
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/campaigns')}>
          <ChevronLeft className="size-4" />
        </Button>
        <PageHeader
          title={campaign.name}
          description={`Enviada el ${campaign.sentAt ? formatDateTime(campaign.sentAt) : '-'} · ${campaign.recipients.length} destinatarios`}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Enviados</p>
            <p className="text-2xl font-bold">{campaign.sentCount ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Entregados</p>
            <p className="text-2xl font-bold text-[#13944C]">
              {campaign.deliveredCount ?? 0}
            </p>
            <p className="text-xs text-muted-foreground">{deliveryRate}% tasa</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Abiertos</p>
            <p className="text-2xl font-bold">{campaign.openedCount ?? 0}</p>
            <p className="text-xs text-muted-foreground">{openRate}% tasa</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Clics</p>
            <p className="text-2xl font-bold">{campaign.clickedCount ?? 0}</p>
            <p className="text-xs text-muted-foreground">{clickRate}% tasa</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Fallidos</p>
            <p className="text-2xl font-bold text-destructive">
              {(campaign.failedCount ?? 0) + (campaign.bounceCount ?? 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resumen de envío</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#13944C"
                  fill="#13944C"
                  fillOpacity={0.3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resultados por contacto</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contacto</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Enviado</TableHead>
                <TableHead>Entregado</TableHead>
                <TableHead>Abierto</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((r) => (
                <TableRow key={r.recipientId}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell>{r.email}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        r.status === 'fallido' || r.status === 'rebote'
                          ? 'destructive'
                          : r.status === 'entregado' || r.status === 'abierto' || r.status === 'clic'
                            ? 'default'
                            : 'secondary'
                      }
                      className={
                        r.status === 'entregado' || r.status === 'abierto' || r.status === 'clic'
                          ? 'bg-[#13944C]'
                          : ''
                      }
                    >
                      {STATUS_LABELS[r.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {r.sentAt ? formatDateTime(r.sentAt) : '-'}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {r.deliveredAt ? formatDateTime(r.deliveredAt) : '-'}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {r.openedAt ? formatDateTime(r.openedAt) : '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
