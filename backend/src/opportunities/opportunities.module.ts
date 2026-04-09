import { Module } from '@nestjs/common';
import { OpportunitiesService } from './opportunities.service';
import { OpportunitiesController } from './opportunities.controller';
import { SyncModule } from '../sync/sync.module';
import { AuthModule } from '../auth/auth.module';
import { CrmConfigModule } from '../crm-config/crm-config.module';
import { ActivityLogsModule } from '../activity-logs/activity-logs.module';
import { AuditDetailModule } from '../audit-detail/audit-detail.module';

@Module({
  imports: [
    SyncModule,
    AuthModule,
    CrmConfigModule,
    ActivityLogsModule,
    AuditDetailModule,
  ],
  controllers: [OpportunitiesController],
  providers: [OpportunitiesService],
  exports: [OpportunitiesService],
})
export class OpportunitiesModule {}
