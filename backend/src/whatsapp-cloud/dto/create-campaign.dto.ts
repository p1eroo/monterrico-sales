import { IsArray, IsISO8601, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CampaignRecipientDto {
  @IsString()
  phone!: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  company?: string;

  @IsString()
  @IsOptional()
  source?: string;

  /** Prospecto Flota vinculado: al enviar OK se marca como contactado. */
  @IsString()
  @IsOptional()
  flotaProspectoId?: string;
}

export class CreateWhatsAppCampaignDto {
  @IsString()
  accountId!: string;

  @IsString()
  templateId!: string;

  @IsObject()
  variableMapping!: Record<string, string>;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CampaignRecipientDto)
  recipients!: CampaignRecipientDto[];

  @IsString()
  @IsOptional()
  name?: string;

  /** ISO UTC. Si es futuro, la campaña queda en status `scheduled` (hora Perú en el cliente). */
  @IsOptional()
  @IsISO8601()
  scheduledAt?: string;
}
