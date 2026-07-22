import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MediaUploadService } from './media-upload.service';
import { AudioConversionService } from './audio-conversion.service';

@Module({
  imports: [ConfigModule],
  providers: [MediaUploadService, AudioConversionService],
  exports: [MediaUploadService, AudioConversionService],
})
export class MediaModule {}
