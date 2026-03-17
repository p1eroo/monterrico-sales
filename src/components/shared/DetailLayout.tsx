import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

interface DetailLayoutProps {
  backPath: string;
  title: string;
  subtitle?: string;
  titleIcon?: React.ReactNode;
  headerActions?: React.ReactNode;
  quickActions?: React.ReactNode;
  summaryCards?: React.ReactNode;
  children: React.ReactNode;
  sidebar?: React.ReactNode;
}

export function DetailLayout({
  backPath,
  title,
  subtitle,
  titleIcon,
  headerActions,
  quickActions,
  summaryCards,
  children,
  sidebar,
}: DetailLayoutProps) {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="shrink-0 h-9 w-9 rounded-lg text-muted-foreground hover:bg-emerald-50 hover:text-emerald-700" onClick={() => navigate(backPath)}>
            <ArrowLeft className="size-5" />
          </Button>
          {titleIcon}
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
            {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        {headerActions && (
          <div className="flex flex-wrap gap-2">
            {headerActions}
          </div>
        )}
      </div>

      <div className={`grid gap-6 items-start ${sidebar ? 'lg:grid-cols-[1fr_520px]' : ''}`}>
        <div className="space-y-6">
          {quickActions}
          {summaryCards}
          {children}
        </div>
        {sidebar && (
          <div className="space-y-4">
            {sidebar}
          </div>
        )}
      </div>
    </div>
  );
}
