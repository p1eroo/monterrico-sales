import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ActivitiesService } from './activities.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CrmDataScopeService } from '../auth/crm-data-scope.service';

type AuthedReq = { user: { userId: string; roleId?: string } };

@Controller('activities')
@UseGuards(PermissionsGuard)
export class ActivitiesController {
  constructor(
    private readonly activitiesService: ActivitiesService,
    private readonly crmDataScope: CrmDataScopeService,
  ) {}

  @Post()
  @RequirePermissions('actividades.crear')
  async create(
    @Body() createActivityDto: CreateActivityDto,
    @Req() req: AuthedReq,
  ) {
    const scope = await this.crmDataScope.buildScope(
      req.user.userId,
      req.user.roleId,
    );
    return this.activitiesService.create(createActivityDto, scope);
  }

  @Get()
  @RequirePermissions('actividades.ver')
  async findAll(
    @Req() req: AuthedReq,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('assignedTo') assignedTo?: string,
  ) {
    const scope = await this.crmDataScope.buildScope(
      req.user.userId,
      req.user.roleId,
    );
    const pageNum = page ? (Number.parseInt(page, 10) || 1) : 1;
    const limitNum = limit
      ? Math.min(5000, Math.max(1, Number.parseInt(limit, 10) || 25))
      : 25;
    return this.activitiesService.findAll(
      {
        page: pageNum,
        limit: limitNum,
        type: type?.trim() || undefined,
        status: status?.trim() || undefined,
        assignedTo: assignedTo?.trim() || undefined,
      },
      scope,
    );
  }

  @Get(':id')
  @RequirePermissions('actividades.ver')
  findOne(@Param('id') id: string, @Req() req: AuthedReq) {
    return this.crmDataScope
      .buildScope(req.user.userId, req.user.roleId)
      .then((scope) => this.activitiesService.findOne(id, scope));
  }

  @Patch(':id')
  @RequirePermissions('actividades.editar')
  update(
    @Param('id') id: string,
    @Body() updateActivityDto: UpdateActivityDto,
    @Req() req: AuthedReq,
  ) {
    return this.crmDataScope
      .buildScope(req.user.userId, req.user.roleId)
      .then((scope) =>
        this.activitiesService.update(id, updateActivityDto, scope),
      );
  }

  @Delete(':id')
  @RequirePermissions('actividades.eliminar')
  remove(@Param('id') id: string, @Req() req: AuthedReq) {
    return this.crmDataScope
      .buildScope(req.user.userId, req.user.roleId)
      .then((scope) => this.activitiesService.remove(id, scope));
  }
}
