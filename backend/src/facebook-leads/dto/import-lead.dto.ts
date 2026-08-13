import { IsIn, IsOptional, IsString } from 'class-validator';

export class ImportFlotaDto {
  @IsString()
  nombreCompleto!: string;

  @IsString()
  celular!: string;

  @IsOptional()
  @IsString()
  redSocial?: string;

  @IsOptional()
  @IsString()
  operador?: string;

  @IsOptional()
  @IsString()
  modalidad?: string;

  @IsOptional()
  @IsString()
  ciudad?: string;

  @IsOptional()
  @IsString()
  distrito?: string;

  @IsOptional()
  @IsString()
  edad?: string;

  @IsOptional()
  @IsString()
  anioVehiculo?: string;

  @IsOptional()
  @IsString()
  placa?: string;

  @IsOptional()
  @IsString()
  observaciones?: string;
}

export class ImportComercialDto {
  @IsOptional()
  @IsIn(['contacto', 'empresa', 'oportunidad'])
  entityType?: 'contacto' | 'empresa' | 'oportunidad';

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  telefono?: string;

  @IsOptional()
  @IsString()
  correo?: string;

  @IsOptional()
  @IsString()
  cargo?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  ruc?: string;

  @IsOptional()
  @IsString()
  dominio?: string;

  @IsOptional()
  @IsString()
  distrito?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  amount?: string;

  @IsOptional()
  @IsString()
  etapa?: string;

  @IsOptional()
  @IsString()
  expectedCloseDate?: string;

  @IsOptional()
  @IsString()
  contactName?: string;
}
