import { Module } from '@nestjs/common';
import { GmailService } from './gmail.service';
import { GmailController } from './gmail.controller';
import { SyncModule } from '../sync/sync.module';

@Module({
  imports: [SyncModule],
  providers: [GmailService],
  controllers: [GmailController],
  exports: [GmailService],
})
export class GmailModule {}
