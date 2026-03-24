import { Module } from '@nestjs/common';
import { FactilizaController } from './factiliza.controller';
import { FactilizaService } from './factiliza.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [FactilizaController],
  providers: [FactilizaService],
  exports: [FactilizaService],
})
export class FactilizaModule {}
