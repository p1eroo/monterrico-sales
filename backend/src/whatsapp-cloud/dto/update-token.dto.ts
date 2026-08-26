import { IsString } from 'class-validator';

export class UpdateWhatsAppTokenDto {
  @IsString()
  accessToken!: string;
}
