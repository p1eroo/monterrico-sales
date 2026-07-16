import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, children, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-2',
        className
      )}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-lg font-bold tracking-tight sm:text-xl">{title}</h1>
        {description ? (
          <p className="text-[13px] text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children && (
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          {children}
        </div>
      )}
    </div>
  );
}
