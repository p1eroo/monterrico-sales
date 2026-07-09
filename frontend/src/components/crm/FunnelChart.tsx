import { useMemo } from 'react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { useChartTheme } from '@/hooks/useChartTheme';

/** Token CSS (`funnel-1`) o color literal (`#hex`, `rgb`, `hsl(`). */
export interface FunnelStage {
  label: string;
  value: number;
  color: string;
}

export type FunnelChartVariant = 'trapezoid' | 'rect';

interface FunnelChartProps {
  stages: FunnelStage[];
  height?: number;
  /** Leyenda con punto de color y nombre bajo el chart (desactivada por defecto). */
  showLegend?: boolean;
  /** Texto singular para el tooltip (default "empresa"). */
  singularLabel?: string;
  /** Forma del embudo. `trapezoid` (default) o `rect` (rectángulos escalonados). */
  variant?: FunnelChartVariant;
}

/** Paleta fija del embudo (verdes, de más intenso arriba a más claro abajo). */
const FUNNEL_GREEN_STOPS_LIGHT = ['#065f46', '#13944C', '#34d399', '#a7f3d0'] as const;
const FUNNEL_GREEN_STOPS_DARK = ['#064e3b', '#0f766e', '#13944C', '#34d399'] as const;

function parseHexColor(hex: string): [number, number, number] {
  const raw = hex.replace('#', '');
  return [
    parseInt(raw.slice(0, 2), 16),
    parseInt(raw.slice(2, 4), 16),
    parseInt(raw.slice(4, 6), 16),
  ];
}

function lerpHex(from: string, to: string, t: number): string {
  const [r1, g1, b1] = parseHexColor(from);
  const [r2, g2, b2] = parseHexColor(to);
  const mix = (a: number, b: number) => Math.round(a + (b - a) * t);
  const r = mix(r1, r2);
  const g = mix(g1, g2);
  const b = mix(b1, b2);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function buildFunnelGreenColors(stageCount: number, isDark: boolean): string[] {
  const stops = isDark ? FUNNEL_GREEN_STOPS_DARK : FUNNEL_GREEN_STOPS_LIGHT;
  if (stageCount <= 0) return [];
  if (stageCount === 1) return [stops[0]];

  return Array.from({ length: stageCount }, (_, index) => {
    const position = index / (stageCount - 1);
    const scaled = position * (stops.length - 1);
    const lower = Math.floor(scaled);
    const upper = Math.min(lower + 1, stops.length - 1);
    const fraction = scaled - lower;
    return lerpHex(stops[lower], stops[upper], fraction);
  });
}

export function FunnelChart({
  stages,
  height = 420,
  showLegend = false,
  singularLabel = 'empresa',
  variant = 'trapezoid',
}: FunnelChartProps) {
  const chartTheme = useChartTheme();
  const categories = useMemo(() => stages.map((s) => s.label), [stages]);
  const values = useMemo(() => stages.map((s) => s.value), [stages]);
  const colors = useMemo(
    () => buildFunnelGreenColors(stages.length, chartTheme.isDark),
    [stages.length, chartTheme.isDark],
  );
  const labelColor = chartTheme.isDark ? '#f8fafc' : '#064e3b';

  const options = useMemo<ApexOptions>(
    () => ({
      chart: {
        type: 'funnel',
        toolbar: { show: false },
        fontFamily: 'inherit',
        animations: { enabled: true, speed: 450 },
        background: 'transparent',
      },
      plotOptions: {
        funnel: {
          shape: variant === 'rect' ? 'rectangle' : 'trapezoid',
          lastShape: 'taper',
        },
        bar: {
          barHeight: '100%',
          distributed: true,
        },
      },
      colors,
      stroke: { width: 0, colors: ['transparent'] },
      dataLabels: {
        enabled: true,
        formatter: (val: number, opts) => {
          const index = opts?.dataPointIndex ?? 0;
          const label = opts?.w?.globals?.labels?.[index] ?? categories[index] ?? '';
          return `${label}: ${val}`;
        },
        style: {
          fontSize: '13px',
          fontWeight: 600,
          colors: [labelColor],
        },
        background: {
          enabled: false,
        },
        dropShadow: {
          enabled: chartTheme.isDark,
          color: '#000',
          top: 1,
          left: 0,
          blur: 2,
          opacity: 0.45,
        },
      },
      xaxis: {
        categories,
        labels: { show: false },
        axisBorder: { show: false },
        axisTicks: { show: false },
      },
      yaxis: { show: false },
      grid: {
        show: false,
        padding: { top: 4, bottom: 4, left: 8, right: 8 },
      },
      legend: { show: false },
      tooltip: {
        theme: chartTheme.isDark ? 'dark' : 'light',
        y: {
          formatter: (val) => {
            const n = Number(val);
            return `${n} ${n === 1 ? singularLabel : `${singularLabel}s`}`;
          },
        },
      },
    }),
    [categories, chartTheme.isDark, colors, labelColor, singularLabel, variant],
  );

  const series = useMemo(() => [{ name: 'Pipeline', data: values }], [values]);

  if (stages.length === 0) {
    return null;
  }

  return (
    <div className="min-w-0 w-full text-foreground">
      <Chart
        options={options}
        series={series}
        type={'funnel' as 'bar'}
        height={height}
      />

      {showLegend && (
        <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-5">
          {stages.map((s, i) => (
            <div
              key={i}
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5"
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: colors[i] }}
              />
              <span className="truncate text-[10px] text-foreground">{s.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
