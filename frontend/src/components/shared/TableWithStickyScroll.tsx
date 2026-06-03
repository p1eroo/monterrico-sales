import { useRef } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  children: React.ReactNode;
  className?: string;
  maxHeight?: string;
}

export function TableWithStickyScroll({ children, className, maxHeight }: Props) {
  const scrollWrapperRef = useRef<HTMLDivElement>(null);

  return (
    <div className={cn('flex flex-col overflow-hidden rounded-xl bg-background', className)} style={maxHeight ? { maxHeight } : undefined}>
      <div
        ref={scrollWrapperRef}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-auto scrollbar-thin"
        style={{ scrollbarWidth: 'thin' }}
      >
        <div>
          {children}
        </div>
      </div>
    </div>
  );
}
