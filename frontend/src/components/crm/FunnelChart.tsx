import { useId, useMemo, useState } from 'react';

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
  /** Leyenda con punto de color y nombre bajo el SVG (desactivada por defecto). */
  showLegend?: boolean;
  /** Texto singular para el tooltip (default "empresa"). */
  singularLabel?: string;
  /** Forma del embudo. `trapezoid` (default) o `rect` (rectángulos escalonados). */
  variant?: FunnelChartVariant;
}

function resolveStageColor(color: string): string {
  const c = color.trim();
  if (
    c.startsWith('#') ||
    c.startsWith('rgb') ||
    c.startsWith('hsl(') ||
    c.startsWith('color-mix(')
  ) {
    return c;
  }
  return `hsl(var(--${c}))`;
}

/**
 * Embudo horizontal por etapa (anchos relativos al máximo), tomado de sales-workspace.
 */
export function FunnelChart({
  stages,
  height = 380,
  showLegend = false,
  singularLabel = 'empresa',
  variant = 'trapezoid',
}: FunnelChartProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');

  const { segments, chartHeight } = useMemo(() => {
    if (stages.length === 0) {
      return {
        segments: [] as Array<
          | { kind: 'path'; d: string; y: number; h: number; cx: number; stage: FunnelStage; index: number }
          | { kind: 'rect'; x: number; y: number; w: number; h: number; cx: number; stage: FunnelStage; index: number }
        >,
        chartHeight: height,
      };
    }
    const max = Math.max(...stages.map((s) => s.value), 1);
    const width = 800;
    const perStage = variant === 'rect' ? 44 : 56;
    const chartHeight = Math.min(560, Math.max(height, 48 + stages.length * perStage));
    const topPad = variant === 'rect' ? 6 : 20;
    const bottomPad = variant === 'rect' ? 6 : 20;
    const stageH = (chartHeight - topPad - bottomPad) / stages.length;
    const gap = variant === 'rect' ? 2 : 6;

    const segments = stages.map((s, i) => {
      const cx = width / 2;
      const y = topPad + i * stageH;
      const h = stageH - gap;

      if (variant === 'rect') {
        const ratio = s.value / max;
        const w = Math.max(8, ratio * width * 0.95);
        const x = cx - w / 2;
        return { kind: 'rect' as const, x, y, w, h, cx, stage: s, index: i };
      }

      const ratioTop = i === 0 ? 1 : stages[i - 1]!.value / max;
      const ratioBot = s.value / max;
      const topW = ratioTop * width * 0.95;
      const botW = ratioBot * width * 0.95;
      const x1 = cx - topW / 2;
      const x2 = cx + topW / 2;
      const x3 = cx + botW / 2;
      const x4 = cx - botW / 2;
      const d = `M ${x1} ${y} L ${x2} ${y} L ${x3} ${y + h} L ${x4} ${y + h} Z`;
      return { kind: 'path' as const, d, y, h, cx, stage: s, index: i };
    });

    return { segments, chartHeight };
  }, [stages, height, variant]);

  if (stages.length === 0) {
    return null;
  }

  return (
    <div className="min-w-0 w-full text-foreground">
      <svg
        viewBox={`0 0 800 ${chartHeight}`}
        className="h-auto w-full min-w-0 max-md:max-h-[min(72vh,640px)]"
        preserveAspectRatio="xMidYMin meet"
        role="img"
        aria-label="Embudo por etapas"
      >
        <defs>
          {stages.map((s, i) => {
            const fill = resolveStageColor(s.color);
            return (
              <linearGradient key={i} id={`${uid}-grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={fill} stopOpacity="1" />
                <stop offset="100%" stopColor={fill} stopOpacity="0.88" />
              </linearGradient>
            );
          })}
          <filter id={`${uid}-funnel-shadow`} x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.15" />
          </filter>
        </defs>

        {segments.map((seg) => {
          const i = seg.index;
          const isHover = hoverIdx === i;
          return (
            <g
              key={i}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
              className="cursor-pointer transition-opacity"
              style={{ opacity: hoverIdx === null || isHover ? 1 : 0.55 }}
            >
              <title>
                {seg.stage.label}: {seg.stage.value} {seg.stage.value === 1 ? singularLabel : `${singularLabel}s`}
              </title>
              {seg.kind === 'path' ? (
                <path
                  d={seg.d}
                  fill={`url(#${uid}-grad-${i})`}
                  filter={`url(#${uid}-funnel-shadow)`}
                  className="transition-transform"
                  style={{
                    transform: isHover ? 'scale(1.01)' : 'scale(1)',
                    transformOrigin: 'center',
                  }}
                />
              ) : (
                <rect
                  x={seg.x}
                  y={seg.y}
                  width={seg.w}
                  height={seg.h}
                  rx={1}
                  fill={`url(#${uid}-grad-${i})`}
                  filter={`url(#${uid}-funnel-shadow)`}
                  className="transition-transform"
                  style={{
                    transform: isHover ? 'scale(1.01)' : 'scale(1)',
                    transformOrigin: 'center',
                  }}
                />
              )}
              <text
                x={seg.cx}
                y={seg.y + seg.h / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="currentColor"
                className="font-semibold text-[10px] max-md:text-[11px]"
              >
                {seg.stage.label}
              </text>
            </g>
          );
        })}
      </svg>

      {showLegend && (
        <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-5">
          {stages.map((s, i) => (
            <div
              key={i}
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5"
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: resolveStageColor(s.color) }}
              />
              <span className="truncate text-[10px] text-foreground">{s.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
