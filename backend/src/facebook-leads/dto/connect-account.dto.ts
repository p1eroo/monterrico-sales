import { IsString, IsOptional } from 'class-validator';

export class ConnectAccountDto {
  @IsString()
  pageId!: string;

  @IsString()
  pageName!: string;

  @IsString()
  pageAccessToken!: string;

  @IsString()
  @IsOptional()
  pageTokenExpiresAt?: string;

  @IsString()
  @IsOptional()
  instagramId?: string;
}
