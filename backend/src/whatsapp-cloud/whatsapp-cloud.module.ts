import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WhatsappCloudController } from './whatsapp-cloud.controller';
import { WhatsappCloudService } from './whatsapp-cloud.service';
import { MetaGraphApiService } from './meta-graph-api.service';

@Module({
  imports: [AuthModule],
  controllers: [WhatsappCloudController],
  providers: [WhatsappCloudService, MetaGraphApiService],
  exports: [WhatsappCloudService],
})
export class WhatsappCloudModule {}
