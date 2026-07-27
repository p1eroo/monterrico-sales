import { conductorEstadoBadgeProps } from '@/lib/flotaConductorEstadoUi';

export function ConductorEstadoBadge({ estado }: { estado: string | undefined | null }) {
  const { label, className } = conductorEstadoBadgeProps(estado);

  if (label === '—') {
    return <span className="text-[13px] text-[#475569] dark:text-gray-400">—</span>;
  }

  return (
    <span className={className} title={label}>
      {label}
    </span>
  );
}
