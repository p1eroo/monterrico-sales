import { IsInt, IsOptional, Min, ValidateIf } from 'class-validator';

export class UpdateTemplateDailyLimitDto {
  /** null o omitido limpia el límite. Mínimo 1 si se define. */
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsInt()
  @Min(1)
  @IsOptional()
  dailySendLimit?: number | null;
}
