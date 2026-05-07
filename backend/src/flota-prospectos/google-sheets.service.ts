import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, sheets_v4 } from 'googleapis';
import { JWT } from 'google-auth-library';

@Injectable()
export class GoogleSheetsService {
  private readonly logger = new Logger(GoogleSheetsService.name);
  private sheets: sheets_v4.Sheets;
  private spreadsheetId: string;

  constructor(private config: ConfigService) {
    const serviceAccountEmail = this.config.get<string>(
      'GOOGLE_SERVICE_ACCOUNT_EMAIL',
    );
    const privateKey = this.config.get<string>('GOOGLE_PRIVATE_KEY');
    this.spreadsheetId = this.config.get<string>(
      'GOOGLE_SHEETS_SPREADSHEET_ID',
      '',
    );

    if (!serviceAccountEmail || !privateKey) {
      this.logger.warn(
        'Google Sheets credentials not configured. Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY in .env',
      );
    }

    const auth = new JWT({
      email: serviceAccountEmail,
      key: privateKey?.replace(/\\n/g, '\n'),
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
