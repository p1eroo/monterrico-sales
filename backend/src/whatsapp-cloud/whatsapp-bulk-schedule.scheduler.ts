import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { WhatsappCloudService } from './whatsapp-cloud.service';

@Injectable()
export class WhatsappBulkScheduleScheduler {
  private readonly logger = new Logger(WhatsappBulkScheduleScheduler.name);
  private running = false;

  constructor(private readonly whatsappCloud: WhatsappCloudService) {}

  /** Cada minuto: dispara campañas programadas cuya hora (UTC) ya llegó. */
  @Cron('* * * * *', { timeZone: 'America/Lima' })
  async dispatchDueCampaigns() {
    if (this.running) return;
    this.running = true;
    try {
      const n = await this.whatsappCloud.dispatchDueScheduledCampaigns();
      if (n > 0) {
        this.logger.log(`Disparadas ${n} campaña(s) WhatsApp programada(s)`);
      }
    } catch (err) {
      this.logger.error(
        `Cron envíos programados falló: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      this.running = false;
    }
  }
}
