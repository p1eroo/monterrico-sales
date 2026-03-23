import { Module } from '@nestjs/common';
import { FactilizaController } from './factiliza.controller';
import { FactilizaService } from './factiliza.service';

@Module({
  controllers: [FactilizaController],
  providers: [FactilizaService],
  exports: [FactilizaService],
})
export class FactilizaModule {}
