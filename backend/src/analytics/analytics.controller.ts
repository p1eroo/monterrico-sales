import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequireAnyPermission } from '../auth/decorators/require-any-permission.decorator';
import { CrmDataScopeService } from '../auth/crm-data-scope.service';

type AuthedReq = { user: { userId: string; roleId?: string } };

@Controller('analytics')
@UseGuards(PermissionsGuard)
export class AnalyticsController {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly crmDataScope: CrmDataScopeService,
  ) {}

  /** Dashboard + Reportes: KPIs y series en el rango indicado (YYYY-MM-DD). */
  @Get('summary')
  @RequireAnyPermission('dashboard.ver', 'reportes.ver')
  async getSummary(
    @Req() req: AuthedReq,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('advisorId') advisorId?: string,
    @Query('source') source?: string,
  ) {
    const crmScope = await this.crmDataScope.buildScope(
      req.user.userId,
      req.user.roleId,
    );
    return this.analytics.getSummary({
      from,
      to,
      advisorId,
      source,
      crmScope,
    });
  }

  /** Progreso de metas (ventas ganadas en semana/mes calendario). */
  @Get('goal-progress')
  @RequireAnyPermission('dashboard.ver', 'reportes.ver')
  async getGoalProgress(
    @Req() req: AuthedReq,
    @Query('advisorId') advisorId?: string,
  ) {
    const crmScope = await this.crmDataScope.buildScope(
      req.user.userId,
      req.user.roleId,
    );
    return this.analytics.getGoalProgress(
      req.user.userId,
      advisorId,
      crmScope,
    );
  }
}
