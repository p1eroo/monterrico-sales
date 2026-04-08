import type { Etapa, CompanyRubro, CompanyTipo, ContactSource } from '@/types';

export interface NewCompanyData {
  ruc: string;
  razonSocial: string;
  rubro: CompanyRubro | '';
  tipoEmpresa: CompanyTipo | '';
  nombreComercial: string;
  telefono: string;
  distrito: string;
  provincia: string;
  departamento: string;
  direccion: string;
  dominio: string;
  linkedin: string;
  correo: string;
  origenLead: ContactSource | '';
  propietario: string;
  clienteRecuperado: 'si' | 'no';
  nombreNegocio: string;
  etapa: Etapa;
  facturacion: string;
  fechaCierre: string;
}

export const emptyNewCompanyForm: NewCompanyData = {
  ruc: '',
  razonSocial: '',
  rubro: '',
  tipoEmpresa: '',
  nombreComercial: '',
  telefono: '',
  distrito: '',
  provincia: '',
  departamento: '',
  direccion: '',
  dominio: '',
  linkedin: '',
  correo: '',
  origenLead: '',
  propietario: '',
  clienteRecuperado: 'no',
  nombreNegocio: '',
  etapa: 'lead',
  facturacion: '',
  fechaCierre: '',
};
