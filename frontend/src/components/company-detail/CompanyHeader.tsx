import type { CSSProperties } from 'react';
import { ArrowLeft, BriefcaseBusiness, Edit } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { navigateBackOrTo } from '@/lib/navigateBackOrTo';
import { Button } from '@/components/ui/button';
import { EtapaDropdownButton } from '@/components/shared/EtapaDropdownButton';
import { initialsFromName } from '@/lib/utils';

interface CompanyHeaderProps {
  backPath: string;
  name: string;
  subtitle?: string;
  stageLabel: string;
  stageClassName?: string;
  stageStyle?: CSSProperties;
  currentEtapaSlug: string;
  onEtapaChange?: (slug: string) => void;
  estimatedValueLabel: string;
  quickActions?: React.ReactNode;
  onEdit: () => void;
}

export function CompanyHeader({
  backPath,
  name,
  subtitle,
  stageLabel,
  stageClassName,
  stageStyle,
  currentEtapaSlug,
  onEtapaChange,
  estimatedValueLabel,
  quickActions,
  onEdit,
}: CompanyHeaderProps) {
  const navigate = useNavigate();

  return (
    <header className="-mx-4 sticky top-0 z-20 border-b border-border bg-background/80 px-4 backdrop-blur-xl md:-mx-6 md:px-6">
      <div className="flex flex-col gap-3 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 rounded-lg text-text-secondary hover:bg-accent hover:text-accent-foreground"
              onClick={() => navigateBackOrTo(navigate, backPath)}
              aria-label="Volver"
            >
              <ArrowLeft className="size-4" />
            </Button>

            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
              {initialsFromName(name)}
            </div>

            <div className="min-w-0">
              <h1 className="max-w-[220px] truncate text-lg font-semibold tracking-tight text-foreground sm:max-w-[300px] lg:max-w-[380px]">
                {name}
              </h1>

              {(subtitle?.trim() || estimatedValueLabel) ? (
                <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-text-secondary">
                  <BriefcaseBusiness className="size-3.5 shrink-0 text-text-tertiary" aria-hidden />
                  {subtitle?.trim() ? (
                    <span className="min-w-0 truncate">{subtitle.trim()}</span>
                  ) : null}
                  {subtitle?.trim() && estimatedValueLabel ? (
                    <span className="shrink-0 text-text-tertiary" aria-hidden>
                      ·
                    </span>
                  ) : null}
                  {estimatedValueLabel ? (
                    <span className="shrink-0 font-semibold tabular-nums text-primary">
                      {estimatedValueLabel}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <EtapaDropdownButton
            stageLabel={stageLabel}
            stageClassName={stageClassName}
            stageStyle={stageStyle}
            currentEtapaSlug={currentEtapaSlug}
            onEtapaChange={onEtapaChange}
          />
          {quickActions}
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-lg text-text-secondary hover:bg-accent hover:text-accent-foreground"
            onClick={onEdit}
            aria-label="Editar"
            title="Editar"
          >
            <Edit className="size-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
