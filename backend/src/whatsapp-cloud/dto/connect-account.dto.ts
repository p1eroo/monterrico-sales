import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class ConnectWhatsAppCloudDto {
  @IsString()
  displayName!: string;

  @IsString()
  wabaId!: string;

  @IsString()
  phoneNumberId!: string;

  @IsString()
  accessToken!: string;

  @IsString()
  @IsOptional()
  graphApiVersion?: string;

  @IsBoolean()
  @IsOptional()
  setAsDefault?: boolean;
}
