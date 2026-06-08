import { Module } from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { ContactsController } from './contacts.controller';
import { SyncModule } from '../sync/sync.module';
import { AuthModule } from '../auth/auth.module';
import { CrmConfigModule } from '../crm-config/crm-config.module';
import { ActivityLogsModule } from '../activity-logs/activity-logs.module';
import { AuditDetailModule } from '../audit-detail/audit-detail.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    SyncModule,
    AuthModule,
    CrmConfigModule,
    ActivityLogsModule,
    AuditDetailModule,
    NotificationsModule,
  ],
  controllers: [ContactsController],
  providers: [ContactsService],
  exports: [ContactsService],
})
export class ContactsModule {}
