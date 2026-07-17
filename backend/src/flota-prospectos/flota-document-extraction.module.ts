import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DocumentVisionService } from './document-vision.service';
import { FlotaDocumentExtractionService } from './flota-document-extraction.service';

@Module({
  imports: [PrismaModule],
  providers: [DocumentVisionService, FlotaDocumentExtractionService],
  exports: [FlotaDocumentExtractionService],
})
export class FlotaDocumentExtractionModule {}
