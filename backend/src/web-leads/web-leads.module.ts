import { Module } from '@nestjs/common';
import { WebLeadsController } from './web-leads.controller';
import { WebLeadsService } from './web-leads.service';

@Module({
  controllers: [WebLeadsController],
  providers: [WebLeadsService],
})
export class WebLeadsModule {}
