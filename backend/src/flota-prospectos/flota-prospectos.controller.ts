import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  HttpException,
  HttpStatus,
  Req,
  UseGuards,
} from '@nestjs/common';
import { FlotaProspectosService } from './flota-prospectos.service';
import { Public } from '../auth/decorators/public.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { ImportExportJobsService } from '../import-export/import-export-jobs.service';
import type { CrmDataScope } from '../auth/crm-data-scope.service';

type AuthedReq = { user: { userId: string; name: string; roleId?: string } };

@Controller()
@UseGuards(PermissionsGuard)
export class FlotaProspectosController {
  constructor(
    private readonly service: FlotaProspectosService,
    private readonly prisma: PrismaService,
    private readonly importExportJobs: ImportExportJobsService,
  ) {}

  private async buildFlotaScope(userId: string, roleId?: string): Promise<CrmDataScope> {
    const perm = roleId ? await this.prisma.authority.findFirst({
      where: { roleId, permission: 'flota_prospectos.ver_todos' },
      select: { id: true },
    }) : null;
    return { viewerUserId: userId, unrestricted: !!perm };
  }

  /** GET /flota-prospectos — Listado paginado con filtros */
  @Get('flota-prospectos')
  @RequirePermissions('flota_prospectos.ver')
  async findAll(
    @Req() req: AuthedReq,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('estado') estado?: string,
    @Query('duplicados') duplicados?: string,
    @Query('mes') mes?: string,
    @Query('redSocial') redSocial?: string,
    @Query('operador') operador?: string,
  ) {
    const scope = await this.buildFlotaScope(
      req.user.userId,
      req.user.roleId,
    );
    return this.service.findAll({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 25,
      search: search || undefined,
      estado: estado || undefined,
      duplicados: duplicados === 'true',
      mes: mes || undefined,
      redSocial: redSocial || undefined,
      operador: operador || undefined,
    }, scope);
  }

  /** GET /flota-prospectos/operadores — Lista de operadores activos para dropdowns */
  @Get('flota-prospectos/operadores')
  @RequirePermissions('flota_prospectos.ver')
  async findOperadores() {
    const rows = await this.prisma.user.findMany({
      where: {
        status: 'activo',
        role: { slug: 'operador' },
      },
      include: {
        accounts: {
          select: { provider: true, providerId: true },
        },
      },
    });
    return rows.map((r) => {
      const cred = r.accounts.find((a) => a.provider === 'credentials');
      return {
        id: r.id,
        name: r.name,
        username: cred?.providerId ?? '',
      };
    });
  }

  /** GET /flota-prospectos/counts — Conteo por estado + duplicados */
  @Get('flota-prospectos/counts')
  @RequirePermissions('flota_prospectos.ver')
  async getCounts(@Req() req: AuthedReq) {
    const scope = await this.buildFlotaScope(
      req.user.userId,
      req.user.roleId,
    );
    return this.service.getCounts(scope);
  }

  /** GET /flota-prospectos/operador-stats — Estadísticas por operador en un rango */
  @Get('flota-prospectos/operador-stats')
  @RequirePermissions('flota_prospectos.ver')
  async getOperadorStats(
    @Query('fecini') fecini: string,
    @Query('fecfin') fecfin: string,
    @Req() req: AuthedReq,
  ) {
    const scope = await this.buildFlotaScope(
      req.user.userId,
      req.user.roleId,
    );
    return this.service.getOperadorStats(fecini, fecfin, scope);
  }

  /** GET /flota-prospectos/masivo-list — Lista ligera de prospectos para el envío masivo */
  @Get('flota-prospectos/masivo-list')
  @RequirePermissions('flota_prospectos.ver')
  async listForMasivo(@Req() req: AuthedReq, @Query('search') search?: string) {
    const scope = await this.buildFlotaScope(
      req.user.userId,
      req.user.roleId,
    );
    return this.service.listForMasivo(search, scope);
  }

