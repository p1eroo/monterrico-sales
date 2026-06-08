import type { CSSProperties } from 'react';

function hexToRgb(hex: string): [number, number, number] | null {
  const raw = hex.trim().replace(/^#/, '');
  if (!raw) return null;
  if (raw.length === 3) {
    const r = parseInt(raw[0] + raw[0], 16);
    const g = parseInt(raw[1] + raw[1], 16);
    const b = parseInt(raw[2] + raw[2], 16);
    if ([r, g, b].some((n) => Number.isNaN(n))) return null;
    return [r, g, b];
  }
  if (raw.length === 6) {
    const r = parseInt(raw.slice(0, 2), 16);
    const g = parseInt(raw.slice(2, 4), 16);
    const b = parseInt(raw.slice(4, 6), 16);
    if ([r, g, b].some((n) => Number.isNaN(n))) return null;
    return [r, g, b];
  }
  return null;
}

function relativeLuminance(r: number, g: number, b: number): number {
  const lin = (c: number) => {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  const R = lin(r);
  const G = lin(g);
  const B = lin(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/**
 * Estilo de badge de etapa a partir del hex guardado en CRM (Ajustes → etapas).
 * Fondo y borde con alpha; el texto oscurece un poco si el color es muy claro.
 */
export function stageBadgeStyleFromCatalogColor(color: string): CSSProperties | null {
  const rgb = hexToRgb(color);
  if (!rgb) return null;
  const [r, g, b] = rgb;
  const lum = relativeLuminance(r, g, b);
  let tr = r;
  let tg = g;
  let tb = b;
  if (lum > 0.72) {
    const mix = 0.5;
    tr = Math.round(r * (1 - mix));
    tg = Math.round(g * (1 - mix));
    tb = Math.round(b * (1 - mix));
  }
  return {
    borderColor: `rgba(${r}, ${g}, ${b}, 0.35)`,
    backgroundColor: `rgba(${r}, ${g}, ${b}, 0.15)`,
    color: `rgb(${tr}, ${tg}, ${tb})`,
  };
}
