import { useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  children: React.ReactNode;
  className?: string;
  maxHeight?: string;
}

export function TableWithStickyScroll({ children, className, maxHeight }: Props) {
  const scrollWrapperRef = useRef<HTMLDivElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  const syncScroll = useCallback(() => {
    if (mirrorRef.current && scrollWrapperRef.current) {
      mirrorRef.current.scrollLeft = scrollWrapperRef.current.scrollLeft;
    }
  }, []);

  const syncMirror = useCallback(() => {
    if (mirrorRef.current && scrollWrapperRef.current) {
      scrollWrapperRef.current.scrollLeft = mirrorRef.current.scrollLeft;
    }
  }, []);

  useEffect(() => {
    const el = scrollWrapperRef.current;
    if (!el) return;
    el.addEventListener('scroll', syncScroll, { passive: true });
    return () => el.removeEventListener('scroll', syncScroll);
  }, [syncScroll]);

  useEffect(() => {
    const el = mirrorRef.current;
    if (!el) return;
    el.addEventListener('scroll', syncMirror, { passive: true });
    return () => el.removeEventListener('scroll', syncMirror);
  }, [syncMirror]);

  useEffect(() => {
    const el = scrollWrapperRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      if (mirrorRef.current && innerRef.current) {
        mirrorRef.current.innerHTML = '';
        const clone = document.createElement('div');
        clone.style.width = innerRef.current.scrollWidth + 'px';
        clone.style.height = '1px';
        mirrorRef.current.appendChild(clone);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div className={cn('flex flex-col overflow-hidden rounded-xl bg-background', className)} style={maxHeight ? { maxHeight } : undefined}>
      <div
        ref={scrollWrapperRef}
        className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
      >
        <div ref={innerRef}>
          {children}
        </div>
      </div>
      <div
        ref={mirrorRef}
        className="shrink-0 overflow-x-auto scrollbar-thin rounded-b-xl"
        style={{ height: 13 }}
      />
    </div>
  );
}
