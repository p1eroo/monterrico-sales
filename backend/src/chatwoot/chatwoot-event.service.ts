import { Injectable, Logger } from '@nestjs/common';
import type { Namespace } from 'socket.io';

/**
 * Servicio puente para compartir el namespace de Socket.IO /chatwoot
 * entre el gateway (que lo crea) y el webhook service (que lo usa para emitir).
 */
@Injectable()
export class ChatwootEventService {
  private readonly logger = new Logger(ChatwootEventService.name);
  private _namespace: Namespace | null = null;

  /** El gateway llama a esto cuando se inicializa */
  set namespace(ns: Namespace | null) {
    this._namespace = ns;
    if (ns) {
      this.logger.log(`✅ Namespace /chatwoot guardado. Clientes: ${ns.sockets?.size ?? 0}`);
    }
  }

  get namespace(): Namespace | null {
    return this._namespace;
  }

  get isReady(): boolean {
    return this._namespace !== null;
  }
}
