import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { FlotaProspectosGateway } from './flota-prospectos.gateway';

@Global()
@Module({
  imports: [PrismaModule, AuthModule],
  providers: [FlotaProspectosGateway],
  exports: [FlotaProspectosGateway],
})
export class FlotaProspectosRealtimeModule {}
