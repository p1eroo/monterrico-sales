import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FacebookLeadsController } from './facebook-leads.controller';
import { FacebookLeadsWebhookController } from './facebook-leads-webhook.controller';
import { FacebookLeadsService } from './facebook-leads.service';
import { FacebookGraphApiService } from './facebook-graph-api.service';
import { FacebookLeadsScheduler } from './facebook-leads.scheduler';

@Module({
  imports: [AuthModule],
  controllers: [FacebookLeadsController, FacebookLeadsWebhookController],
  providers: [FacebookLeadsService, FacebookGraphApiService, FacebookLeadsScheduler],
  exports: [FacebookLeadsService],
})
export class FacebookLeadsModule {}
