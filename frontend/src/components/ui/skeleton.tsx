import { cn } from '@/lib/utils';

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        'relative overflow-hidden rounded-md bg-muted',
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        className={cn(
          'absolute inset-0 block',
          'bg-gradient-to-r from-transparent via-foreground/12 to-transparent',
          'dark:via-foreground/20',
          'animate-[skeleton-shimmer_1.6s_ease-in-out_infinite]',
        )}
      />
    </div>
  );
}

export { Skeleton };
