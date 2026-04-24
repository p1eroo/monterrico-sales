import { Module } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { CompanyStaleEtapaService } from './company-stale-etapa.service';
import { CompanyStaleEtapaScheduler } from './company-stale-etapa.scheduler';
import { CompaniesController } from './companies.controller';
import { SyncModule } from '../sync/sync.module';
import { AuthModule } from '../auth/auth.module';
import { ClientsModule } from '../clients/clients.module';
import { CrmConfigModule } from '../crm-config/crm-config.module';
import { ActivityLogsModule } from '../activity-logs/activity-logs.module';
import { AuditDetailModule } from '../audit-detail/audit-detail.module';
import { FactilizaModule } from '../factiliza/factiliza.module';

@Module({
  imports: [
    SyncModule,
    AuthModule,
    ClientsModule,
    CrmConfigModule,
    ActivityLogsModule,
    AuditDetailModule,
    FactilizaModule,
  ],
  controllers: [CompaniesController],
  providers: [CompaniesService, CompanyStaleEtapaService, CompanyStaleEtapaScheduler],
  exports: [CompaniesService],
})
export class CompaniesModule {}
