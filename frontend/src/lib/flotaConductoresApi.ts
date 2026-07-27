export interface Conductor {
  id?: string;
  idasociado: number;
  imaasoc?: string;
  codigo: string;
  nombres: string;
  apellidos: string;
  tipodocumento: string;
  ndni: string;
  telefonop: string;
  telefonosp?: string;
  telefonos: string;
  nplaca: string;
  marca?: string;
  modelo?: string;
  color?: string;
  anio?: string;
  dcasa?: string;
  latitude?: number;
  longitude?: number;
  dubicacion?: string;
  zona?: string;
  latasoc?: number;
  latlong?: number;
  idestado?: number;
  estado: string;
  idreserva?: number;
  versionapp?: string;
  fechor?: string;
  antecedentes?: boolean;
  evaluacionantecedentes?: string;
  codigoqr?: string;
  tipocombustible?: string;
  agente: string;
  fechorregistro: string;
  fexlan?: boolean;
  separacionservicio?: boolean;
  sunat?: boolean;
  datequipo?: string;
  turno?: string;
  turnosabado?: string;
  turnodomingo?: string;
  departamento?: string;
}

export interface ConductorDatos {
  imaasoc?: string;
  tipodocumento?: string;
  ndni?: string;
  apellidos?: string;
  nombres?: string;
  telefonop?: string;
  telefonos?: string;
  email?: string;
  sexo?: string;
  fecnac?: string;
  direccion?: string;
  distrito?: string;
  referencia?: string;
  latitude?: number;
  longitude?: number;
  brevete?: string;
  brevetecategoria?: string;
  brevetefec?: string;
  brevetefecemision?: string;
  breveteexpedicion?: string;
  brevetecentroemision?: string;
  breveterestriccion?: string;
  brevetemensaje?: string;
  breveteinfraccionacumulado?: number;
  brevetepuntosacumulados?: number;
  breveteestado?: string;
  atu?: boolean;
  atucredencial?: string;
  atuemision?: string;
  atuvencimiento?: string;
  atucondicion?: string;
  atumodalidad?: string;
  carneseguridadvial?: boolean;
  carneseguridadvialfecven?: string;
  iingles?: boolean;
  ichinomandarin?: boolean;
  ialeman?: boolean;
  ifrances?: boolean;
  iportugues?: boolean;
  autoasignacion?: boolean;
  manuals?: boolean;
  findesemana?: boolean;
  separacionservicio?: boolean;
  pagoinmediato?: boolean;
  fexlan?: boolean;
  sunat?: boolean;
  placa?: string;
  tipomovil?: string;
  turno?: string;
  observaciones?: string;
  departamento?: string;
}

export interface ConductorSede {
  idsucursales: number;
  departamento: string;
}

export interface ConductorDetalleResponse {
  detalle?: string;
  ODatos: ConductorDatos;
  ASedes?: ConductorSede[];
  estatus: number;
  message: string;
  msystem?: string;
}

export interface ConductorDocumentacion {
  fdocumentoa?: string;
  fdocumentob?: string;
  flicenciaa?: string;
  flicenciab?: string;
  fsoat?: string;
  ftarjetaa?: string;
  ftarjetab?: string;
  atu?: string;
  tarjetacirculacion?: string;
}

export interface ConductorDocumentacionResponse {
  detalle?: string;
  ODocumentacion: ConductorDocumentacion;
  estatus: number;
  message: string;
  msystem?: string;
}

export const CONDUCTOR_DOCUMENTO_ITEMS: {
  key: keyof ConductorDocumentacion;
  label: string;
}[] = [
  { key: "fdocumentoa", label: "Documento (Anverso)" },
  { key: "fdocumentob", label: "Documento (Reverso)" },
  { key: "flicenciaa", label: "Licencia (Anverso)" },
  { key: "flicenciab", label: "Licencia (Reverso)" },
  { key: "fsoat", label: "SOAT" },
  { key: "ftarjetaa", label: "Tarjeta Prop. (Anverso)" },
  { key: "ftarjetab", label: "Tarjeta Prop. (Reverso)" },
  { key: "atu", label: "ATU" },
  { key: "tarjetacirculacion", label: "Tarjeta Circulación" },
];

