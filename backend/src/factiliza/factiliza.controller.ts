import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { FactilizaService } from './factiliza.service';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';

@Controller('factiliza')
@UseGuards(PermissionsGuard)
export class FactilizaController {
  constructor(private readonly factilizaService: FactilizaService) {}

  @Get('dni/:dni')
  @RequirePermissions('contactos.ver')
  consultarDni(@Param('dni') dni: string) {
    return this.factilizaService.consultarDni(dni);
  }

  @Get('cee/:cee')
  @RequirePermissions('contactos.ver')
  consultarCee(@Param('cee') cee: string) {
    return this.factilizaService.consultarCee(cee);
  }

  @Get('ruc/:ruc')
  @RequirePermissions('empresas.ver')
  consultarRuc(@Param('ruc') ruc: string) {
    return this.factilizaService.consultarRuc(ruc);
  }
}
