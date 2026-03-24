import { Module } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { CompaniesController } from './companies.controller';
import { SyncModule } from '../sync/sync.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [SyncModule, AuthModule],
  controllers: [CompaniesController],
  providers: [CompaniesService],
})
export class CompaniesModule {}
