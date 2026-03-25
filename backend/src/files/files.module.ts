import { Module } from '@nestjs/common';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';
import { S3StorageService } from './s3-storage.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { MediaModule } from '../media/media.module';

@Module({
  imports: [PrismaModule, AuthModule, MediaModule],
  controllers: [FilesController],
  providers: [FilesService, S3StorageService],
  exports: [FilesService],
})
export class FilesModule {}