function normalizeEstado(estado: string): string {
  if (!estado) return "DESCONOCIDO";
  const normalized = estado.toUpperCase().trim();
  if (normalized.includes("DISPONIBLE") && !normalized.includes("NO")) return "DISPONIBLE";
  if (normalized.includes("NO DISPONIBLE") || normalized.includes("CERRAR")) return "NO DISPONIBLE";
  if (normalized.includes("SESION") && !normalized.includes("DISPONIBLE")) return "NO DISPONIBLE";
  if (normalized.includes("CAPACITACION") || normalized.includes("CAPACITACIÓN"))
    return "EN CAPACITACION";
  if (normalized.includes("SIMULACION") || normalized.includes("SIMULACIÓN"))
    return "EN SIMULACION";
  if (normalized === "ACTIVO") return "ACTIVO";
  if (normalized === "INACTIVO") return "INACTIVO";
  return normalized;
}

const API_URL = "https://api.taximonterrico.com/api/WAsociados/registrados";
const DETALLE_API_URL = "https://api.taximonterrico.com/api/wasociados/Datos";
const DOCUMENTACION_API_URL =
  "https://api.taximonterrico.com/api/WAsociados/Documentacion";

export async function getConductorDocumentacion(
  idasociado: number,
): Promise<ConductorDocumentacionResponse> {
  const res = await fetch(`${DOCUMENTACION_API_URL}?idasociado=${idasociado}`);
  if (!res.ok) {
    throw new Error(`Error fetching documentación: ${res.statusText}`);
  }
  const data = (await res.json()) as ConductorDocumentacionResponse;
  if (data.estatus !== 200 || !data.ODocumentacion) {
    throw new Error(data.message || "No se pudo cargar la documentación");
  }
  return data;
}

export async function getConductorDetalle(
  idasociado: number,
): Promise<ConductorDetalleResponse> {
  const res = await fetch(`${DETALLE_API_URL}?idasociado=${idasociado}`);
  if (!res.ok) {
    throw new Error(`Error fetching detalle conductor: ${res.statusText}`);
  }
  const data = (await res.json()) as ConductorDetalleResponse;
  if (data.estatus !== 200 || !data.ODatos) {
    throw new Error(data.message || "No se pudo cargar el detalle del conductor");
  }
  return data;
}

export async function getConductores(idestado = 0): Promise<Conductor[]> {
  const res = await fetch(`${API_URL}?idestado=${idestado}`);
  if (!res.ok) {
    throw new Error(`Error fetching conductores: ${res.statusText}`);
  }
  const data = await res.json();
  if (data.ARegistrados && Array.isArray(data.ARegistrados)) {
    return (data.ARegistrados as Conductor[]).map((c) => ({
      ...c,
      id: c.id ?? String(c.idasociado),
      estado: normalizeEstado(c.estado),
    }));
  }
  if (Array.isArray(data)) return data as Conductor[];
  if (data.data && Array.isArray(data.data)) return data.data as Conductor[];
  return [];
}

export async function getConductorTelefonos(): Promise<{
  telefonos: string[];
  codigoByTelefono: Record<string, string>;
}> {
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
      for (const part of c.telefonop.split("/")) {
        const n = normalizarTelefono(part);
        if (n.length >= 6) {
          telefonos.add(n);
          if (codigo) codigoByTelefono[n] = codigo;
        }
      }
    }
    if (c.telefonos) {
      for (const part of c.telefonos.split("/")) {
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
  if (!telefono) return "";
  return telefono.replace(/\D/g, "").replace(/^51/, "");
}
