import { Module } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { CompaniesController } from './companies.controller';
import { SyncModule } from '../sync/sync.module';
import { AuthModule } from '../auth/auth.module';
import { ClientsModule } from '../clients/clients.module';
import { CrmConfigModule } from '../crm-config/crm-config.module';
import { ActivityLogsModule } from '../activity-logs/activity-logs.module';
import { AuditDetailModule } from '../audit-detail/audit-detail.module';

@Module({
  imports: [
    SyncModule,
    AuthModule,
    ClientsModule,
    CrmConfigModule,
    ActivityLogsModule,
    AuditDetailModule,
  ],
  controllers: [CompaniesController],
  providers: [CompaniesService],
  exports: [CompaniesService],
})
export class CompaniesModule {}
