import { Module } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { CompanyStaleEtapaService } from './company-stale-etapa.service';
import { CompanyStaleEtapaScheduler } from './company-stale-etapa.scheduler';
import { CompanyLogoService } from './company-logo.service';
import { CompaniesController } from './companies.controller';
import { SyncModule } from '../sync/sync.module';
import { AuthModule } from '../auth/auth.module';
import { CrmConfigModule } from '../crm-config/crm-config.module';
import { ActivityLogsModule } from '../activity-logs/activity-logs.module';
import { AuditDetailModule } from '../audit-detail/audit-detail.module';
import { FactilizaModule } from '../factiliza/factiliza.module';
import { FilesModule } from '../files/files.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    SyncModule,
    AuthModule,
    CrmConfigModule,
    ActivityLogsModule,
    AuditDetailModule,
    FactilizaModule,
    FilesModule,
    PrismaModule,
  ],
  controllers: [CompaniesController],
  providers: [CompaniesService, CompanyStaleEtapaService, CompanyStaleEtapaScheduler, CompanyLogoService],
  exports: [CompaniesService, CompanyLogoService],
})
export class CompaniesModule {}
