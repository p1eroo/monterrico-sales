import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export function GlassCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      {children}
    </Card>
  );
}
