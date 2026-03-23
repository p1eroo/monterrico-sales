import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Req,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { RolesService } from './roles.service';

type RequestUser = {
  userId: string;
  username: string;
  name: string;
  role: string;
};

@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

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
  async create(
    @Body() dto: { name: string; slug?: string; description?: string; permissions?: string[] },
    @Req() req: { user: RequestUser },
  ) {
    if (req.user.role !== 'admin') {
      throw new ForbiddenException('Solo administradores pueden crear roles');
    }
    return this.rolesService.create(dto);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: { name?: string; description?: string; permissions?: string[] },
    @Req() req: { user: RequestUser },
  ) {
    if (req.user.role !== 'admin') {
      throw new ForbiddenException('Solo administradores pueden modificar roles');
    }
    return this.rolesService.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: { user: RequestUser }) {
    if (req.user.role !== 'admin') {
      throw new ForbiddenException('Solo administradores pueden eliminar roles');
    }
    return this.rolesService.remove(id);
  }
}
