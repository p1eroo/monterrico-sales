import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { OpportunitiesService } from './opportunities.service';
import { CreateOpportunityDto } from './dto/create-opportunity.dto';
import { UpdateOpportunityDto } from './dto/update-opportunity.dto';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { RequireAnyPermission } from '../auth/decorators/require-any-permission.decorator';
import { CrmDataScopeService } from '../auth/crm-data-scope.service';

type AuthedReq = {
  user: { userId: string; name: string; roleId?: string };
};

@Controller('opportunities')
@UseGuards(PermissionsGuard)
export class OpportunitiesController {
  constructor(
    private readonly opportunitiesService: OpportunitiesService,
    private readonly crmDataScope: CrmDataScopeService,
  ) {}

  @Post()
  @RequirePermissions('oportunidades.crear')
  async create(
    @Body() createOpportunityDto: CreateOpportunityDto,
    @Req() req: AuthedReq,
  ) {
    const scope = await this.crmDataScope.buildScope(
      req.user.userId,
      req.user.roleId,
    );
    return this.opportunitiesService.create(
      createOpportunityDto,
      {
        userId: req.user.userId,
        userName: req.user.name,
      },
      scope,
    );
  }

  @Get()
  @RequirePermissions('oportunidades.ver')
  async findAll(
    @Req() req: AuthedReq,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('etapa') etapa?: string,
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
    return this.opportunitiesService.findAll(
      {
        page: pageNum,
        limit: limitNum,
        search: search?.trim() || undefined,
        etapa: etapa?.trim() || undefined,
        status: status?.trim() || undefined,
        assignedTo: assignedTo?.trim() || undefined,
      },
      scope,
    );
  }

  @Get(':id')
  @RequirePermissions('oportunidades.ver')
  findOne(@Param('id') id: string, @Req() req: AuthedReq) {
    return this.crmDataScope
      .buildScope(req.user.userId, req.user.roleId)
      .then((scope) => this.opportunitiesService.findOne(id, scope));
  }

  @Patch(':id')
  @RequirePermissions('oportunidades.editar')
  update(
    @Param('id') id: string,
    @Body() updateOpportunityDto: UpdateOpportunityDto,
    @Req() req: AuthedReq,
  ) {
    return this.crmDataScope
      .buildScope(req.user.userId, req.user.roleId)
      .then((scope) =>
        this.opportunitiesService.update(id, updateOpportunityDto, {
          userId: req.user.userId,
          userName: req.user.name,
        }, scope),
      );
  }

  @Delete(':id/companies/:companyId')
  @RequireAnyPermission('oportunidades.editar', 'empresas.editar')
  unlinkCompany(
    @Param('id') id: string,
    @Param('companyId') companyId: string,
    @Req() req: AuthedReq,
  ) {
    return this.crmDataScope
      .buildScope(req.user.userId, req.user.roleId)
      .then((scope) =>
        this.opportunitiesService.unlinkCompanyFromOpportunity(
          id,
          companyId,
          { userId: req.user.userId, userName: req.user.name },
          scope,
        ),
      );
  }

  @Delete(':id')
  @RequirePermissions('oportunidades.eliminar')
  remove(@Param('id') id: string, @Req() req: AuthedReq) {
    return this.crmDataScope
      .buildScope(req.user.userId, req.user.roleId)
      .then((scope) =>
        this.opportunitiesService.remove(id, {
          userId: req.user.userId,
          userName: req.user.name,
        }, scope),
      );
  }
}
