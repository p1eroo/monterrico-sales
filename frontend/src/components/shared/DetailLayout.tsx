import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DetailLayoutProps {
  backPath: string;
  title: string;
  subtitle?: string;
  titleIcon?: React.ReactNode;
  header?: React.ReactNode;
  headerActions?: React.ReactNode;
  quickActions?: React.ReactNode;
  summaryCards?: React.ReactNode;
  children: React.ReactNode;
  sidebar?: React.ReactNode;
  className?: string;
}

export function DetailLayout({
  backPath,
  title,
  subtitle,
  titleIcon,
  header,
  headerActions,
  quickActions,
  summaryCards,
  children,
  sidebar,
  className,
}: DetailLayoutProps) {
  const navigate = useNavigate();

  return (
    <div className={cn('text-text-primary', className)}>
      {header ?? (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 rounded-lg border border-border bg-surface-elevated text-text-secondary hover:bg-surface-hover hover:text-text-primary"
              onClick={() => navigate(backPath)}
            >
              <ArrowLeft className="size-5" />
            </Button>
            {titleIcon}
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-text-primary">{title}</h1>
              {subtitle && <p className="mt-0.5 text-sm text-text-secondary">{subtitle}</p>}
            </div>
          </div>
          {headerActions && (
            <div className="flex flex-wrap gap-2">
              {headerActions}
            </div>
          )}
        </div>
      )}

      <div className="mx-auto w-full max-w-7xl pt-2 md:pt-4">
        <div
          className={cn(
            'flex flex-col items-start gap-6',
            sidebar && 'lg:flex-row',
          )}
        >
          <div className="min-w-0 flex-1 space-y-6 lg:max-w-[65%]">
            {quickActions}
            {summaryCards}
            {children}
          </div>
          {sidebar ? (
            <aside className="w-full space-y-4 lg:w-[35%] lg:flex-shrink-0 lg:pt-14">
              {sidebar}
            </aside>
          ) : null}
        </div>
      </div>
    </div>
  );
}
