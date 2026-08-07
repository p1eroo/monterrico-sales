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

  /** KPIs rápidos (sin charts) para carga priorizada. */
  @Get('kpis')
  @RequireAnyPermission('dashboard.ver', 'reportes.ver')
  async getKPIs(
    @Req() req: AuthedReq,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('advisorId') advisorId?: string,
    @Query('assignedTo') assignedTo?: string,
    @Query('excludeAssignedTo') excludeAssignedTo?: string,
    @Query('advisorPool') advisorPool?: string,
    @Query('source') source?: string,
    @Query('area') area?: string,
  ) {
    const crmScope = await this.crmDataScope.buildScope(
      req.user.userId,
      req.user.roleId,
    );
    return this.analytics.getKPIs({
      from,
      to,
      advisorId,
      assignedTo,
      excludeAssignedTo,
      advisorPool,
      source,
      area,
      crmScope,
    });
  }

  /** Dashboard + Reportes: KPIs y series en el rango indicado (YYYY-MM-DD). */
  @Get('summary')
  @RequireAnyPermission('dashboard.ver', 'reportes.ver')
  async getSummary(
    @Req() req: AuthedReq,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('advisorId') advisorId?: string,
    @Query('assignedTo') assignedTo?: string,
    @Query('excludeAssignedTo') excludeAssignedTo?: string,
    @Query('advisorPool') advisorPool?: string,
    @Query('source') source?: string,
    @Query('area') area?: string,
    @Query('sparklineWeeks') sparklineWeeks?: string,
    @Query('chartGranularity') chartGranularity?: string,
  ) {
    const crmScope = await this.crmDataScope.buildScope(
      req.user.userId,
      req.user.roleId,
    );
    return this.analytics.getSummary({
      from,
      to,
      advisorId,
      assignedTo,
      excludeAssignedTo,
      advisorPool,
      source,
      area,
      crmScope,
      sparklineWeeks: sparklineWeeks ? Number(sparklineWeeks) : undefined,
      chartGranularity:
        chartGranularity === 'day' || chartGranularity === 'week'
          ? chartGranularity
          : undefined,
    });
  }

  /** Progreso de metas (ventas ganadas en semana/mes calendario). */
  @Get('goal-progress')
  @RequireAnyPermission('dashboard.ver', 'reportes.ver')
  async getGoalProgress(
    @Req() req: AuthedReq,
    @Query('advisorId') advisorId?: string,
    @Query('area') area?: string,
  ) {
    const crmScope = await this.crmDataScope.buildScope(
      req.user.userId,
      req.user.roleId,
    );
    return this.analytics.getGoalProgress(
      req.user.userId,
      advisorId,
      crmScope,
      area,
    );
  }

  /** Empresas de un bucket del movimiento por asesor (paginado). */
  @Get('advisor-funnel-movement/companies')
  @RequireAnyPermission('dashboard.ver', 'reportes.ver')
  async getAdvisorFunnelMovementCompanies(
    @Req() req: AuthedReq,
    @Query('to') to?: string,
    @Query('advisorId') advisorId?: string,
    @Query('metric') metric?: string,
    @Query('toWeekNumber') toWeekNumber?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('assignedTo') assignedTo?: string,
    @Query('excludeAssignedTo') excludeAssignedTo?: string,
    @Query('advisorPool') advisorPool?: string,
    @Query('source') source?: string,
  ) {
    const crmScope = await this.crmDataScope.buildScope(
      req.user.userId,
      req.user.roleId,
    );
    return this.analytics.getAdvisorFunnelMovementCompanies({
      to,
      advisorId: advisorId ?? '',
      metric: metric as
        | 'nuevoIngreso'
        | 'avance'
        | 'atraso'
        | 'sinCambios',
      toWeekNumber: Number(toWeekNumber),
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      assignedTo,
      excludeAssignedTo,
      advisorPool,
      source,
      crmScope,
    });
  }

  /** Detalle de actividades completadas por asesor y semana. */
  @Get('activities-by-advisor/details')
  @RequireAnyPermission('dashboard.ver', 'reportes.ver')
  async getActivitiesByAdvisorDetails(
    @Req() req: AuthedReq,
    @Query('advisorId') advisorId?: string,
    @Query('weekStart') weekStart?: string,
    @Query('weekEnd') weekEnd?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('assignedTo') assignedTo?: string,
    @Query('excludeAssignedTo') excludeAssignedTo?: string,
    @Query('advisorPool') advisorPool?: string,
    @Query('source') source?: string,
    @Query('activityType') activityType?: string,
    @Query('callOutcome') callOutcome?: string,
  ) {
    const crmScope = await this.crmDataScope.buildScope(
      req.user.userId,
      req.user.roleId,
    );
    return this.analytics.getActivitiesByAdvisorDetails({
      advisorId: advisorId ?? '',
      weekStart: weekStart ?? '',
      weekEnd: weekEnd ?? '',
      from,
      to,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      assignedTo,
      excludeAssignedTo,
      advisorPool,
      source,
      activityType,
      callOutcome,
      crmScope,
    });
  }

  /** Detalle de tareas completadas por asesor y semana. */
  @Get('tasks-by-advisor/details')
  @RequireAnyPermission('dashboard.ver', 'reportes.ver')
  async getTasksByAdvisorDetails(
    @Req() req: AuthedReq,
    @Query('advisorId') advisorId?: string,
    @Query('weekStart') weekStart?: string,
    @Query('weekEnd') weekEnd?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('assignedTo') assignedTo?: string,
    @Query('excludeAssignedTo') excludeAssignedTo?: string,
    @Query('advisorPool') advisorPool?: string,
    @Query('source') source?: string,
    @Query('activityType') activityType?: string,
    @Query('callOutcome') callOutcome?: string,
  ) {
    const crmScope = await this.crmDataScope.buildScope(
      req.user.userId,
      req.user.roleId,
    );
    return this.analytics.getTasksByAdvisorDetails({
      advisorId: advisorId ?? '',
      weekStart: weekStart ?? '',
      weekEnd: weekEnd ?? '',
      from,
      to,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      assignedTo,
      excludeAssignedTo,
      advisorPool,
      source,
      activityType,
      callOutcome,
      crmScope,
    });
  }
}
