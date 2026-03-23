/** Campos alineados con el modelo Prisma `Company` */
export class CreateCompanyDto {
  name!: string;
  razonSocial?: string;
  ruc?: string;
  telefono?: string;
  domain?: string;
  rubro?: string;
  tipo?: string;
  linkedin?: string;
  correo?: string;
  distrito?: string;
  provincia?: string;
  departamento?: string;
  direccion?: string;
}
