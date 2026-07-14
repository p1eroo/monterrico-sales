import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ChatwootOperadorSyncService } from './chatwoot-operador-sync.service';

@Injectable()
export class ChatwootOperadorReconcileScheduler {
  private readonly logger = new Logger(ChatwootOperadorReconcileScheduler.name);

  constructor(private readonly operadorSync: ChatwootOperadorSyncService) {}

  /** Cierre del día Perú (23:50): reconcilia antes de medianoche para no perder el día calendario. */
  @Cron('50 23 * * *', {
    name: 'chatwoot-operador-reconcile-daily',
    timeZone: 'America/Lima',
  })
  async reconcileDaily() {
    try {
      const stats = await this.operadorSync.reconcileOperadoresFromChatwoot({
        maxConversations: 2_000,
      });
      this.logger.log(
        `Reconcile operador Chatwoot: actualizados=${stats.updated}, ` +
        `prospectos=${stats.prospectsChecked}, convs=${stats.conversationsChecked}, ` +
        `errores=${stats.errors}`,
      );
    } catch (err) {
      this.logger.error(`Reconcile operador Chatwoot falló: ${err}`);
    }
  }
}
