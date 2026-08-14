import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { WebLeadsController } from './web-leads.controller';
import { WebLeadsService } from './web-leads.service';

@Module({
  imports: [NotificationsModule],
  controllers: [WebLeadsController],
  providers: [WebLeadsService],
})
export class WebLeadsModule {}
