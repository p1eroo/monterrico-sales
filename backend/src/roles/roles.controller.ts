import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { RolesService } from './roles.service';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';

@Controller('roles')
@UseGuards(PermissionsGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  /** Listado y detalle: cualquier usuario autenticado (selectores de rol en formularios). */
  @Get()
  findAll() {
    return this.rolesService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const role = await this.rolesService.findOne(id);
    if (!role) {
      throw new NotFoundException('Rol no encontrado');
    }
    return role;
  }

  @Post()
  @RequirePermissions('roles.crear')
  async create(
    @Body() dto: { name: string; slug?: string; description?: string; permissions?: string[] },
  ) {
    return this.rolesService.create(dto);
  }

  @Patch(':id')
  @RequirePermissions('roles.editar')
  async update(
    @Param('id') id: string,
    @Body() dto: { name?: string; description?: string; permissions?: string[] },
  ) {
    return this.rolesService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('roles.eliminar')
  async remove(@Param('id') id: string) {
    return this.rolesService.remove(id);
  }
}
