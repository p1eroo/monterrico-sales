export type ExternalClienteEmpresaRow = {
  idclienteempresa: number;
  codigoempresa: string;
  rucempresa?: string;
  logoempresa?: string;
  razonsocial: string;
  nombrecomercial: string;
  contacto: string;
  contactoemail: string;
  telefono?: string;
  asesorresponsable: string;
  fechor: string;
  tipopagodetalle?: string;
  mes1?: string;
  monto1?: number;
  mes2?: string;
  monto2?: number;
  mes3?: string;
  monto3?: number;
  mes4?: string;
  monto4?: number;
  mes5?: string;
  monto5?: number;
};

export type ExternalClienteEmpresaResponse = {
  detalle: string;
  ARegistrados: ExternalClienteEmpresaRow[];
};
