import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ActivityLogsModule } from '../activity-logs/activity-logs.module';
import { AuditDetailModule } from '../audit-detail/audit-detail.module';
import { AuthModule } from '../auth/auth.module';
import { ImportExportModule } from '../import-export/import-export.module';
import { FlotaProspectosController } from './flota-prospectos.controller';
import { FlotaProspectosService } from './flota-prospectos.service';
import { FlotaOperadorStatsScheduler } from './flota-operador-stats.scheduler';
import { GoogleSheetsService } from './google-sheets.service';

@Module({
  imports: [PrismaModule, ActivityLogsModule, AuditDetailModule, AuthModule, ImportExportModule],
  controllers: [FlotaProspectosController],
  providers: [FlotaProspectosService, GoogleSheetsService, FlotaOperadorStatsScheduler],
  exports: [FlotaProspectosService],
})
export class FlotaProspectosModule {}
