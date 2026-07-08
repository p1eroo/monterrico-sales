import { useState } from 'react';
import { API_BASE } from '@/lib/api';
import { cn } from '@/lib/utils';

interface SenderAvatarProps {
  /** Remitente en formato "Nombre <correo@dominio>" o solo el correo. */
  from: string;
  /** Clases para el contenedor (por defecto size-10). */
  className?: string;
}

/**
 * Avatar del remitente de un correo. Intenta el logo del dominio (mismo
 * pipeline que empresas: MinIO -> DuckDuckGo) y hace fallback a la inicial.
 */
export function SenderAvatar({ from, className }: SenderAvatarProps) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const initial =
    (from || '?')
      .replace(/<.*>/, '')
      .trim()
      .charAt(0)
      .toUpperCase() || '?';

  const base =
    'relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full';

  if (failed || !from) {
    return (
      <div className={cn(base, 'bg-[#13944C]/10 font-semibold text-[#13944C]', className)}>
        {initial}
      </div>
    );
  }

  return (
    <div
      className={cn(
        base,
        loaded ? 'border bg-white' : 'bg-[#13944C]/10 font-semibold text-[#13944C]',
        className,
      )}
    >
      {!loaded && <span>{initial}</span>}
      <img
        src={`${API_BASE}/gmail/sender-avatar?from=${encodeURIComponent(from)}`}
        alt=""
        className={cn('absolute inset-0 size-full object-contain p-1', !loaded && 'hidden')}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />
    </div>
  );
}
