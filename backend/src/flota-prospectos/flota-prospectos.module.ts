import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ActivityLogsModule } from '../activity-logs/activity-logs.module';
import { FlotaProspectosController } from './flota-prospectos.controller';
import { FlotaProspectosService } from './flota-prospectos.service';
import { GoogleSheetsService } from './google-sheets.service';

@Module({
  imports: [PrismaModule, ActivityLogsModule],
  controllers: [FlotaProspectosController],
  providers: [FlotaProspectosService, GoogleSheetsService],
  exports: [FlotaProspectosService],
})
export class FlotaProspectosModule {}
