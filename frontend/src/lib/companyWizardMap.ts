import type { ContactSource, CompanyRubro, CompanyTipo, Etapa } from '@/types';
import {
  companyRubroLabels,
  companyTipoLabels,
  contactSourceLabels,
  etapaLabels,
} from '@/data/mock';
import { isLikelyContactCuid } from '@/lib/contactApi';
import type { NewCompanyData } from '@/lib/newCompanyData';
import type { ApiCompanyRecord } from '@/lib/companyApi';

/** Cuerpo PATCH /companies/:id desde el asistente de empresa. */
export function newCompanyDataToPatchBody(
  data: NewCompanyData,
): Record<string, unknown> {
  const monto = Number(data.facturacion);
  const body: Record<string, unknown> = {
    name: data.nombreComercial.trim(),
    razonSocial: data.razonSocial.trim() || undefined,
    ruc: data.ruc.replace(/\D/g, '').trim() || undefined,
    telefono: data.telefono.trim() || undefined,
    domain: data.dominio.trim() || undefined,
    rubro: data.rubro || undefined,
    tipo: data.tipoEmpresa || undefined,
    linkedin: data.linkedin.trim() || undefined,
    correo: data.correo.trim() || undefined,
    distrito: data.distrito.trim() || undefined,
    provincia: data.provincia.trim() || undefined,
    departamento: data.departamento.trim() || undefined,
    direccion: data.direccion.trim() || undefined,
    fuente: data.origenLead,
    clienteRecuperado: data.clienteRecuperado,
    etapa: data.etapa,
  };
  if (Number.isFinite(monto) && monto > 0) {
    body.facturacionEstimada = monto;
  }
  if (data.propietario && isLikelyContactCuid(data.propietario)) {
    body.assignedTo = data.propietario;
  }
  return body;
}

function isRubroKey(k: string): k is CompanyRubro {
  return Object.prototype.hasOwnProperty.call(companyRubroLabels, k);
}

function isTipoKey(k: string): k is CompanyTipo {
  return Object.prototype.hasOwnProperty.call(companyTipoLabels, k);
}

function isContactSourceKey(k: string): k is ContactSource {
  return Object.prototype.hasOwnProperty.call(contactSourceLabels, k);
}

function isEtapaKey(k: string): k is Etapa {
  return Object.prototype.hasOwnProperty.call(etapaLabels, k);
}

/** Mapea registro API → formulario del asistente (carga por RUC existente). */
export function mapApiCompanyRecordToNewCompanyData(
  c: ApiCompanyRecord,
): NewCompanyData {
  const fe = c.facturacionEstimada;
  const rubroRaw = c.rubro?.trim() ?? '';
  const tipoRaw = c.tipo?.trim() ?? '';
  const fuenteRaw = c.fuente?.trim() ?? '';
  const etapaRaw = c.etapa?.trim() ?? '';

  return {
    ruc: (c.ruc ?? '').replace(/\D/g, '').slice(0, 11) || (c.ruc ?? ''),
    razonSocial: c.razonSocial ?? '',
    rubro: rubroRaw && isRubroKey(rubroRaw) ? rubroRaw : '',
    tipoEmpresa: tipoRaw && isTipoKey(tipoRaw) ? tipoRaw : '',
    nombreComercial: c.name ?? '',
    telefono: c.telefono ?? '',
    distrito: c.distrito ?? '',
    provincia: c.provincia ?? '',
    departamento: c.departamento ?? '',
    direccion: c.direccion ?? '',
    dominio: c.domain ?? '',
    linkedin: c.linkedin ?? '',
    correo: c.correo ?? '',
    origenLead:
      fuenteRaw && isContactSourceKey(fuenteRaw) ? fuenteRaw : 'base',
    propietario: c.assignedTo ?? '',
    clienteRecuperado: c.clienteRecuperado === 'si' ? 'si' : 'no',
    nombreNegocio: c.name ?? '',
    etapa: etapaRaw && isEtapaKey(etapaRaw) ? etapaRaw : 'lead',
    facturacion:
      fe != null && Number.isFinite(fe) && fe > 0 ? String(fe) : '',
    fechaCierre: '',
  };
}
