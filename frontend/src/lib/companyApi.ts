import { api } from '@/lib/api';

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

/** Respuesta paginada de GET /companies */
export type CompanyListPaginatedResponse = {
  data: ApiCompanyRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

/** Listar empresas paginado */
export async function companyListPaginated(params?: {
  page?: number;
  limit?: number;
  search?: string;
  rubro?: string;
  tipo?: string;
}): Promise<CompanyListPaginatedResponse> {
  const sp = new URLSearchParams();
  if (params?.page != null) sp.set('page', String(params.page));
  if (params?.limit != null) sp.set('limit', String(params.limit));
  if (params?.search?.trim()) sp.set('search', params.search.trim());
  if (params?.rubro?.trim()) sp.set('rubro', params.rubro.trim());
  if (params?.tipo?.trim()) sp.set('tipo', params.tipo.trim());
  const qs = sp.toString();
  const url = qs ? `/companies?${qs}` : '/companies';
  return api<CompanyListPaginatedResponse>(url);
}

/** Listar todas las empresas (hasta 5000) para Empresas, ContactoDetail, etc. */
export async function companyListAll(opts?: {
  rubro?: string;
  tipo?: string;
}): Promise<ApiCompanyRecord[]> {
  const sp = new URLSearchParams();
  sp.set('limit', '5000');
  sp.set('page', '1');
  if (opts?.rubro?.trim()) sp.set('rubro', opts.rubro.trim());
  if (opts?.tipo?.trim()) sp.set('tipo', opts.tipo.trim());
  const res = await api<CompanyListPaginatedResponse>(
    `/companies?${sp.toString()}`,
  );
  return res.data;
}

/** IDs generados por Prisma cuid() suelen empezar por "c" y tener ~25 caracteres. */
export function isLikelyCompanyCuid(value: string): boolean {
  const v = value.trim();
  if (v.length < 20 || v.length > 32) return false;
  return /^c[a-z0-9]+$/i.test(v);
}
