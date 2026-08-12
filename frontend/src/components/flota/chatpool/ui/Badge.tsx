import { cn } from '@/lib/utils';

interface BadgeProps {
  count: number;
  className?: string;
}

export function ChatpoolBadge({ count, className }: BadgeProps) {
  if (count <= 0) return null;
  return (
    <span
      className={cn(
        'bg-primary text-primary-foreground text-[10px] font-semibold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 leading-none',
        className,
      )}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}
