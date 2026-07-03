export function GlassCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-[14px] border border-border/30 bg-white/30 overflow-hidden ${className ?? ''}`}
    >
      {children}
    </div>
  );
}
