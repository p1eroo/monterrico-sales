import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ClientsService } from './clients.service';
import { UpdateClientDto } from './dto/update-client.dto';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CrmDataScopeService } from '../auth/crm-data-scope.service';

type AuthedReq = { user: { userId: string; roleId?: string } };

@Controller('clients')
@UseGuards(PermissionsGuard)
export class ClientsController {
  constructor(
    private readonly clientsService: ClientsService,
    private readonly crmDataScope: CrmDataScopeService,
  ) {}

  @Get()
  @RequirePermissions('clientes.ver')
  async findAll(@Req() req: AuthedReq) {
    const scope = await this.crmDataScope.buildScope(
      req.user.userId,
      req.user.roleId,
    );
    return this.clientsService.findAll(scope);
  }

  @Patch(':id')
  @RequirePermissions('clientes.editar')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateClientDto,
    @Req() req: AuthedReq,
  ) {
    return this.crmDataScope
      .buildScope(req.user.userId, req.user.roleId)
      .then((scope) => this.clientsService.update(id, dto, scope));
  }
}
