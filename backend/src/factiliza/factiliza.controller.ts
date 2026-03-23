import { Controller, Get, Param } from '@nestjs/common';
import { FactilizaService } from './factiliza.service';

@Controller('factiliza')
export class FactilizaController {
  constructor(private readonly factilizaService: FactilizaService) {}

  @Get('dni/:dni')
  consultarDni(@Param('dni') dni: string) {
    return this.factilizaService.consultarDni(dni);
  }

  @Get('cee/:cee')
  consultarCee(@Param('cee') cee: string) {
    return this.factilizaService.consultarCee(cee);
  }

  @Get('ruc/:ruc')
  consultarRuc(@Param('ruc') ruc: string) {
    return this.factilizaService.consultarRuc(ruc);
  }
}
