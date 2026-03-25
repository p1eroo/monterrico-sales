import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MediaUploadService } from './media-upload.service';

@Module({
  imports: [ConfigModule],
  providers: [MediaUploadService],
  exports: [MediaUploadService],
})
export class MediaModule {}
