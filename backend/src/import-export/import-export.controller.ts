import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ImportExportService } from './import-export.service';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';

const importFileOpts = {
  storage: memoryStorage(),
  limits: { fileSize: 6 * 1024 * 1024 },
};

@Controller('import-export')
@UseGuards(PermissionsGuard)
export class ImportExportController {
  constructor(private readonly importExportService: ImportExportService) {}

  @Get('contacts/template')
  @RequirePermissions('contactos.exportar')
  contactsTemplate(@Res({ passthrough: false }) res: Response) {
    const body = this.importExportService.contactsTemplateCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="plantilla-contactos.csv"',
    );
    res.send(body);
  }

  @Get('contacts/export')
  @RequirePermissions('contactos.exportar')
  async contactsExport(@Res({ passthrough: false }) res: Response) {
    const body = await this.importExportService.contactsExportCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="contactos-export.csv"',
    );
    res.send(body);
  }

  @Post('contacts/preview')
  @RequirePermissions('contactos.crear')
  @UseInterceptors(FileInterceptor('file', importFileOpts))
  async contactsPreview(@UploadedFile() file?: Express.Multer.File) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Adjunta un archivo CSV (.csv)');
    }
    const text = file.buffer.toString('utf-8');
    return this.importExportService.previewContactsImport(text);
  }

  @Post('contacts/import')
  @RequirePermissions('contactos.crear')
  @UseInterceptors(FileInterceptor('file', importFileOpts))
  async contactsImport(@UploadedFile() file?: Express.Multer.File) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Adjunta un archivo CSV (.csv)');
    }
    const text = file.buffer.toString('utf-8');
    return this.importExportService.importContacts(text);
  }

  @Get('companies/template')
  @RequirePermissions('empresas.exportar')
  companiesTemplate(@Res({ passthrough: false }) res: Response) {
    const body = this.importExportService.companiesTemplateCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="plantilla-empresas.csv"',
    );
    res.send(body);
  }

  @Get('companies/export')
  @RequirePermissions('empresas.exportar')
  async companiesExport(@Res({ passthrough: false }) res: Response) {
    const body = await this.importExportService.companiesExportCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="empresas-export.csv"',
    );
    res.send(body);
  }

  @Post('companies/preview')
  @RequirePermissions('empresas.crear')
  @UseInterceptors(FileInterceptor('file', importFileOpts))
  async companiesPreview(@UploadedFile() file?: Express.Multer.File) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Adjunta un archivo CSV (.csv)');
    }
    const text = file.buffer.toString('utf-8');
    return this.importExportService.previewCompaniesImport(text);
  }

  @Post('companies/import')
  @RequirePermissions('empresas.crear')
  @UseInterceptors(FileInterceptor('file', importFileOpts))
  async companiesImport(@UploadedFile() file?: Express.Multer.File) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Adjunta un archivo CSV (.csv)');
    }
    const text = file.buffer.toString('utf-8');
    return this.importExportService.importCompanies(text);
  }

  @Get('opportunities/template')
  @RequirePermissions('oportunidades.exportar')
  opportunitiesTemplate(@Res({ passthrough: false }) res: Response) {
    const body = this.importExportService.opportunitiesTemplateCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="plantilla-oportunidades.csv"',
    );
    res.send(body);
  }

  @Get('opportunities/export')
  @RequirePermissions('oportunidades.exportar')
  async opportunitiesExport(@Res({ passthrough: false }) res: Response) {
    const body = await this.importExportService.opportunitiesExportCsv();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="oportunidades-export.csv"',
    );
    res.send(body);
  }

  @Post('opportunities/import')
  @RequirePermissions('oportunidades.crear')
  @UseInterceptors(FileInterceptor('file', importFileOpts))
  async opportunitiesImport(@UploadedFile() file?: Express.Multer.File) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Adjunta un archivo CSV (.csv)');
    }
    const text = file.buffer.toString('utf-8');
    return this.importExportService.importOpportunities(text);
  }
}