  /** GET /flota/sheets — Hojas disponibles del spreadsheet */
  @Public()
  @Get('flota/sheets')
  async getSheetNames() {
    try {
      const names = await this.service.getSheetNames();
      return { sheets: names };
    } catch (err) {
      throw new HttpException(
        `Error al obtener hojas: ${err instanceof Error ? err.message : String(err)}`,
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  /** GET /flota/preview/:sheetName — Vista previa de una hoja */
  @Public()
  @Get('flota/preview/:sheetName')
  async getPreview(@Param('sheetName') sheetName: string) {
    try {
      return await this.service.getPreview(sheetName);
    } catch (err) {
      throw new HttpException(
        err instanceof Error ? err.message : 'Error en vista previa',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  /** POST /flota/import/:sheetName — Importar desde Google Sheets con progreso */
  @Post('flota/import/:sheetName')
  @RequirePermissions('flota_prospectos.crear')
  async importFromSheets(
    @Param('sheetName') sheetName: string,
    @Req() req: AuthedReq,
  ) {
    try {
      const preview = await this.service.getPreview(sheetName);
      const totalRows = preview.totalRows;

      return this.importExportJobs.startJob(
        {
          entity: 'flota-prospecto',
          ownerUserId: req.user.userId,
          totalRows,
        },
        (update) => this.service.importFromSheetsWithProgress(sheetName, update),
      );
    } catch (err) {
      throw new HttpException(
        err instanceof Error ? err.message : 'Error al importar',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  /** GET /flota-prospectos/:id — Detalle de un prospecto */
  @Get('flota-prospectos/:id')
  @RequirePermissions('flota_prospectos.ver')
  async findOne(@Param('id') id: string) {
    const prospecto = await this.service.findOne(id);
    if (!prospecto) {
      throw new HttpException('Prospecto no encontrado', HttpStatus.NOT_FOUND);
    }
    return prospecto;
  }

  /** PATCH /flota-prospectos/:id — Actualizar un prospecto (excepto operador) */
  @Patch('flota-prospectos/:id')
  @RequirePermissions('flota_prospectos.editar')
  async update(
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
    @Req() req: AuthedReq,
  ) {
    try {
      const actor = { userId: req.user.userId, userName: req.user.name };
      return await this.service.update(id, body, actor);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new HttpException(
        `No se pudo actualizar el prospecto: ${msg}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /** PATCH /flota-prospectos/:id/operador — Asignar operador a un prospecto */
  @Patch('flota-prospectos/:id/operador')
  @RequirePermissions('flota_prospectos.asignar')
  async updateOperador(
    @Param('id') id: string,
    @Body() body: { operador?: string | null },
    @Req() req: AuthedReq,
  ) {
    try {
      const actor = { userId: req.user.userId, userName: req.user.name };
      return await this.service.updateOperador(id, body.operador, actor);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new HttpException(
        `No se pudo asignar operador: ${msg}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /** DELETE /flota-prospectos/:id — Eliminar un prospecto */
  @Delete('flota-prospectos/:id')
  @RequirePermissions('flota_prospectos.eliminar')
  async remove(@Param('id') id: string) {
    try {
      await this.service.remove(id);
      return { deleted: true };
    } catch (err) {
      console.error('Error eliminando prospecto:', err);
      throw new HttpException(
        err instanceof Error ? err.message : 'No se pudo eliminar el prospecto',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /** POST /flota-prospectos/delete-many — Eliminar múltiples prospectos */
  @Post('flota-prospectos/delete-many')
  @RequirePermissions('flota_prospectos.eliminar')
  async removeMany(@Body() ids: string[]) {
    try {
      const deleted = await this.service.removeMany(ids);
      return { deleted };
    } catch {
      throw new HttpException(
        'No se pudo eliminar los prospectos',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /** POST /flota-prospectos — Crear nuevo prospecto */
  @Post('flota-prospectos')
  @RequirePermissions('flota_prospectos.crear')
  async create(@Body() body: Record<string, unknown>) {
    try {
      return await this.service.createOne(body);
    } catch (err) {
      throw new HttpException(
        err instanceof Error ? err.message : 'No se pudo crear el prospecto',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
