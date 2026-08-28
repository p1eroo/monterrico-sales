import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WhatsappCloudController } from './whatsapp-cloud.controller';
import { WhatsappCloudService } from './whatsapp-cloud.service';
import { MetaGraphApiService } from './meta-graph-api.service';
import { WhatsappBulkScheduleScheduler } from './whatsapp-bulk-schedule.scheduler';

@Module({
  imports: [AuthModule],
  controllers: [WhatsappCloudController],
  providers: [WhatsappCloudService, MetaGraphApiService, WhatsappBulkScheduleScheduler],
  exports: [WhatsappCloudService],
})
export class WhatsappCloudModule {}
