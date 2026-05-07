import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { FlotaProspectosController } from './flota-prospectos.controller';
import { FlotaProspectosService } from './flota-prospectos.service';
import { GoogleSheetsService } from './google-sheets.service';

@Module({
  imports: [PrismaModule],
  controllers: [FlotaProspectosController],
  providers: [FlotaProspectosService, GoogleSheetsService],
  exports: [FlotaProspectosService],
})
export class FlotaProspectosModule {}
