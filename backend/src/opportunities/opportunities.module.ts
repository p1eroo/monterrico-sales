import { Module } from '@nestjs/common';
import { OpportunitiesService } from './opportunities.service';
import { OpportunitiesController } from './opportunities.controller';
import { SyncModule } from '../sync/sync.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [SyncModule, AuthModule],
  controllers: [OpportunitiesController],
  providers: [OpportunitiesService],
})
export class OpportunitiesModule {}
