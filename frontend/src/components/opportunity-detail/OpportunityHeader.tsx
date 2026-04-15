import { ArrowLeft, BriefcaseBusiness, Edit, RefreshCw, UserPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn, initialsFromName } from '@/lib/utils';

interface OpportunityHeaderProps {
  backPath: string;
  title: string;
  subtitle?: string;
  statusLabel: string;
  statusClassName?: string;
  amountLabel: string;
  quickActions?: React.ReactNode;
  onEdit: () => void;
  onChangeStage: () => void;
  onAssign: () => void;
}

export function OpportunityHeader({
  backPath,
  title,
  subtitle,
  statusLabel,
  statusClassName,
  amountLabel,
  quickActions,
  onEdit,
  onChangeStage,
  onAssign,
}: OpportunityHeaderProps) {
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
              onClick={() => navigate(backPath)}
              aria-label="Volver"
            >
              <ArrowLeft className="size-4" />
            </Button>

            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
              {initialsFromName(title)}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h1 className="max-w-[220px] truncate text-lg font-semibold tracking-tight text-foreground sm:max-w-[300px] lg:max-w-[380px]">
                  {title}
                </h1>
                <Badge
                  variant="outline"
                  className={cn('cursor-default border-0', statusClassName)}
                >
                  {statusLabel}
                </Badge>
                <span className="text-lg font-semibold text-foreground">{amountLabel}</span>
              </div>

              {subtitle ? (
                <div className="mt-0.5 flex items-center gap-1.5 text-sm text-text-secondary">
                  <BriefcaseBusiness className="size-3.5 text-text-tertiary" />
                  <span className="truncate">{subtitle}</span>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {quickActions}
          <Button variant="secondary" size="sm" className="h-9 gap-1.5 px-3" onClick={onEdit}>
            <Edit className="size-4" />
            Editar
          </Button>
          <Button variant="secondary" size="sm" className="h-9 gap-1.5 px-3" onClick={onChangeStage}>
            <RefreshCw className="size-4" />
            Cambiar Etapa
          </Button>
          <Button variant="secondary" size="sm" className="h-9 gap-1.5 px-3" onClick={onAssign}>
            <UserPlus className="size-4" />
            Asignar
          </Button>
        </div>
      </div>
    </header>
  );
}
