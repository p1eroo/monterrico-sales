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
import { CompaniesService } from './companies.service';
import { CompanyStaleEtapaService } from './company-stale-etapa.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { CrmDataScopeService } from '../auth/crm-data-scope.service';

type AuthedReq = {
  user: { userId: string; name: string; roleId?: string };
};

@Controller('companies')
@UseGuards(PermissionsGuard)
export class CompaniesController {
  constructor(
    private readonly companiesService: CompaniesService,
    private readonly companyStaleEtapaService: CompanyStaleEtapaService,
    private readonly crmDataScope: CrmDataScopeService,
  ) {}

  @Post()
  @RequirePermissions('empresas.crear')
  async create(
    @Body() createCompanyDto: CreateCompanyDto,
    @Req() req: AuthedReq,
  ) {
    const scope = await this.crmDataScope.buildScope(
      req.user.userId,
      req.user.roleId,
    );
    return this.companiesService.create(
      createCompanyDto,
      {
        userId: req.user.userId,
        userName: req.user.name,
      },
      scope,
    );
  }

  @Get()
  @RequirePermissions('empresas.ver')
  async findAll(
    @Req() req: AuthedReq,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('rubro') rubro?: string,
    @Query('tipo') tipo?: string,
  ) {
    const scope = await this.crmDataScope.buildScope(
      req.user.userId,
      req.user.roleId,
    );
    const pageNum = page ? (Number.parseInt(page, 10) || 1) : 1;
    const limitNum = limit
      ? Math.min(5000, Math.max(1, Number.parseInt(limit, 10) || 25))
      : 25;
    return this.companiesService.findAll(
      {
        page: pageNum,
        limit: limitNum,
        search: search?.trim() || undefined,
        rubro: rubro?.trim() || undefined,
        tipo: tipo?.trim() || undefined,
      },
      scope,
    );
  }

  /** Conteos por etapa para pestañas del listado (sin `etapa` en query). */
  @Get('summary/etapa-counts')
  @RequirePermissions('empresas.ver')
  async summaryEtapaCounts(
    @Req() req: AuthedReq,
    @Query('search') search?: string,
    @Query('rubro') rubro?: string,
    @Query('tipo') tipo?: string,
    @Query('fuente') fuente?: string,
    @Query('assignedTo') assignedTo?: string,
    @Query('lastInteraction') lastInteraction?: string,
    @Query('lastInteractionFrom') lastInteractionFrom?: string,
    @Query('lastInteractionTo') lastInteractionTo?: string,
  ) {
    const scope = await this.crmDataScope.buildScope(
      req.user.userId,
      req.user.roleId,
    );
    return this.companiesService.summaryEtapaCounts(
      {
        search: search?.trim() || undefined,
        rubro: rubro?.trim() || undefined,
        tipo: tipo?.trim() || undefined,
        fuente: fuente?.trim() || undefined,
        assignedTo: assignedTo?.trim() || undefined,
        lastInteraction: lastInteraction?.trim() || undefined,
        lastInteractionFrom: lastInteractionFrom?.trim() || undefined,
        lastInteractionTo: lastInteractionTo?.trim() || undefined,
      },
      scope,
    );
  }

  /** Debe ir antes de @Get(':id'). */
  @Get('by-ruc/:ruc')
  @RequirePermissions('empresas.ver')
  findOneByRuc(@Param('ruc') ruc: string, @Req() req: AuthedReq) {
    return this.crmDataScope
      .buildScope(req.user.userId, req.user.roleId)
      .then((scope) => this.companiesService.findOneByRucParam(ruc, scope));
  }

  /** Debe ir antes de @Get(':id') para no capturar "summary" como id. */
  @Get('summary')
  @RequirePermissions('empresas.ver')
  async findAllSummary(
    @Req() req: AuthedReq,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('rubro') rubro?: string,
    @Query('tipo') tipo?: string,
    @Query('etapa') etapa?: string,
    @Query('fuente') fuente?: string,
    @Query('assignedTo') assignedTo?: string,
    @Query('lastInteraction') lastInteraction?: string,
    @Query('lastInteractionFrom') lastInteractionFrom?: string,
    @Query('lastInteractionTo') lastInteractionTo?: string,
  ) {
    const scope = await this.crmDataScope.buildScope(
      req.user.userId,
      req.user.roleId,
    );
    const pageNum = page ? (Number.parseInt(page, 10) || 1) : 1;
    const limitNum = limit
      ? Math.min(5000, Math.max(1, Number.parseInt(limit, 10) || 25))
      : 25;
    return this.companiesService.findAllSummary(
      {
        page: pageNum,
        limit: limitNum,
        search: search?.trim() || undefined,
        rubro: rubro?.trim() || undefined,
        tipo: tipo?.trim() || undefined,
        etapa: etapa?.trim() || undefined,
        fuente: fuente?.trim() || undefined,
        assignedTo: assignedTo?.trim() || undefined,
        lastInteraction: lastInteraction?.trim() || undefined,
        lastInteractionFrom: lastInteractionFrom?.trim() || undefined,
        lastInteractionTo: lastInteractionTo?.trim() || undefined,
      },
      scope,
    );
  }

  /**
   * Empresas en etapas 0/10/30 % (sin `inactivo` ni `cierre_perdido`) sin cambio de
   * etapa en ≥11 semanas (notificaciones). Debe declararse antes de @Get(':id').
   */
  @Get('alerts/sin-cambio-etapa')
  @RequirePermissions('empresas.ver')
  async sinCambioEtapaAlert(@Req() req: AuthedReq) {
    const scope = await this.crmDataScope.buildScope(
      req.user.userId,
      req.user.roleId,
    );
    return this.companyStaleEtapaService.listSinCambioEtapaAlert(scope);
  }

  @Get(':id')
  @RequirePermissions('empresas.ver')
  findOne(@Param('id') id: string, @Req() req: AuthedReq) {
    return this.crmDataScope
      .buildScope(req.user.userId, req.user.roleId)
      .then((scope) => this.companiesService.findOne(id, scope));
  }

  @Patch(':id')
  @RequirePermissions('empresas.editar')
  update(
    @Param('id') id: string,
    @Body() updateCompanyDto: UpdateCompanyDto,
    @Req() req: AuthedReq,
  ) {
    return this.crmDataScope
      .buildScope(req.user.userId, req.user.roleId)
      .then((scope) =>
        this.companiesService.update(id, updateCompanyDto, {
          userId: req.user.userId,
          userName: req.user.name,
        }, scope),
      );
  }

  @Delete(':id')
  @RequirePermissions('empresas.eliminar')
  remove(@Param('id') id: string, @Req() req: AuthedReq) {
    return this.crmDataScope
      .buildScope(req.user.userId, req.user.roleId)
      .then((scope) =>
        this.companiesService.remove(id, {
          userId: req.user.userId,
          userName: req.user.name,
        }, scope),
      );
  }
}
