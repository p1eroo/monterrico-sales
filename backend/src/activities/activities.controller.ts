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
} from '@nestjs/common';
import { ActivitiesService } from './activities.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { UpdateActivityDto } from './dto/update-activity.dto';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';

@Controller('activities')
@UseGuards(PermissionsGuard)
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Post()
  @RequirePermissions('actividades.crear')
  create(@Body() createActivityDto: CreateActivityDto) {
    return this.activitiesService.create(createActivityDto);
  }

  @Get()
  @RequirePermissions('actividades.ver')
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('assignedTo') assignedTo?: string,
  ) {
    const pageNum = page ? (Number.parseInt(page, 10) || 1) : 1;
    const limitNum = limit
      ? Math.min(5000, Math.max(1, Number.parseInt(limit, 10) || 25))
      : 25;
    return this.activitiesService.findAll({
      page: pageNum,
      limit: limitNum,
      type: type?.trim() || undefined,
      status: status?.trim() || undefined,
      assignedTo: assignedTo?.trim() || undefined,
    });
  }

  @Get(':id')
  @RequirePermissions('actividades.ver')
  findOne(@Param('id') id: string) {
    return this.activitiesService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('actividades.editar')
  update(@Param('id') id: string, @Body() updateActivityDto: UpdateActivityDto) {
    return this.activitiesService.update(id, updateActivityDto);
  }

  @Delete(':id')
  @RequirePermissions('actividades.eliminar')
  remove(@Param('id') id: string) {
    return this.activitiesService.remove(id);
  }
}
