import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ActivityLogsModule } from '../activity-logs/activity-logs.module';
import { FlotaConductorMatchService } from './flota-conductor-match.service';

@Global()
@Module({
  imports: [PrismaModule, ActivityLogsModule],
  providers: [FlotaConductorMatchService],
  exports: [FlotaConductorMatchService],
})
export class FlotaConductorMatchModule {}
