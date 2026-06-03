export interface Conductor {
  id: string;
  idasociado: number;
  codigo: string;
  nombres: string;
  apellidos: string;
  tipodocumento: string;
  ndni: string;
  telefonop: string;
  telefonosp?: string;
  telefonos: string;
  nplaca: string;
  estado: string;
  agente: string;
  fechorregistro: string;
  sunat?: boolean;
}

function normalizeEstado(estado: string): string {
  if (!estado) return 'DESCONOCIDO';
  const normalized = estado.toUpperCase().trim();
  if (normalized.includes('DISPONIBLE') && !normalized.includes('NO')) return 'DISPONIBLE';
  if (normalized.includes('NO DISPONIBLE') || normalized.includes('CERRAR')) return 'NO DISPONIBLE';
  if (normalized.includes('SESION') && !normalized.includes('DISPONIBLE')) return 'NO DISPONIBLE';
  if (normalized.includes('CAPACITACION') || normalized.includes('CAPACITACIÓN')) return 'EN CAPACITACION';
  if (normalized.includes('SIMULACION') || normalized.includes('SIMULACIÓN')) return 'EN SIMULACION';
  if (normalized === 'ACTIVO') return 'ACTIVO';
  if (normalized === 'INACTIVO') return 'INACTIVO';
  return normalized;
}

const API_URL = 'https://api.taximonterrico.com/api/WAsociados/registrados';

export async function getConductores(): Promise<Conductor[]> {
  const res = await fetch(`${API_URL}?idestado=0`);
  if (!res.ok) {
    throw new Error(`Error fetching conductores: ${res.statusText}`);
  }
  const data = await res.json();
  if (data.ARegistrados && Array.isArray(data.ARegistrados)) {
    return (data.ARegistrados as Conductor[]).map((c) => ({
      ...c,
      estado: normalizeEstado(c.estado),
    }));
  }
  if (Array.isArray(data)) return data as Conductor[];
  if (data.data && Array.isArray(data.data)) return data.data as Conductor[];
  return [];
}

export async function getConductorTelefonos(): Promise<{ telefonos: string[]; codigoByTelefono: Record<string, string> }> {
  const res = await fetch(`${API_URL}?idestado=0`);
  if (!res.ok) {
    throw new Error(`Error fetching telefonos: ${res.statusText}`);
  }
  const data = await res.json();
  const conductores = data.ARegistrados || [];
  const telefonos = new Set<string>();
  const codigoByTelefono: Record<string, string> = {};
  for (const c of conductores) {
    const codigo = c.codigo?.trim();
    if (c.telefonop) {
      for (const part of c.telefonop.split('/')) {
        const n = normalizarTelefono(part);
        if (n.length >= 6) {
          telefonos.add(n);
          if (codigo) codigoByTelefono[n] = codigo;
        }
      }
    }
    if (c.telefonos) {
      for (const part of c.telefonos.split('/')) {
        const n = normalizarTelefono(part);
        if (n.length >= 6) {
          telefonos.add(n);
          if (codigo) codigoByTelefono[n] = codigo;
        }
      }
    }
  }
  return { telefonos: Array.from(telefonos), codigoByTelefono };
}

function normalizarTelefono(telefono: string): string {
  if (!telefono) return '';
  return telefono.replace(/\D/g, '').replace(/^51/, '');
}