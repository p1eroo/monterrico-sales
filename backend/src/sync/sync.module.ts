import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CrmConfigModule } from '../crm-config/crm-config.module';
import { ActivityLogsModule } from '../activity-logs/activity-logs.module';
import { AuditDetailModule } from '../audit-detail/audit-detail.module';
import { EntitySyncService } from './entity-sync.service';

@Module({
  imports: [PrismaModule, CrmConfigModule, ActivityLogsModule, AuditDetailModule],
  providers: [EntitySyncService],
  exports: [EntitySyncService],
})
export class SyncModule {}
