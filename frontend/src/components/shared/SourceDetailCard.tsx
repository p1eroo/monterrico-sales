import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency, formatCurrencyCompact } from '@/lib/formatters';
import { sourceAdvanceRate, type SourceDetail } from '@/lib/sourceDetailTypes';
import { cn } from '@/lib/utils';

interface SourceDetailCardProps {
  detail: SourceDetail;
  className?: string;
}

export function SourceDetailCard({ detail, className }: SourceDetailCardProps) {
  const stageTotal = detail.stages.reduce((sum, s) => sum + s.count, 0);
  const advanceRate = sourceAdvanceRate(detail);

  return (
    <Card className={cn('overflow-hidden', className)}>
      <div
        className="h-1 w-full"
        style={{ backgroundColor: detail.accentColor }}
        aria-hidden
      />
      <CardContent className="space-y-4 p-4">
        <h3 className="text-base font-semibold text-foreground">{detail.name}</h3>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-2xl font-bold tabular-nums tracking-tight text-foreground">
              {detail.companyCount.toLocaleString('es-PE')}
            </p>
            <p className="text-[11px] text-muted-foreground">empresas</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold tabular-nums tracking-tight text-foreground">
              {formatCurrencyCompact(detail.estimatedBilling)}
            </p>
            <p className="text-[11px] text-muted-foreground">facturación estimada</p>
          </div>
        </div>

        {stageTotal > 0 ? (
          <div className="space-y-2">
            <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted/60">
              {detail.stages.map((stage) =>
                stage.count > 0 ? (
                  <div
                    key={stage.slug}
                    className="h-full min-w-0 transition-[width]"
                    style={{
                      width: `${(stage.count / stageTotal) * 100}%`,
                      backgroundColor: stage.color,
                    }}
                    title={`${stage.label}: ${stage.count}`}
                  />
                ) : null,
              )}
            </div>
            <div className="grid gap-1">
              {detail.stages
                .filter((s) => s.count > 0)
                .map((stage) => (
                  <div
                    key={stage.slug}
                    className="flex items-center justify-between gap-2 text-[11px]"
                  >
                    <span className="inline-flex min-w-0 items-center gap-1.5 text-muted-foreground">
                      <span
                        className="size-2 shrink-0 rounded-sm"
                        style={{ backgroundColor: stage.color }}
                      />
                      <span className="truncate">{stage.shortLabel}</span>
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums text-foreground">
                      {stage.count.toLocaleString('es-PE')}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-3 border-t border-border pt-3 text-xs">
          <div>
            <p className="text-muted-foreground">Tasa de avance</p>
            <p
              className={cn(
                'text-sm font-bold tabular-nums',
                advanceRate >= 10 ? 'text-emerald-600' : 'text-rose-600',
              )}
            >
              {advanceRate}%
            </p>
          </div>
          <div className="text-right">
            <p className="text-muted-foreground">Hot 70%+</p>
            <p className="text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
              {detail.hot70Count}{' '}
              <span className="font-medium text-muted-foreground">
                ({formatCurrency(detail.hot70Billing)})
              </span>
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
