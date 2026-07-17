import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  ConflictException,
  HttpException,
  HttpStatus,
  Req,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { FlotaProspectosService } from './flota-prospectos.service';
import { Public } from '../auth/decorators/public.decorator';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { ImportExportJobsService } from '../import-export/import-export-jobs.service';
import { FilesService } from '../files/files.service';
import type { CrmDataScope } from '../auth/crm-data-scope.service';

type AuthedReq = {
  user: { userId: string; name: string; roleId?: string };
  headers: { authorization?: string };
};

@Controller()
@UseGuards(PermissionsGuard)
export class FlotaProspectosController {
  constructor(
    private readonly service: FlotaProspectosService,
    private readonly prisma: PrismaService,
    private readonly importExportJobs: ImportExportJobsService,
    private readonly filesService: FilesService,
  ) {}

  private async buildFlotaScope(
    userId: string,
    roleId?: string,
  ): Promise<CrmDataScope> {
    const perm = roleId
      ? await this.prisma.authority.findFirst({
          where: { roleId, permission: 'flota_prospectos.ver_todos' },
          select: { id: true },
        })
      : null;
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
    @Query('mesImport') mesImport?: string,
    @Query('fechaRegistroDesde') fechaRegistroDesde?: string,
    @Query('fechaRegistroHasta') fechaRegistroHasta?: string,
    @Query('mesImportDesde') mesImportDesde?: string,
    @Query('mesImportHasta') mesImportHasta?: string,
    @Query('redSocial') redSocial?: string,
    @Query('operador') operador?: string,
    @Query('filters') filters?: string,
    @Query('conLlamadas') conLlamadas?: string,
  ) {
    const scope = await this.buildFlotaScope(req.user.userId, req.user.roleId);
    return this.service.findAll(
      {
        page: page ? parseInt(page, 10) : 1,
        limit: limit ? parseInt(limit, 10) : 25,
        search: search || undefined,
        estado: estado || undefined,
        duplicados: duplicados === 'true',
        mes: mes || undefined,
        mesImport: mesImport || undefined,
        fechaRegistroDesde: fechaRegistroDesde || undefined,
        fechaRegistroHasta: fechaRegistroHasta || undefined,
        mesImportDesde: mesImportDesde || undefined,
        mesImportHasta: mesImportHasta || undefined,
        redSocial: redSocial || undefined,
        operador: operador || undefined,
        filters: filters || undefined,
        conLlamadas: conLlamadas || undefined,
      },
      scope,
    );
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
    const scope = await this.buildFlotaScope(req.user.userId, req.user.roleId);
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
    const scope = await this.buildFlotaScope(req.user.userId, req.user.roleId);
    return this.service.getOperadorStats(fecini, fecfin, scope);
  }

  /** GET /flota-prospectos/operador-stats/daily — Desglose diario por operador */
  @Get('flota-prospectos/operador-stats/daily')
  @RequirePermissions('flota_prospectos.ver')
  async getOperadorStatsDaily(
    @Query('fecini') fecini: string,
    @Query('fecfin') fecfin: string,
    @Req() req: AuthedReq,
  ) {
    const scope = await this.buildFlotaScope(req.user.userId, req.user.roleId);
    return this.service.getOperadorStatsDaily(fecini, fecfin, scope);
  }

