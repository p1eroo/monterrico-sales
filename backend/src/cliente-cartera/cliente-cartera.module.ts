import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { ClienteCarteraController } from './cliente-cartera.controller';
import { ClienteCarteraService } from './cliente-cartera.service';
import { ClienteCarteraSyncService } from './cliente-cartera-sync.service';
import { ClienteCarteraAnalyticsService } from './cliente-cartera-analytics.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ClienteCarteraController],
  providers: [
    ClienteCarteraService,
    ClienteCarteraSyncService,
    ClienteCarteraAnalyticsService,
  ],
  exports: [ClienteCarteraService, ClienteCarteraSyncService],
})
export class ClienteCarteraModule {}
