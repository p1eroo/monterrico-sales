import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequireAnyPermission } from '../auth/decorators/require-any-permission.decorator';

type AuthedReq = { user: { userId: string } };

@Controller('analytics')
@UseGuards(PermissionsGuard)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  /** Dashboard + Reportes: KPIs y series en el rango indicado (YYYY-MM-DD). */
  @Get('summary')
  @RequireAnyPermission('dashboard.ver', 'reportes.ver')
  getSummary(
    @Req() req: AuthedReq,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('advisorId') advisorId?: string,
    @Query('source') source?: string,
  ) {
    void req.user.userId;
    return this.analytics.getSummary({ from, to, advisorId, source });
  }

  /** Progreso de metas (ventas ganadas en semana/mes calendario). */
  @Get('goal-progress')
  @RequireAnyPermission('dashboard.ver', 'reportes.ver')
  getGoalProgress(
    @Req() req: AuthedReq,
    @Query('advisorId') advisorId?: string,
  ) {
    return this.analytics.getGoalProgress(req.user.userId, advisorId);
  }
}