  /**
   * POST /flota-prospectos/operador-stats/backfill
   * Cierra/reconstruye historial diario. Con fromActivityLog=true corrige asignados desde ActivityLog.
   */
  @Post('flota-prospectos/operador-stats/backfill')
  @RequirePermissions('flota_prospectos.ver_todos')
  async backfillOperadorStats(
    @Body()
    body: {
      fecini?: string;
      fecfin?: string;
      fromActivityLog?: boolean;
    },
  ) {
    const fecini = body.fecini?.trim();
    const fecfin = body.fecfin?.trim();
    if (!fecini || !fecfin) {
      throw new HttpException(
        'fecini y fecfin son requeridos (YYYY-MM-DD)',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (body.fromActivityLog) {
      return this.service.backfillOperadorStatsFromActivityLog(fecini, fecfin);
    }
    return this.service.backfillOperadorStatsDaily(fecini, fecfin);
  }

  /** POST /flota-prospectos/operador-stats/snapshot — Snapshot de un día (default: ayer Lima) */
  @Post('flota-prospectos/operador-stats/snapshot')
  @RequirePermissions('flota_prospectos.ver_todos')
  async snapshotOperadorStats(@Body() body: { fecha?: string }) {
    let fecha = body.fecha?.trim();
    if (!fecha) {
      const lima = new Date(
        new Date().toLocaleString('en-US', { timeZone: 'America/Lima' }),
      );
      lima.setDate(lima.getDate() - 1);
      const y = lima.getFullYear();
      const m = String(lima.getMonth() + 1).padStart(2, '0');
      const d = String(lima.getDate()).padStart(2, '0');
      fecha = `${y}-${m}-${d}`;
    }
    return this.service.snapshotOperadorStatsDay(fecha);
  }

  /** GET /flota-prospectos/masivo-list — Lista ligera de prospectos para el envío masivo */
  @Get('flota-prospectos/masivo-list')
  @RequirePermissions('flota_prospectos.ver')
  async listForMasivo(
    @Req() req: AuthedReq,
    @Query('search') search?: string,
    @Query('estado') estado?: string,
  ) {
    const scope = await this.buildFlotaScope(req.user.userId, req.user.roleId);
    return this.service.listForMasivo(search, scope, estado);
  }

  /** GET /flota/spreadsheets — Spreadsheets configurados */
  @Public()
  @Get('flota/spreadsheets')
  getSpreadsheets() {
    return { spreadsheets: this.service.getSpreadsheets() };
  }

  /** GET /flota/sheets — Hojas disponibles del spreadsheet */
  @Public()
  @Get('flota/sheets')
  async getSheetNames(@Query('spreadsheetId') spreadsheetId?: string) {
    try {
      const names = await this.service.getSheetNames(spreadsheetId);
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
  async getPreview(
    @Param('sheetName') sheetName: string,
    @Query('spreadsheetId') spreadsheetId?: string,
  ) {
    try {
      return await this.service.getPreview(sheetName, spreadsheetId);
    } catch (err) {
      throw new HttpException(
        err instanceof Error ? err.message : 'Error en vista previa',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  /** POST /flota/import-rows — Importar desde filas enviadas (archivo local) */
  @Post('flota/import-rows')
  @RequirePermissions('flota_prospectos.crear')
  async importRows(@Body() body: { rows: string[][] }, @Req() req: AuthedReq) {
    try {
      const totalRows = body.rows.length > 1 ? body.rows.length - 1 : 0;
      const actor = { userId: req.user.userId, userName: req.user.name };

      return this.importExportJobs.startJob(
        {
          entity: 'flota-prospecto',
          ownerUserId: req.user.userId,
          totalRows,
        },
        (update) =>
          this.service.importRowsWithProgress(body.rows, update, actor),
      );
    } catch (err) {
      throw new HttpException(
        err instanceof Error ? err.message : 'Error al importar desde archivo',
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
    @Query('spreadsheetId') spreadsheetId?: string,
  ) {
    try {
      const preview = await this.service.getPreview(sheetName, spreadsheetId);
      const totalRows = preview.totalRows;
      const actor = { userId: req.user.userId, userName: req.user.name };

      return this.importExportJobs.startJob(
        {
          entity: 'flota-prospecto',
          ownerUserId: req.user.userId,
          totalRows,
        },
        (update) =>
          this.service.importFromSheetsWithProgress(
            sheetName,
            update,
            spreadsheetId,
            actor,
          ),
      );
    } catch (err) {
      throw new HttpException(
        err instanceof Error ? err.message : 'Error al importar',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  /** GET /flota-prospectos/:id/con-archivos — Prospecto + archivos vinculados */
  @Get('flota-prospectos/:id/con-archivos')
  @RequirePermissions('flota_prospectos.ver')
  async findWithFiles(@Param('id') id: string) {
    const result = await this.service.findWithFiles(id);
    if (!result) {
      throw new HttpException('Prospecto no encontrado', HttpStatus.NOT_FOUND);
    }
    return result;
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
  async remove(@Param('id') id: string, @Req() req: AuthedReq) {
    try {
      const actor = { userId: req.user.userId, userName: req.user.name };
      await this.service.remove(id, actor);
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
  async removeMany(@Body() ids: string[], @Req() req: AuthedReq) {
    try {
      const actor = { userId: req.user.userId, userName: req.user.name };
      const deleted = await this.service.removeMany(ids, actor);
      return { deleted };
    } catch {
      throw new HttpException(
        'No se pudo eliminar los prospectos',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /** GET /flota-prospectos/by-phone/:phone — Buscar prospecto por celular */
  @Get('flota-prospectos/by-phone/:phone')
  @RequirePermissions('flota_prospectos.ver')
  async findByPhone(@Param('phone') phone: string) {
    const result = await this.service.findByPhone(phone);
    if (!result) return { found: false, prospecto: null };
    return { found: true, prospecto: result };
  }

  /** POST /flota-prospectos — Crear nuevo prospecto */
  @Post('flota-prospectos')
  @RequirePermissions('flota_prospectos.crear')
  async create(@Body() body: Record<string, unknown>, @Req() req: AuthedReq) {
    try {
      const actor = { userId: req.user.userId, userName: req.user.name };
      return await this.service.createOne(body, actor);
    } catch (err) {
      if (err instanceof ConflictException) throw err;
      throw new HttpException(
        err instanceof Error ? err.message : 'No se pudo crear el prospecto',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /** GET /flota-prospectos/:id/llamadas — Listar llamadas de un prospecto */
  @Get('flota-prospectos/:id/llamadas')
  @RequirePermissions('flota_prospectos.ver')
  async getLlamadas(@Param('id') id: string) {
    return this.service.getLlamadas(id);
  }

  /** GET /flota/calendario-citas — Prospectos con fechaCita para el calendario */
  @Get('flota/calendario-citas')
  @RequirePermissions('flota_prospectos.ver')
  async getCalendarCitas() {
    return this.service.getCalendarCitas();
  }

  /** POST /flota-prospectos/:id/llamadas — Registrar una llamada */
  @Post('flota-prospectos/:id/llamadas')
  @RequirePermissions('flota_prospectos.crear')
  async createLlamada(
    @Param('id') id: string,
    @Body()
    body: {
      userName: string;
      notas?: string | null;
      createdAt?: string | null;
    },
    @Req() req: AuthedReq,
  ) {
    try {
      return await this.service.createLlamada(id, {
        userName: req.user.name,
        notas: body.notas ?? null,
        createdAt: body.createdAt ?? null,
      });
    } catch (err) {
      throw new HttpException(
        err instanceof Error ? err.message : 'Error al registrar llamada',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /** GET /flota-prospectos/:id/archivos — Listar archivos de un prospecto */
  @Get('flota-prospectos/:id/archivos')
  @RequirePermissions('flota_prospectos.ver')
  async listArchivos(@Param('id') id: string) {
    return this.filesService.findAll('flota-prospecto', id);
  }

  /** POST /flota-prospectos/:id/archivos — Subir archivo a un prospecto */
  @Post('flota-prospectos/:id/archivos')
  @RequirePermissions('flota_prospectos.editar')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 50 * 1024 * 1024 },
    }),
  )
  async uploadArchivo(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: AuthedReq,
  ) {
    if (!file?.buffer) {
      throw new BadRequestException('Falta el archivo (campo file)');
    }
    return this.filesService.create(req.user.userId, {
      buffer: file.buffer,
      originalName: file.originalname || 'archivo',
      mimeType: file.mimetype || 'application/octet-stream',
      entityType: 'flota-prospecto',
      entityId: id,
      authorizationHeader: req.headers.authorization as string,
    });
  }

  /** DELETE /flota-prospectos/:id/archivos/:fileId — Eliminar archivo de un prospecto */
  @Delete('flota-prospectos/:id/archivos/:fileId')
  @RequirePermissions('flota_prospectos.editar')
  async deleteArchivo(
    @Param('id') id: string,
    @Param('fileId') fileId: string,
    @Req() req: AuthedReq,
  ) {
    return this.filesService.remove(fileId, req.user.userId);
  }
}
