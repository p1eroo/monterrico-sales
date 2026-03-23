/** Respuesta JSON de GET/POST/PATCH /companies */
export type ApiCompanyRecord = {
  id: string;
  name: string;
  razonSocial?: string | null;
  ruc?: string | null;
  telefono?: string | null;
  domain?: string | null;
  rubro?: string | null;
  tipo?: string | null;
  linkedin?: string | null;
  correo?: string | null;
  distrito?: string | null;
  provincia?: string | null;
  departamento?: string | null;
  direccion?: string | null;
  createdAt: string;
  updatedAt: string;
};

/** IDs generados por Prisma cuid() suelen empezar por "c" y tener ~25 caracteres. */
export function isLikelyCompanyCuid(value: string): boolean {
  const v = value.trim();
  if (v.length < 20 || v.length > 32) return false;
  return /^c[a-z0-9]+$/i.test(v);
}
