import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ActivityLogsService } from './activity-logs.service';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';

@Controller('activity-logs')
@UseGuards(PermissionsGuard)
export class ActivityLogsController {
  constructor(private readonly activityLogsService: ActivityLogsService) {}

  @Get()
  @RequirePermissions('auditoria.ver')
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('userId') userId?: string,
    @Query('module') module?: string,
    @Query('action') action?: string,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
  ) {
    const pageNum = page ? Number.parseInt(page, 10) || 1 : 1;
    const limitNum = limit ? Number.parseInt(limit, 10) || 25 : 25;
    return this.activityLogsService.findPage({
      page: pageNum,
      limit: Math.min(100, Math.max(1, limitNum)),
      search: search?.trim() || undefined,
      userId: userId?.trim() || undefined,
      module: module?.trim() || undefined,
      action: action?.trim() || undefined,
      entityType: entityType?.trim() || undefined,
      entityId: entityId?.trim() || undefined,
    });
  }
}
