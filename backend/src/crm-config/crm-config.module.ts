import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CrmConfigService } from './crm-config.service';
import { CrmConfigController } from './crm-config.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [CrmConfigController],
  providers: [CrmConfigService],
  exports: [CrmConfigService],
})
export class CrmConfigModule {}
