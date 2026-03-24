import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EntitySyncService } from './entity-sync.service';

@Module({
  imports: [PrismaModule],
  providers: [EntitySyncService],
  exports: [EntitySyncService],
})
export class SyncModule {}
