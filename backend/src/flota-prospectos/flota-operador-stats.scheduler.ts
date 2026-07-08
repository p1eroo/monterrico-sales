import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { FlotaProspectosService } from './flota-prospectos.service';

@Injectable()
export class FlotaOperadorStatsScheduler {
  private readonly logger = new Logger(FlotaOperadorStatsScheduler.name);

  constructor(private readonly flotaProspectos: FlotaProspectosService) {}

  /** Cierra el día anterior (hora Lima) y guarda el snapshot de Actividad por Operador. */
  @Cron('5 0 * * *', {
    name: 'flota-operador-stats-daily',
    timeZone: 'America/Lima',
  })
  async snapshotYesterday() {
    const yesterday = new Date();
    // Retroceder un día calendario en Lima
    const limaNow = new Date(
      yesterday.toLocaleString('en-US', { timeZone: 'America/Lima' }),
    );
    limaNow.setDate(limaNow.getDate() - 1);
    const y = limaNow.getFullYear();
    const m = String(limaNow.getMonth() + 1).padStart(2, '0');
    const d = String(limaNow.getDate()).padStart(2, '0');
    const fecha = `${y}-${m}-${d}`;

    try {
      const result = await this.flotaProspectos.snapshotOperadorStatsDay(fecha);
      this.logger.log(
        `Snapshot operador-stats ${fecha}: ${result.operadores} operador(es)`,
      );
    } catch (err) {
      this.logger.error(`Snapshot operador-stats falló para ${fecha}: ${err}`);
    }
  }
}
