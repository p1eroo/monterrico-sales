import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, sheets_v4 } from 'googleapis';
import * as path from 'path';

@Injectable()
export class GoogleSheetsService {
  private readonly logger = new Logger(GoogleSheetsService.name);
  private sheets: sheets_v4.Sheets;
  private spreadsheetId: string;

  constructor(private config: ConfigService) {
    const credentialsPath = this.config.get<string>(
      'GOOGLE_SHEETS_CREDENTIALS_PATH',
      'credentials/service-account.json',
    );
    this.spreadsheetId = this.config.get<string>(
      'GOOGLE_SHEETS_SPREADSHEET_ID',
      '',
    );

    const absPath = path.isAbsolute(credentialsPath)
      ? credentialsPath
      : path.resolve(process.cwd(), credentialsPath);

    const auth = new google.auth.GoogleAuth({
      keyFile: absPath,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    this.sheets = google.sheets({ version: 'v4', auth });
    this.logger.log(
      `Google Sheets service initialized – spreadsheet ${this.spreadsheetId}`,
    );
  }

  /**
   * Lee todas las filas de la primera hoja del spreadsheet.
   * Devuelve un array de arrays de strings (sin la fila de cabecera).
   */
  async readAllRows(sheetName?: string): Promise<string[][]> {
    const range = sheetName ? `${sheetName}` : 'A:Z';

    const res = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range,
    });

    const rows = res.data.values ?? [];
    if (rows.length === 0) {
      this.logger.warn('Sheet completamente vacío');
      return [];
    }

    // Devolvemos todo bruto, la lógica de negocio (detección de cabeceras) 
    // se maneja en el servicio de FlotaProspectos para evitar duplicidad.
    return rows;
  }


  /**
   * Obtiene los nombres de todas las hojas del spreadsheet.
   */
  async getSheetNames(): Promise<string[]> {
    const res = await this.sheets.spreadsheets.get({
      spreadsheetId: this.spreadsheetId,
    });
    return (
      res.data.sheets?.map((s) => s.properties?.title ?? '') ?? []
    ).filter(Boolean);
  }
}
