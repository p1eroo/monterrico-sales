import { Module } from '@nestjs/common';
import { OpportunitiesService } from './opportunities.service';
import { OpportunitiesController } from './opportunities.controller';
import { SyncModule } from '../sync/sync.module';
import { AuthModule } from '../auth/auth.module';
import { CrmConfigModule } from '../crm-config/crm-config.module';

@Module({
  imports: [SyncModule, AuthModule, CrmConfigModule],
  controllers: [OpportunitiesController],
  providers: [OpportunitiesService],
  exports: [OpportunitiesService],
})
export class OpportunitiesModule {}
