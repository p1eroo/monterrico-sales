import { useEffect, useRef, useState } from 'react';
import {
  SourcesByEntityMixedChart,
  type SourceByEntityPoint,
} from '@/components/shared/SourcesByEntityMixedChart';
import { SourceDetailCard } from '@/components/shared/SourceDetailCard';
import type { SourceDetail } from '@/lib/sourceDetailTypes';
import type { ApiSourcesDetailWeek } from '@/lib/sourceDetailUtils';
import { formatWeekRangeLima } from '@/lib/crmTimezone';
import { cn } from '@/lib/utils';

const LEGEND_SUMMARY_OFFSET_PX = 56;
const MOBILE_CHART_HEIGHT = 340;
const DESKTOP_CHART_MIN_HEIGHT = 360;
const PANEL_HEIGHT_CLASS = 'lg:min-h-[min(68vh,640px)] lg:max-h-[min(68vh,640px)]';

interface SourcesExpandedViewProps {
  chartData: SourceByEntityPoint[];
  details: SourceDetail[];
  /** Semana ISO de corte para los cards (semana anterior a la actual). */
  detailWeek?: ApiSourcesDetailWeek | null;
  /** Altura del gráfico en vista apilada (móvil). */
  chartHeight?: number;
  className?: string;
}

export function SourcesExpandedView({
  chartData,
  details,
  detailWeek,
  chartHeight = MOBILE_CHART_HEIGHT,
  className,
}: SourcesExpandedViewProps) {
  const chartPanelRef = useRef<HTMLDivElement>(null);
  const [resolvedChartHeight, setResolvedChartHeight] = useState(chartHeight);

  const sortedDetails = [...details].sort(
    (a, b) => b.companyCount - a.companyCount,
  );

  const weekRangeLabel =
    detailWeek?.weekStart && detailWeek?.weekEnd
      ? formatWeekRangeLima(detailWeek.weekStart, detailWeek.weekEnd)
      : null;
  const weekCaption = detailWeek?.name
    ? weekRangeLabel
      ? `Empresas creadas en semana ${detailWeek.name} (${weekRangeLabel})`
      : `Empresas creadas en semana ${detailWeek.name}`
    : null;

  useEffect(() => {
    const node = chartPanelRef.current;
    if (!node) return;

    const measure = () => {
      const isDesktop = window.matchMedia('(min-width: 1024px)').matches;
      if (!isDesktop) {
        setResolvedChartHeight(chartHeight);
        return;
      }
      const next = Math.max(
        DESKTOP_CHART_MIN_HEIGHT,
        node.clientHeight - LEGEND_SUMMARY_OFFSET_PX,
      );
      setResolvedChartHeight(next);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(node);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [chartHeight]);

  return (
    <div
      className={cn(
        'flex w-full flex-col gap-6',
        'lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-stretch lg:gap-6',
        className,
      )}
    >
      <div
        ref={chartPanelRef}
        className={cn(
          'flex min-w-0 flex-col lg:sticky lg:top-0',
          PANEL_HEIGHT_CLASS,
        )}
      >
        <SourcesByEntityMixedChart
          data={chartData}
          height={resolvedChartHeight}
          showLegendSummary
          className="flex min-h-0 flex-1 flex-col"
        />
      </div>

      <div
        className={cn(
          'flex min-w-0 flex-col gap-3 lg:overflow-y-auto lg:pr-1',
          PANEL_HEIGHT_CLASS,
        )}
      >
        <div className="flex shrink-0 flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground">Detalle por fuente</h3>
          <p className="text-[11px] text-muted-foreground">
            {weekCaption ? `${weekCaption} · ` : ''}
            Empresas en etapas 10%–100%
          </p>
        </div>
        {sortedDetails.length > 0 ? (
          <div className="flex flex-col gap-4">
            {sortedDetails.map((detail) => (
              <SourceDetailCard key={detail.slug} detail={detail} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Sin empresas creadas por fuente en la semana anterior.
          </p>
        )}
      </div>
    </div>
  );
}
