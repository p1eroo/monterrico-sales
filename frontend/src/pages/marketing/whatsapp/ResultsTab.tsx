import { useMemo } from 'react';
import {
  AlertTriangle,
  CheckCheck,
  CircleDollarSign,
  Loader2,
  MessageCircle,
  RotateCcw,
  XCircle,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { GlassCard } from '@/components/shared/GlassCard';
import { cn } from '@/lib/utils';
import type { WhatsAppBulkCampaignSummary, WhatsAppEstimatedCost } from '@/lib/marketingApi';
import {
  crmTableBodyRowClass,
  crmTableFooterClass,
  crmTableHeaderRowClass,
} from '@/lib/crmTableSurface';
import {
  WHATSAPP_SEND_STATUS_CLASS,
  WHATSAPP_SEND_STATUS_LABEL,
  countWhatsAppResults,
  type WhatsAppSendResult,
} from './mockData';
import { formatWhatsAppPhoneDisplay } from './whatsappAudienceExcel';
import {
  WhatsappDeliveredSvgIcon,
  WhatsappFailedSvgIcon,
  WhatsappReadSvgIcon,
  WhatsappSentSvgIcon,
} from './WhatsappResultsKpiSvgIcons';

function formatCampaignLabel(c: WhatsAppBulkCampaignSummary): string {
  const date = new Date(c.completedAt ?? c.createdAt).toLocaleString('es-PE', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  const title = c.name?.trim() || c.templateName;
  return `${title} · ${date}`;
}

const CAMPAIGN_STATUS_LABEL: Record<string, string> = {
  sent: 'Completado',
  sending: 'Enviando…',
  failed: 'Fallido',
};

export function ResultsTab({
  results,
  campaigns,
  selectedCampaignId,
  templateName,
  campaignStatus,
  estimatedCost,
  loading,
  onSelectCampaign,
  onNewSend,
}: {
  results: WhatsAppSendResult[];
  campaigns: WhatsAppBulkCampaignSummary[];
  selectedCampaignId: string | null;
  templateName?: string;
  campaignStatus?: string;
  estimatedCost?: WhatsAppEstimatedCost | null;
  loading?: boolean;
  onSelectCampaign: (id: string) => void;
  onNewSend: () => void;
}) {
  const counts = useMemo(() => countWhatsAppResults(results), [results]);

  const kpis: Array<{
    label: string;
    value: number;
    icon: ComponentType<{ className?: string }>;
    color: string;
  }> = [
    {
      label: 'Enviados',
      value: counts.enviados,
      icon: WhatsappSentSvgIcon,
      color: 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-500/15',
    },
    {
      label: 'Entregados',
      value: counts.entregados,
      icon: WhatsappDeliveredSvgIcon,
      color: 'text-slate-600 bg-slate-100 dark:text-slate-300 dark:bg-slate-500/15',
    },
    {
      label: 'Leídos',
      value: counts.leidos,
      icon: WhatsappReadSvgIcon,
      color: 'text-emerald-600 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-500/15',
    },
    {
      label: 'Fallidos',
      value: counts.fallidos,
      icon: WhatsappFailedSvgIcon,
      color: 'text-red-600 bg-red-100 dark:text-red-400 dark:bg-red-500/15',
    },
  ];

  const total = Math.max(1, counts.total);
  const okRate = Math.round(((total - counts.fallidos) / total) * 100);

  const segments = [
    { key: 'enviado' as const, color: '#3b82f6', count: counts.enviados },
    { key: 'entregado' as const, color: '#64748b', count: counts.entregados },
    { key: 'leido' as const, color: '#13944C', count: counts.leidos },
    { key: 'fallido' as const, color: '#ef4444', count: counts.fallidos },
  ];

  if (loading) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-xl border bg-card">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Cargando resultados…</p>
      </div>
    );
  }

  if (campaigns.length === 0) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center gap-3 rounded-xl border bg-card px-6 text-center">
        <MessageCircle className="size-10 text-muted-foreground/40" />
        <p className="font-medium">Aún no hay envíos</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Completa un envío desde la pestaña Envío para ver los resultados aquí. Quedarán guardados en el historial.
        </p>
        <Button variant="outline" size="sm" onClick={onNewSend}>
          <RotateCcw className="size-4" />
          Ir a Envío
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <h3 className="text-lg font-semibold tracking-tight">Resultados del envío</h3>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={selectedCampaignId ?? undefined}
              onValueChange={onSelectCampaign}
            >
              <SelectTrigger className="h-9 w-full max-w-md">
                <SelectValue placeholder="Selecciona un envío" />
              </SelectTrigger>
              <SelectContent>
                {campaigns.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {formatCampaignLabel(c)} ({c.sent} ok · {c.failed} fallidos)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {campaignStatus ? (
              <Badge variant="outline" className="h-7 shrink-0">
                {CAMPAIGN_STATUS_LABEL[campaignStatus] ?? campaignStatus}
              </Badge>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            {results.length} destinatario(s)
            {templateName ? ` · Plantilla ${templateName}` : ''} · {okRate}% aceptados por Meta
          </p>
        </div>
        <Button variant="outline" size="sm" className="shrink-0" onClick={onNewSend}>
          <RotateCcw className="size-4" />
          Nuevo envío
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Card key={k.label}>
              <CardContent className="flex items-center gap-4 p-5">
                <div className={cn('flex size-11 items-center justify-center rounded-xl', k.color)}>
                  <Icon className="size-6" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{k.label}</p>
                  <p className="text-2xl font-bold">{k.value}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Resumen</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex h-3 w-full overflow-hidden rounded-full">
              {segments.map((s) =>
                s.count > 0 ? (
                  <div
                    key={s.key}
                    style={{ width: `${(s.count / total) * 100}%`, backgroundColor: s.color }}
                    title={`${WHATSAPP_SEND_STATUS_LABEL[s.key]}: ${s.count}`}
                  />
                ) : null,
              )}
            </div>
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              {segments.map((s) => (
                <span key={s.key} className="inline-flex items-center gap-1.5">
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                  {WHATSAPP_SEND_STATUS_LABEL[s.key]} ({s.count})
                </span>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-4 rounded-lg bg-muted/40 px-3 py-2 text-sm">
              <span
                className="inline-flex items-center gap-1.5 text-muted-foreground"
                title="Solo mensajes enviados exitosamente. Tarifas publicadas por Meta para Perú."
              >
                <CircleDollarSign className="size-4" />
                Costo estimado (tarifas Meta): S/ {(estimatedCost?.amountPen ?? 0).toFixed(2)}
                {estimatedCost && estimatedCost.billableCount > 0 ? (
                  <span className="text-xs opacity-80">
                    · {estimatedCost.billableCount} enviado{estimatedCost.billableCount === 1 ? '' : 's'}
                  </span>
                ) : null}
              </span>
              <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                <Loader2 className="size-4" />
                Proveedor: Meta WhatsApp Cloud API
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <GlassCard>
        <div className="flex items-center justify-between border-b px-5 py-3">
          <p className="text-sm font-semibold">
            Detalle por contacto
            <Badge variant="secondary" className="ml-2 align-middle">
              {results.length}
            </Badge>
          </p>
        </div>
        <div className="max-h-[420px] overflow-auto border-t border-border/40">
          <table className="w-full table-fixed bg-transparent">
            <thead>
              <tr className={cn('h-[36px] text-left', crmTableHeaderRowClass)}>
                <th className="px-3 text-[11px] font-bold">Contacto</th>
                <th className="px-3 text-[11px] font-bold">Teléfono</th>
                <th className="px-3 text-[11px] font-bold">Estado</th>
                <th className="px-3 text-[11px] font-bold">Enviado</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.contactId} className={cn('h-[48px] last:border-b-0', crmTableBodyRowClass)}>
                  <td className="overflow-hidden px-3">
                    <span className="block truncate text-[13px] font-semibold text-[#0F172A] dark:text-gray-100">
                      {r.name}
                    </span>
                  </td>
                  <td className="overflow-hidden px-3">
                    <span className="block truncate font-mono text-[13px] text-muted-foreground">
                      {formatWhatsAppPhoneDisplay(r.phone)}
                    </span>
                  </td>
                  <td className="overflow-hidden px-3">
                    <Badge variant="outline" className={cn('inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-[11px] font-semibold', WHATSAPP_SEND_STATUS_CLASS[r.status])}>
                      {r.status === 'fallido' && <XCircle className="size-3" />}
                      {r.status === 'leido' && <CheckCheck className="size-3" />}
                      {WHATSAPP_SEND_STATUS_LABEL[r.status]}
                    </Badge>
                  </td>
                  <td className="overflow-hidden px-3">
                    <span className="block truncate text-[13px] text-muted-foreground">
                      {r.sentAt ? new Date(r.sentAt).toLocaleString('es-PE') : '—'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {counts.fallidos > 0 && (
          <div className={cn('border-t px-5 py-3', crmTableFooterClass)}>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <AlertTriangle className="size-3.5 text-amber-500" />
              Motivos de fallo
            </p>
            <ul className="space-y-1 text-sm">
              {results
                .filter((r) => r.status === 'fallido' && r.error)
                .map((r) => (
                  <li key={r.contactId} className="flex items-start gap-2 text-muted-foreground">
                    <span className="shrink-0 font-medium text-foreground">{r.name}:</span>
                    <span className="text-red-600 dark:text-red-400">{r.error}</span>
                  </li>
                ))}
            </ul>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
