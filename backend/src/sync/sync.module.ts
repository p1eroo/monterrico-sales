import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ClientsModule } from '../clients/clients.module';
import { CrmConfigModule } from '../crm-config/crm-config.module';
import { EntitySyncService } from './entity-sync.service';

@Module({
  imports: [PrismaModule, ClientsModule, CrmConfigModule],
  providers: [EntitySyncService],
  exports: [EntitySyncService],
})
export class SyncModule {}
