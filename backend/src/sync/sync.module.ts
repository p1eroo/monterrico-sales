import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CrmConfigModule } from '../crm-config/crm-config.module';
import { EntitySyncService } from './entity-sync.service';

@Module({
  imports: [PrismaModule, CrmConfigModule],
  providers: [EntitySyncService],
  exports: [EntitySyncService],
})
export class SyncModule {}
