import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CrmDataScopeService } from '../auth/crm-data-scope.service';
import { ClienteCarteraService } from './cliente-cartera.service';
import { ClienteCarteraSyncService } from './cliente-cartera-sync.service';
import { CreateContactoClienteDto } from './dto/create-contacto-cliente.dto';
import { UpdateContactoClienteDto } from './dto/update-contacto-cliente.dto';
import { LinkContactoClienteDto } from './dto/link-contacto-cliente.dto';

type AuthedReq = {
  user: { userId: string; username: string; roleId?: string };
};

@Controller('cliente-cartera')
@UseGuards(PermissionsGuard)
export class ClienteCarteraController {
  constructor(
    private readonly carteraService: ClienteCarteraService,
    private readonly syncService: ClienteCarteraSyncService,
    private readonly crmDataScope: CrmDataScopeService,
  ) {}

  @Get('empresas')
  @RequirePermissions('clientes.ver')
  async findEmpresas(@Req() req: AuthedReq) {
    const scope = await this.crmDataScope.buildScope(
      req.user.userId,
      req.user.roleId,
    );
    return this.carteraService.findEmpresas(scope, req.user.username);
  }

  @Get('empresas/:id')
  @RequirePermissions('clientes.ver')
  async findEmpresaById(@Param('id') id: string, @Req() req: AuthedReq) {
    const scope = await this.crmDataScope.buildScope(
      req.user.userId,
      req.user.roleId,
    );
    return this.carteraService.findEmpresaById(id, scope, req.user.username);
  }

  @Get('contactos')
  @RequirePermissions('clientes.ver')
  async findContactos(@Req() req: AuthedReq) {
    const scope = await this.crmDataScope.buildScope(
      req.user.userId,
      req.user.roleId,
    );
    return this.carteraService.findContactos(scope);
  }

  @Get('contactos/:id')
  @RequirePermissions('clientes.ver')
  async findContactoById(@Param('id') id: string, @Req() req: AuthedReq) {
    const scope = await this.crmDataScope.buildScope(
      req.user.userId,
      req.user.roleId,
    );
    return this.carteraService.findContactoById(id, scope);
  }

  @Post('contactos')
  @RequirePermissions('clientes.editar')
  async createContacto(
    @Body() dto: CreateContactoClienteDto,
    @Req() req: AuthedReq,
  ) {
    const scope = await this.crmDataScope.buildScope(
      req.user.userId,
      req.user.roleId,
    );
    return this.carteraService.createContacto(
      dto,
      scope,
      req.user.userId,
      req.user.username,
    );
  }

  @Patch('contactos/:id')
  @RequirePermissions('clientes.editar')
  async updateContacto(
    @Param('id') id: string,
    @Body() dto: UpdateContactoClienteDto,
    @Req() req: AuthedReq,
  ) {
    const scope = await this.crmDataScope.buildScope(
      req.user.userId,
      req.user.roleId,
    );
    return this.carteraService.updateContacto(
      id,
      dto,
      scope,
      req.user.userId,
    );
  }

  @Delete('contactos/:id')
  @RequirePermissions('clientes.editar')
  async deleteContacto(@Param('id') id: string, @Req() req: AuthedReq) {
    const scope = await this.crmDataScope.buildScope(
      req.user.userId,
      req.user.roleId,
    );
    return this.carteraService.deleteContacto(id, scope);
  }

  @Post('empresas/:id/contactos')
  @RequirePermissions('clientes.editar')
  async linkContacto(
    @Param('id') empresaId: string,
    @Body() dto: LinkContactoClienteDto,
    @Req() req: AuthedReq,
  ) {
    const scope = await this.crmDataScope.buildScope(
      req.user.userId,
      req.user.roleId,
    );
    return this.carteraService.linkContactoToEmpresa(
      empresaId,
      dto.contactoClienteId,
      scope,
      req.user.username,
      dto.isPrimary ?? false,
    );
  }

  @Delete('empresas/:empresaId/contactos/:contactoId')
  @RequirePermissions('clientes.editar')
  async unlinkContacto(
    @Param('empresaId') empresaId: string,
    @Param('contactoId') contactoId: string,
    @Req() req: AuthedReq,
  ) {
    const scope = await this.crmDataScope.buildScope(
      req.user.userId,
      req.user.roleId,
    );
    return this.carteraService.unlinkContactoFromEmpresa(
      empresaId,
      contactoId,
      scope,
      req.user.username,
    );
  }

  /**
   * Lista desde Taxi Monterrico (como Clients.tsx), guarda en BD y devuelve el listado.
   * Por defecto solo el agente del usuario logueado.
   */
  @Post('empresas/refresh')
  @RequirePermissions('clientes.ver')
  async refreshEmpresas(
    @Req() req: AuthedReq,
    @Query('all') all?: string,
  ) {
    const scope = await this.crmDataScope.buildScope(
      req.user.userId,
      req.user.roleId,
    );
    const username = req.user.username.trim().toLowerCase();
    let syncResult: { empresas: number };

    if (all === 'true' && scope.unrestricted) {
      const agentes = await this.syncService.resolveAgentesForSync(
        username,
        true,
      );
      syncResult = await this.syncService.syncForAgentes(agentes);
    } else {
      syncResult = await this.syncService.syncForCurrentUser(username);
    }

    const data = await this.carteraService.findEmpresas(scope, username);
    return {
      ok: true,
      empresas: syncResult.empresas,
      data,
    };
  }

  /** Alias de refresh para el botón Sincronizar. */
  @Post('sync')
  @RequirePermissions('clientes.ver')
  async sync(
    @Req() req: AuthedReq,
    @Query('all') all?: string,
  ) {
    return this.refreshEmpresas(req, all);
  }
}
