import { IsArray, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
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
}
