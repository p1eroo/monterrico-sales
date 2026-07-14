type TooltipSeriesItem = {
  name: string;
  value: number;
  formatValue: (label: string, value: number) => string;
};

export function buildAdvisorStackedBarTooltipHtml(opts: {
  title: string;
  weekLabel?: string;
  seriesItems: TooltipSeriesItem[];
}): string {
  const lines = opts.seriesItems
    .filter((item) => item.value > 0)
    .map(
      (item) =>
        `<div class="flex items-center justify-between gap-4">
          <span class="text-muted-foreground">${item.name}</span>
          <span class="font-medium tabular-nums">${item.formatValue(item.name, item.value)}</span>
        </div>`,
    )
    .join('');

  if (!lines) {
    return `<div class="apexcharts-tooltip-advisor px-2.5 py-2 text-xs">
      <div class="font-semibold">${opts.title}</div>
      <div class="text-muted-foreground">Sin registros</div>
    </div>`;
  }

  const weekLine = opts.weekLabel
    ? `<div class="mb-1 text-[10px] text-muted-foreground">${opts.weekLabel}</div>`
    : '';

  return `<div class="apexcharts-tooltip-advisor px-2.5 py-2 text-xs">
    <div class="mb-1 font-semibold">${opts.title}</div>
    ${weekLine}
    <div class="flex flex-col gap-0.5">${lines}</div>
  </div>`;
}
