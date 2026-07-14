import { useEffect, useMemo, useRef, useState } from 'react';
import {
  SourcesByEntityMixedChart,
  type SourcesByWeekStackedChartData,
} from '@/components/shared/SourcesByEntityMixedChart';
import { SourceDetailCard } from '@/components/shared/SourceDetailCard';
import { MultiAdvisorFilter } from '@/components/shared/MultiAdvisorFilter';
import type { SourceDetail } from '@/lib/sourceDetailTypes';
import {
  resolveSourcesDetailForFilters,
  type ApiSourcesDetailWeek,
} from '@/lib/sourceDetailUtils';
import {
  ADVISOR_OTHERS,
  ADVISOR_UNASSIGNED,
} from '@/hooks/useMultiAdvisorFilter';
import { cn } from '@/lib/utils';

const LEGEND_SUMMARY_OFFSET_PX = 56;
const MOBILE_CHART_HEIGHT = 340;
const DESKTOP_CHART_MIN_HEIGHT = 360;
const PANEL_HEIGHT_CLASS = 'lg:min-h-[min(68vh,640px)] lg:max-h-[min(68vh,640px)]';

type SourcesDetailWeekView = {
  week: ApiSourcesDetailWeek;
  details: SourceDetail[];
  byAdvisor: Record<string, SourceDetail[]>;
};

type AdvisorOption = { id: string; name: string };

interface SourcesExpandedViewProps {
  chartData: SourcesByWeekStackedChartData;
  detailWeeks: SourcesDetailWeekView[];
  advisors: AdvisorOption[];
  canSeeAllAdvisors?: boolean;
  chartHeight?: number;
  className?: string;
}

export function SourcesExpandedView({
  chartData,
  detailWeeks,
  advisors,
  canSeeAllAdvisors = true,
  chartHeight = MOBILE_CHART_HEIGHT,
  className,
}: SourcesExpandedViewProps) {
  const chartPanelRef = useRef<HTMLDivElement>(null);
  const [resolvedChartHeight, setResolvedChartHeight] = useState(chartHeight);
  const [selectedWeekIndex, setSelectedWeekIndex] = useState(0);
  const [advisorFilter, setAdvisorFilter] = useState<string[]>([]);
  const [advisorFilterInitialized, setAdvisorFilterInitialized] = useState(false);

  const allAdvisorIds = useMemo(
    () => advisors.map((advisor) => advisor.id),
    [advisors],
  );

  useEffect(() => {
    setSelectedWeekIndex(0);
  }, [detailWeeks]);

  useEffect(() => {
    if (!canSeeAllAdvisors || advisorFilterInitialized || allAdvisorIds.length === 0) {
      return;
    }
    setAdvisorFilter([...allAdvisorIds, ADVISOR_UNASSIGNED, ADVISOR_OTHERS]);
    setAdvisorFilterInitialized(true);
  }, [
    canSeeAllAdvisors,
    advisorFilterInitialized,
    allAdvisorIds,
  ]);

  const allAdvisorsSelected =
    canSeeAllAdvisors &&
    advisorFilterInitialized &&
    allAdvisorIds.length > 0 &&
    allAdvisorIds.every((id) => advisorFilter.includes(id)) &&
    advisorFilter.includes(ADVISOR_UNASSIGNED) &&
    advisorFilter.includes(ADVISOR_OTHERS);

  const advisorFilterIsActive =
    canSeeAllAdvisors &&
    advisorFilterInitialized &&
    (advisorFilter.length === 0 || !allAdvisorsSelected);

  const selectedWeek = detailWeeks[selectedWeekIndex] ?? detailWeeks[0];

  const filteredDetails = useMemo(
    () =>
      resolveSourcesDetailForFilters(
        selectedWeek,
        advisorFilter,
        allAdvisorsSelected,
      ),
    [
      selectedWeek,
      advisorFilter,
      allAdvisorsSelected,
    ],
  );

  const sortedDetails = [...filteredDetails].sort(
    (a, b) => b.companyCount - a.companyCount,
  );

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
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <MultiAdvisorFilter
            value={advisorFilter}
            onChange={setAdvisorFilter}
            advisors={advisors}
            disabled={!canSeeAllAdvisors}
            isActive={advisorFilterIsActive}
            isInitialized={advisorFilterInitialized}
            className="!h-8 w-full min-w-0 sm:w-[190px]"
          />

          {detailWeeks.length > 0 ? (
            <div
              className="flex flex-wrap items-center gap-1"
              role="group"
              aria-label="Filtrar por semana"
            >
              {detailWeeks.map((weekRow, index) => (
                <button
                  key={weekRow.week.name}
                  type="button"
                  onClick={() => setSelectedWeekIndex(index)}
                  className={cn(
                    'h-7 rounded-md border px-2.5 text-xs font-medium transition-colors',
                    selectedWeekIndex === index
                      ? 'border-[#13944C] bg-[#13944C]/10 text-[#13944C]'
                      : 'border-transparent text-muted-foreground hover:bg-muted/80',
                  )}
                >
                  {weekRow.week.name}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {sortedDetails.length > 0 ? (
          <div className="flex flex-col gap-4">
            {sortedDetails.map((detail) => (
              <SourceDetailCard key={detail.slug} detail={detail} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Sin empresas acumuladas por fuente en esta semana.
          </p>
        )}
      </div>
    </div>
  );
}
