import type { CSSProperties } from 'react';
import { useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import { etapaLabels } from '@/data/mock';
import { useCrmConfigStore } from '@/store/crmConfigStore';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

type Props = {
  stageLabel: string;
  stageClassName?: string;
  /** Colores dinámicos desde catálogo CRM (prioridad sobre clases Tailwind). */
  stageStyle?: CSSProperties;
  currentEtapaSlug: string;
  /** Si no se pasa, solo lectura (sin flecha ni menú). */
  onEtapaChange?: (slug: string) => void;
};

export function EtapaDropdownButton({
  stageLabel,
  stageClassName,
  stageStyle,
  currentEtapaSlug,
  onEtapaChange,
}: Props) {
  const bundle = useCrmConfigStore((s) => s.bundle);
  const options = useMemo(() => {
    const st = bundle?.catalog.stages
      ?.filter((x) => x.enabled)
      ?.sort((a, b) => a.sortOrder - b.sortOrder);
    if (st?.length) {
      return st.map((s) => ({ value: s.slug, label: s.name }));
    }
    return Object.entries(etapaLabels).map(([value, label]) => ({ value, label }));
  }, [bundle]);

  const interactive = Boolean(onEtapaChange);

  const triggerClass = cn(
    'inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-md border border-transparent px-3 text-sm font-medium whitespace-nowrap ring-offset-background transition-[filter,colors] outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    interactive && 'cursor-pointer hover:brightness-110',
    !interactive && 'cursor-default',
    stageClassName,
  );

  if (!interactive) {
    return (
      <span
        role="status"
        aria-label={`Etapa: ${stageLabel}`}
        className={triggerClass}
        style={stageStyle}
      >
        {stageLabel}
      </span>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        type="button"
        className={triggerClass}
        style={stageStyle}
        aria-label={`Etapa: ${stageLabel}. Elegir otra etapa`}
        aria-haspopup="menu"
      >
        <span className="max-w-[140px] truncate sm:max-w-[180px]">{stageLabel}</span>
        <ChevronDown className="size-4 shrink-0 opacity-80" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="max-h-[min(24rem,var(--radix-dropdown-menu-content-available-height))] w-[min(20rem,calc(100vw-2rem))] overflow-y-auto"
      >
        {options.map((opt) => (
          <DropdownMenuItem
            key={opt.value}
            className={cn(
              'cursor-pointer',
              opt.value === currentEtapaSlug && 'bg-accent/40 font-medium',
            )}
            onSelect={() => {
              if (opt.value !== currentEtapaSlug && onEtapaChange) {
                onEtapaChange(opt.value);
              }
            }}
          >
            {opt.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
