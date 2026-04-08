import { cn } from '@/lib/utils';

export type ChartSilhouetteVariant =
  | 'area'
  | 'line'
  | 'bar'
  | 'barHorizontal'
  | 'donut'
  | 'stackedBar';

type ChartSilhouetteProps = {
  variant: ChartSilhouetteVariant;
  /** Pulsación típica de carga */
  animate?: boolean;
  /** Texto bajo la silueta (p. ej. sin datos) */
  caption?: string;
};

const barHeightsPct = [38, 62, 44, 78, 52, 68, 48, 72, 41, 58];

function AreaSilhouette() {
  return (
    <svg
      className="absolute inset-x-1 bottom-8 top-2 h-[calc(100%-1.5rem)] w-[calc(100%-0.5rem)] text-muted-foreground/35"
      viewBox="0 0 100 50"
      preserveAspectRatio="none"
      aria-hidden
    >
      <path
        d="M0 42 L8 38 L18 40 L28 28 L40 32 L52 18 L62 22 L75 12 L88 16 L100 14 L100 50 L0 50 Z"
        fill="currentColor"
        className="text-primary/25"
      />
      <path
        d="M0 45 L12 41 L24 36 L36 38 L48 30 L60 26 L72 20 L84 24 L100 18 L100 50 L0 50 Z"
        fill="currentColor"
        className="text-muted-foreground/30"
      />
    </svg>
  );
}

function LineSilhouette() {
  return (
    <svg
      className="absolute inset-x-1 bottom-8 top-4 h-[calc(100%-2rem)] w-[calc(100%-0.5rem)]"
      viewBox="0 0 100 50"
      preserveAspectRatio="none"
      aria-hidden
    >
      <path
        d="M0 38 Q15 30 28 34 T55 22 T72 28 T100 14"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        vectorEffect="non-scaling-stroke"
        className="text-muted-foreground/45"
      />
      <path
        d="M0 44 Q20 36 40 40 T70 32 T100 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
        className="text-primary/30"
      />
    </svg>
  );
}

function BarSilhouette() {
  return (
    <div className="absolute inset-x-3 bottom-8 top-4 flex items-end justify-center gap-[3%]">
      {barHeightsPct.slice(0, 8).map((h, i) => (
        <div
          key={i}
          className="max-w-[11%] flex-1 rounded-t-md bg-muted-foreground/35"
          style={{ height: `${h}%` }}
        />
      ))}
    </div>
  );
}

function BarHorizontalSilhouette() {
  const widths = ['72%', '55%', '88%', '48%', '63%'];
  return (
    <div className="absolute inset-x-2 bottom-8 top-4 flex flex-col justify-center gap-3 py-1">
      {widths.map((w, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="h-2.5 w-14 shrink-0 rounded bg-muted-foreground/25" />
          <div className="h-4 flex-1 rounded-md bg-muted-foreground/20">
            <div
              className="h-full rounded-md bg-muted-foreground/40"
              style={{ width: w, maxWidth: '100%' }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function DonutSilhouette() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pb-6 pt-2">
      <svg
        className="aspect-square h-[min(72%,11rem)] w-[min(72%,11rem)] -rotate-90 text-muted-foreground/35"
        viewBox="0 0 100 100"
        aria-hidden
      >
        <circle
          cx="50"
          cy="50"
          r="38"
          fill="none"
          stroke="currentColor"
          strokeWidth="14"
          strokeDasharray="60 180"
          className="text-primary/30"
        />
        <circle
          cx="50"
          cy="50"
          r="38"
          fill="none"
          stroke="currentColor"
          strokeWidth="14"
          strokeDasharray="45 195"
          strokeDashoffset="-65"
          className="text-muted-foreground/40"
        />
        <circle
          cx="50"
          cy="50"
          r="38"
          fill="none"
          stroke="currentColor"
          strokeWidth="14"
          strokeDasharray="35 205"
          strokeDashoffset="-115"
          className="text-muted-foreground/25"
        />
      </svg>
    </div>
  );
}

function StackedBarSilhouette() {
  const segments = [
    [32, 24, 18],
    [22, 30, 22],
    [28, 18, 26],
    [20, 26, 28],
    [34, 20, 18],
    [24, 26, 20],
  ] as const;
  return (
    <div className="absolute inset-x-3 bottom-8 top-4 flex items-end justify-center gap-1.5">
      {segments.map((cols, i) => (
        <div
          key={i}
          className="flex h-[88%] max-w-[13%] flex-1 flex-col justify-end gap-px overflow-hidden rounded-t-md"
        >
          {cols.map((pct, j) => (
            <div
              key={j}
              className={cn(
                'w-full min-h-[4px] rounded-sm',
                j === 0 && 'bg-muted-foreground/40',
                j === 1 && 'bg-muted-foreground/28',
                j === 2 && 'bg-muted-foreground/38',
              )}
              style={{ flex: `${pct} 1 0` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function AxisTicks() {
  return (
    <div className="pointer-events-none absolute inset-x-2 bottom-5 flex justify-between opacity-40">
      {[1, 2, 3, 4, 5].map((k) => (
        <div key={k} className="h-1 w-6 rounded-full bg-muted-foreground/30" />
      ))}
    </div>
  );
}

function SilhouetteContent({ variant }: { variant: ChartSilhouetteVariant }) {
  switch (variant) {
    case 'area':
      return (
        <>
          <AreaSilhouette />
          <AxisTicks />
        </>
      );
    case 'line':
      return (
        <>
          <LineSilhouette />
          <AxisTicks />
        </>
      );
    case 'bar':
      return (
        <>
          <BarSilhouette />
          <AxisTicks />
        </>
      );
    case 'barHorizontal':
      return <BarHorizontalSilhouette />;
    case 'donut':
      return <DonutSilhouette />;
    case 'stackedBar':
      return (
        <>
          <StackedBarSilhouette />
          <AxisTicks />
        </>
      );
    default:
      return <BarSilhouette />;
  }
}

export function ChartSilhouette({ variant, animate, caption }: ChartSilhouetteProps) {
  return (
    <div
      className={cn(
        'relative flex h-full min-h-[10rem] w-full flex-col overflow-hidden',
        animate && 'animate-pulse',
      )}
    >
      <div className="relative min-h-0 flex-1">
        <SilhouetteContent variant={variant} />
      </div>
      {caption ? (
        <p className="shrink-0 px-3 pb-2 pt-0 text-center text-xs text-muted-foreground">{caption}</p>
      ) : null}
    </div>
  );
}
