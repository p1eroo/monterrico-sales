import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, sheets_v4 } from 'googleapis';
import { JWT } from 'google-auth-library';

export interface SheetsSpreadsheet {
  id: string;
  name: string;
}

@Injectable()
export class GoogleSheetsService {
  private readonly logger = new Logger(GoogleSheetsService.name);
  private sheets: sheets_v4.Sheets;
  private spreadsheets: SheetsSpreadsheet[] = [];

  constructor(private config: ConfigService) {
    const serviceAccountEmail = this.config.get<string>(
      'GOOGLE_SERVICE_ACCOUNT_EMAIL',
    );
    const privateKey = this.config.get<string>('GOOGLE_PRIVATE_KEY');

    this.spreadsheets = this.parseSpreadsheetConfigs();

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
      `Google Sheets service initialized – ${this.spreadsheets.length} spreadsheet(s): ${this.spreadsheets.map(s => s.name).join(', ')}`,
    );
  }

  private parseSpreadsheetConfigs(): SheetsSpreadsheet[] {
    const configsRaw = this.config.get<string>('GOOGLE_SHEETS_CONFIGS');
    if (configsRaw) {
      try {
        const parsed = JSON.parse(configsRaw) as SheetsSpreadsheet[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch {
        this.logger.warn('Failed to parse GOOGLE_SHEETS_CONFIGS JSON');
      }
    }

    const legacyId = this.config.get<string>('GOOGLE_SHEETS_SPREADSHEET_ID', '');
    if (legacyId) {
      return [{ id: legacyId, name: 'Default' }];
    }

    return [];
  }

  getSpreadsheets(): SheetsSpreadsheet[] {
    return this.spreadsheets;
  }

  private resolveSpreadsheetId(spreadsheetId?: string): string {
    if (spreadsheetId) return spreadsheetId;
    if (this.spreadsheets.length > 0) return this.spreadsheets[0].id;
    return '';
  }

  /**
   * Lee todas las filas de la primera hoja del spreadsheet.
   * Devuelve un array de arrays de strings (sin la fila de cabecera).
   * Para sheets grandes usa paginación por bloques para no exceder
   * el límite de 10 MB de la Google Sheets API.
   */
  async readAllRows(sheetName?: string, spreadsheetId?: string): Promise<string[][]> {
    const effectiveId = this.resolveSpreadsheetId(spreadsheetId);
    const MAX_ROWS_PER_CALL = 10000;
    const rangePrefix = sheetName ? `${sheetName}!` : '';
    let start = 1;
    const allRows: string[][] = [];

    while (true) {
      const end = start + MAX_ROWS_PER_CALL - 1;
      const range = `${rangePrefix}A${start}:Z${end}`;

      const res = await this.sheets.spreadsheets.values.get({
        spreadsheetId: effectiveId,
        range,
      });

      const values = res.data.values ?? [];
      if (values.length === 0) break;

      allRows.push(...values);

      if (values.length < MAX_ROWS_PER_CALL) break;
      start += MAX_ROWS_PER_CALL;
    }

    if (allRows.length === 0) {
      this.logger.warn('Sheet completamente vacío');
      return [];
    }

    return allRows;
  }


  /**
   * Obtiene los nombres de todas las hojas del spreadsheet.
   */
  async getSheetNames(spreadsheetId?: string): Promise<string[]> {
    const effectiveId = this.resolveSpreadsheetId(spreadsheetId);
    const res = await this.sheets.spreadsheets.get({
      spreadsheetId: effectiveId,
    });
    return (
      res.data.sheets?.map((s) => s.properties?.title ?? '') ?? []
    ).filter(Boolean);
  }
}
