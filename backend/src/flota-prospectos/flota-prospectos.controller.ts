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
} from '@nestjs/common';
import { FlotaProspectosService } from './flota-prospectos.service';
import { Public } from '../auth/decorators/public.decorator';

@Controller()
export class FlotaProspectosController {
  constructor(private readonly service: FlotaProspectosService) {}

  /** GET /flota-prospectos — Listado paginado con filtros */
  @Get('flota-prospectos')
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('estado') estado?: string,
    @Query('duplicados') duplicados?: string,
    @Query('mes') mes?: string,
    @Query('redSocial') redSocial?: string,
  ) {
    return this.service.findAll({
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 25,
      search: search || undefined,
      estado: estado || undefined,
      duplicados: duplicados === 'true',
      mes: mes || undefined,
      redSocial: redSocial || undefined,
    });
  }

  /** GET /flota-prospectos/counts — Conteo por estado + duplicados */
  @Get('flota-prospectos/counts')
  async getCounts() {
    return this.service.getCounts();
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


  /** POST /flota/import/:sheetName — Importar desde Google Sheets */
  @Post('flota/import/:sheetName')
  async importFromSheets(@Param('sheetName') sheetName: string) {
    try {
      const result = await this.service.importFromSheets(sheetName);
      return result;
    } catch (err) {
      throw new HttpException(
        err instanceof Error ? err.message : 'Error al importar',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  /** GET /flota-prospectos/:id — Detalle de un prospecto */
  @Get('flota-prospectos/:id')
  async findOne(@Param('id') id: string) {
    const prospecto = await this.service.findOne(id);
    if (!prospecto) {
      throw new HttpException('Prospecto no encontrado', HttpStatus.NOT_FOUND);
    }
    return prospecto;
  }

  /** PATCH /flota-prospectos/:id — Actualizar un prospecto */
  @Patch('flota-prospectos/:id')
  async update(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    try {
      return await this.service.update(id, body);
    } catch {
      throw new HttpException(
        'No se pudo actualizar el prospecto',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /** DELETE /flota-prospectos/:id — Eliminar un prospecto */
  @Delete('flota-prospectos/:id')
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
