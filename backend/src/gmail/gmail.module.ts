import { Module } from '@nestjs/common';
import { GmailService } from './gmail.service';
import { GmailController } from './gmail.controller';
import { SyncModule } from '../sync/sync.module';
import { CompaniesModule } from '../companies/companies.module';

@Module({
  imports: [SyncModule, CompaniesModule],
  providers: [GmailService],
  controllers: [GmailController],
  exports: [GmailService],
})
export class GmailModule {}
