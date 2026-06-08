import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { navigateBackOrTo } from '@/lib/navigateBackOrTo';
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
  /** Columna derecha (p. ej. vinculados). */
  sidebar?: React.ReactNode;
  /** Columna izquierda (p. ej. información del contacto). Si existe junto con `sidebar`, hay 3 columnas en `xl`. */
  leftAside?: React.ReactNode;
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
  leftAside,
  className,
}: DetailLayoutProps) {
  const navigate = useNavigate();
  const threeColumn = Boolean(leftAside && sidebar);
  const twoColumnSidebar = Boolean(sidebar && !leftAside);

  return (
    <div className={cn('text-text-primary', className)}>
      {header ?? (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 rounded-lg border border-border bg-surface-elevated text-text-secondary hover:bg-surface-hover hover:text-text-primary"
              onClick={() => navigateBackOrTo(navigate, backPath)}
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

      <div
        className={cn(
          'mx-auto w-full pt-2 md:pt-6',
          threeColumn ? 'max-w-[min(100%,108rem)]' : 'max-w-7xl',
        )}
      >
        <div
          className={cn(
            'flex flex-col gap-6',
            /* Tres columnas: en stack (<xl) la columna central debe ocupar todo el ancho; items-start la dejaba al ancho del contenido. */
            threeColumn
              ? 'items-stretch xl:grid xl:[grid-template-columns:minmax(0,12fr)_minmax(0,24fr)_minmax(0,12fr)] xl:items-start'
              : 'items-start',
            twoColumnSidebar && 'lg:flex-row',
          )}
        >
          {leftAside ? (
            <aside
              className={cn(
                'w-full space-y-4',
                threeColumn && 'min-w-0',
              )}
            >
              {leftAside}
            </aside>
          ) : null}
          <div
            className={cn(
              'min-w-0 flex-1 space-y-6',
              twoColumnSidebar && 'lg:max-w-[65%]',
            )}
          >
            {quickActions}
            {summaryCards}
            {children}
          </div>
          {sidebar ? (
            <aside
              className={cn(
                'w-full space-y-4',
                twoColumnSidebar && 'lg:w-[35%] lg:flex-shrink-0 lg:pt-14',
                threeColumn && 'min-w-0',
              )}
            >
              {sidebar}
            </aside>
          ) : null}
        </div>
      </div>
    </div>
  );
}
