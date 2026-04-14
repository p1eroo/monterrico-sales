import { ArrowLeft, BriefcaseBusiness, Edit, MessageCircle, RefreshCw, UserPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { initialsFromName } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface ContactHeaderProps {
  backPath: string;
  name: string;
  subtitle?: string;
  company?: string | null;
  assignedToName?: string | null;
  stageLabel: string;
  stageClassName?: string;
  estimatedValueLabel: string;
  onEdit: () => void;
  onOpenWhatsapp: () => void;
  onChangeStage: () => void;
  onAssign: () => void;
}

export function ContactHeader({
  backPath,
  name,
  subtitle,
  stageLabel,
  stageClassName,
  estimatedValueLabel,
  onEdit,
  onOpenWhatsapp,
  onChangeStage,
  onAssign,
}: ContactHeaderProps) {
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
              {initialsFromName(name)}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h1 className="truncate text-lg font-semibold tracking-tight text-foreground">
                  {name}
                </h1>
                <Badge
                  variant="outline"
                  className={cn('cursor-default', stageClassName)}
                >
                  {stageLabel}
                </Badge>
                <span className="text-lg font-semibold text-foreground">{estimatedValueLabel}</span>
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

        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" className="h-9 gap-1.5 px-3" onClick={onEdit}>
            <Edit className="size-4" />
            Editar
          </Button>
          <Button
            size="sm"
            className="h-9 gap-1.5 bg-whatsapp px-3 text-whatsapp-foreground hover:bg-whatsapp/90"
            onClick={onOpenWhatsapp}
            title="WhatsApp · Evolution GO"
          >
            <MessageCircle className="size-4" />
            WhatsApp
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
