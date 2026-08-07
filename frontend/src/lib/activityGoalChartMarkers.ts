import type { ActivityGoalTargets } from '@/lib/crmConfigApi';
import { activityGoalTotal } from '@/lib/crmConfigApi';

type AdvisorRow = { advisorId: string; advisorName: string; total: number };

const MARKER_CLASS = 'activity-goal-marker';
const HIGHLIGHT_CLASS = 'activity-goal-highlight';

type ApexChartContext = {
  el?: HTMLElement | null;
  w: {
    globals: {
      minX?: number;
      maxX?: number;
      xAxisScale?: { niceMax?: number };
      gridWidth: number;
      translateX: number;
      gridHeight: number;
      translateY: number;
    };
  };
};

function axisMin(globals: ApexChartContext['w']['globals']): number {
  return Math.max(0, globals.minX ?? 0);
}

function axisMax(globals: ApexChartContext['w']['globals']): number {
  return globals.maxX ?? globals.xAxisScale?.niceMax ?? 1;
}

function xForValue(
  value: number,
  globals: ApexChartContext['w']['globals'],
): number {
  const minX = axisMin(globals);
  const maxX = axisMax(globals);
  const range = maxX - minX || 1;
  return globals.translateX + ((value - minX) / range) * globals.gridWidth;
}

function rowCenterY(
  index: number,
  rowCount: number,
  globals: ApexChartContext['w']['globals'],
): number {
  const rowHeight = globals.gridHeight / Math.max(rowCount, 1);
  return globals.translateY + rowHeight * index + rowHeight / 2;
}

export function applyActivityGoalDecorations(
  chartContext: ApexChartContext,
  advisors: AdvisorRow[],
  goalByAdvisorId: Record<string, ActivityGoalTargets> | undefined,
  opts: { isDark: boolean; defaultLabelColor: string },
) {
  const chartEl = chartContext.el as HTMLElement | undefined;
  const svg = chartEl?.querySelector('.apexcharts-svg');
  if (!svg) return;

  svg.querySelectorAll(`.${MARKER_CLASS}, .${HIGHLIGHT_CLASS}`).forEach((node) =>
    node.remove(),
  );

  const globals = chartContext.w.globals;
  const rowCount = Math.max(advisors.length, 1);
  const goalStroke = opts.isDark ? '#fbbf24' : '#d97706';
  const metFill = opts.isDark
    ? 'rgba(34, 197, 94, 0.18)'
    : 'rgba(34, 197, 94, 0.14)';
  const metLabelColor = opts.isDark ? '#4ade80' : '#16a34a';

  const markerGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  markerGroup.setAttribute('class', MARKER_CLASS);
  markerGroup.setAttribute('pointer-events', 'none');

  const highlightGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  highlightGroup.setAttribute('class', HIGHLIGHT_CLASS);
  highlightGroup.setAttribute('pointer-events', 'none');

  advisors.forEach((row, index) => {
    const targets = goalByAdvisorId?.[row.advisorId];
    const goalTotal = targets ? activityGoalTotal(targets) : 0;
    // ApexCharts dibuja la primera categoría abajo en barras horizontales.
    const categoryIndex = rowCount - 1 - index;
    const yCenter = rowCenterY(categoryIndex, rowCount, globals);
    const rowHeight = globals.gridHeight / rowCount;
    const halfH = Math.max(10, rowHeight * 0.36);
    const met = goalTotal > 0 && row.total >= goalTotal;

    if (met && row.total > 0) {
      const xStart = xForValue(0, globals);
      const xEnd = xForValue(row.total, globals);
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', String(xStart));
      rect.setAttribute('y', String(yCenter - halfH));
      rect.setAttribute('width', String(Math.max(0, xEnd - xStart)));
      rect.setAttribute('height', String(halfH * 2));
      rect.setAttribute('rx', '4');
      rect.setAttribute('fill', metFill);
      highlightGroup.appendChild(rect);
    }

    if (goalTotal <= 0) return;

    const x = xForValue(goalTotal, globals);
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', String(x));
    line.setAttribute('x2', String(x));
    line.setAttribute('y1', String(yCenter - halfH));
    line.setAttribute('y2', String(yCenter + halfH));
    line.setAttribute('stroke', goalStroke);
    line.setAttribute('stroke-width', '2');
    line.setAttribute('stroke-dasharray', '5 4');
    line.setAttribute('stroke-linecap', 'round');
    markerGroup.appendChild(line);
  });

  const inner = svg.querySelector('.apexcharts-inner');
  if (highlightGroup.childElementCount) {
    inner?.insertBefore(highlightGroup, inner.firstChild);
  }
  if (markerGroup.childElementCount) {
    inner?.appendChild(markerGroup);
  }

  const totalLabels = chartEl?.querySelectorAll('.apexcharts-datalabel-total');
  totalLabels?.forEach((node, index) => {
    const advisor = advisors[index];
    if (!advisor) return;
    const targets = goalByAdvisorId?.[advisor.advisorId];
    const goalTotal = targets ? activityGoalTotal(targets) : 0;
    const met = goalTotal > 0 && advisor.total >= goalTotal;
    const el = node as SVGTextElement;
    el.setAttribute('fill', met ? metLabelColor : opts.defaultLabelColor);
  });
}

/** @deprecated Use applyActivityGoalDecorations */
export function drawActivityGoalMarkers(
  chartContext: ApexChartContext,
  advisors: AdvisorRow[],
  goalByAdvisorId: Record<string, ActivityGoalTargets> | undefined,
  isDark: boolean,
) {
  applyActivityGoalDecorations(chartContext, advisors, goalByAdvisorId, {
    isDark,
    defaultLabelColor: isDark ? '#e2e8f0' : '#334155',
  });
}
