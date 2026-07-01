import { Module } from '@nestjs/common';
import { GoogleCalendarService } from './google-calendar.service';
import { GoogleCalendarController } from './google-calendar.controller';
import { SyncModule } from '../sync/sync.module';

@Module({
  imports: [SyncModule],
  providers: [GoogleCalendarService],
  controllers: [GoogleCalendarController],
  exports: [GoogleCalendarService],
})
export class GoogleCalendarModule {}
