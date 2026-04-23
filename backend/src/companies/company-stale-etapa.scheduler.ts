import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CompanyStaleEtapaService } from './company-stale-etapa.service';

/** Zona horaria fija para el corte semanal (Perú, sin DST). */
const CRON_TZ_LIMA = 'America/Lima';

/**
 * Auto-inactivo por antigüedad: una vez por semana, domingo 23:59 en hora Perú.
 * (minuto 59, hora 23; el segundo efectivo es 0 según el parser de 5 campos del cron.)
 */
const CRON_STALE_INACTIVO = '59 23 * * 0';

@Injectable()
export class CompanyStaleEtapaScheduler {
  private readonly logger = new Logger(CompanyStaleEtapaScheduler.name);

  constructor(private readonly stale: CompanyStaleEtapaService) {}

  @Cron(CRON_STALE_INACTIVO, {
    name: 'company-stale-etapa-inactivo',
    timeZone: CRON_TZ_LIMA,
  })
  async runWeeklySundayLima(): Promise<void> {
    try {
      await this.stale.applyStaleInactivo();
    } catch (e) {
      this.logger.error(`Cron auto-inactivo empresas falló: ${e}`);
    }
  }
}
