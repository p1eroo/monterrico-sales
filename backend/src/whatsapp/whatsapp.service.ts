import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../generated/prisma';
import { PrismaService } from '../prisma/prisma.service';
import { ContactsService } from '../contacts/contacts.service';
import type { CrmDataScope } from '../auth/crm-data-scope.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EvogoClient } from './evogo.client';
import { SendWhatsappDto } from './dto/send-whatsapp.dto';
import { normalizePeWaNumber } from './wa-number.util';
import {
  parseMessageEventData,
  readMessageEventPayload,
  stripHeavyPayload,
} from './evolution-webhook.util';

@Injectable()
export class WhatsappService {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly evogo: EvogoClient,
    private readonly contactsService: ContactsService,
    private readonly notifications: NotificationsService,
  ) {}

  private defaultInstanceKey(): string {
    const k = this.config.get<string>('EVOGO_INSTANCE_API_KEY')?.trim();
    if (!k) {
      throw new ServiceUnavailableException(
        'WhatsApp (Evolution GO) no está configurado: falta EVOGO_INSTANCE_API_KEY',
      );
    }
    return k;
  }

  private displaySenderId(): string {
    return (
      this.config.get<string>('EVOGO_DISPLAY_LINE_ID')?.trim() || 'evolution-go'
    );
  }

  async sendFromCrm(dto: SendWhatsappDto, scope: CrmDataScope, userId: string) {
    const instanceKey = dto.instanceApiKey?.trim() || this.defaultInstanceKey();
    const contact = await this.contactsService.findOne(dto.contactId, scope);
    const to = normalizePeWaNumber(contact.telefono);
    if (to.length < 8) {
      throw new ServiceUnavailableException(
        'El contacto no tiene un teléfono válido para WhatsApp',
      );
    }

    const sent = await this.evogo.sendText({
      instanceApiKey: instanceKey,
      number: to,
      text: dto.text.trim(),
    });

    if (!sent.ok) {
      const msg =
        typeof sent.raw === 'object' &&
        sent.raw !== null &&
        'error' in sent.raw
          ? String((sent.raw as { error?: unknown }).error)
          : `Evolution GO respondió ${sent.status}`;
      throw new ServiceUnavailableException(
        `No se pudo enviar el mensaje: ${msg}`,
      );
    }

    const lineId = this.displaySenderId();
    const evoInstanceId =
      this.config.get<string>('EVOGO_INSTANCE_ID')?.trim() || 'crm-send';
    const row = await this.prisma.crmWhatsappMessage.create({
      data: {
        direction: 'outbound',
        evoInstanceId,
        evoInstanceName: this.config
          .get<string>('EVOGO_INSTANCE_NAME')
          ?.trim(),
        waMessageId: sent.waMessageId ?? null,
        fromWaId: lineId,
        toWaId: to,
        body: dto.text.trim(),
        payloadJson: stripHeavyPayload(sent.raw) as Prisma.InputJsonValue,
        contactId: contact.id,
        createdByUserId: userId,
      },
    });

    return {
      id: row.id,
      direction: row.direction,
      toWaId: row.toWaId,
      waMessageId: row.waMessageId,
    };
  }

  async listForContact(contactId: string, scope: CrmDataScope, limit = 50) {
    await this.contactsService.findOne(contactId, scope);
    const take = Math.min(200, Math.max(1, limit));
    const rows = await this.prisma.crmWhatsappMessage.findMany({
      where: { contactId },
      orderBy: { createdAt: 'desc' },
      take,
      select: {
        id: true,
        direction: true,
        body: true,
        fromWaId: true,
        toWaId: true,
        createdAt: true,
        waMessageId: true,
        evoInstanceName: true,
      },
    });
    return { items: rows.reverse() };
  }

  /**
   * Webhook público: cuerpo JSON de Evolution GO (event + data + instance*).
   * Query `token` debe coincidir con EVOGO_WEBHOOK_SECRET si está definido.
   */
  async handleEvolutionWebhook(
    queryToken: string | undefined,
    body: unknown,
  ): Promise<{ ok: boolean; ignored?: string }> {
    const secret = this.config.get<string>('EVOGO_WEBHOOK_SECRET')?.trim();
    if (secret && queryToken !== secret) {
      throw new UnauthorizedException('Token de webhook inválido');
    }

    const parsed = readMessageEventPayload(body);
    if (!parsed) {
      return { ok: true, ignored: 'not_json_event' };
    }

    if (parsed.event !== 'Message') {
      return { ok: true, ignored: `event:${parsed.event}` };
    }

    const msg = parseMessageEventData(parsed.data);

    if (msg.isGroup) {
      return { ok: true, ignored: 'group' };
    }

    if (msg.isFromMe) {
      return { ok: true, ignored: 'from_me' };
    }

    const peerDigits = msg.senderDigits || msg.chatDigits;
    if (!peerDigits || peerDigits.length < 8) {
      return { ok: true, ignored: 'no_peer' };
    }

    if (msg.waMessageId) {
      const dup = await this.prisma.crmWhatsappMessage.findFirst({
        where: {
          evoInstanceId: parsed.instanceId,
          waMessageId: msg.waMessageId,
          direction: 'inbound',
        },
      });
      if (dup) {
        return { ok: true, ignored: 'duplicate' };
      }
    }

    const contact = await this.findContactByLoosePhone(peerDigits);
    const ourLine = this.displaySenderId();

    const textBody = msg.text.trim() || '[Sin texto]';

    await this.prisma.crmWhatsappMessage.create({
      data: {
        direction: 'inbound',
        evoInstanceId: parsed.instanceId || 'unknown',
        evoInstanceName: parsed.instanceName,
        waMessageId: msg.waMessageId,
        fromWaId: peerDigits,
        toWaId: ourLine,
        body: textBody,
        payloadJson: stripHeavyPayload(parsed.data) as Prisma.InputJsonValue,
        contactId: contact?.id ?? null,
      },
    });

    if (contact?.assignedTo) {
      try {
        await this.notifications.notifyWhatsappInbound({
          userId: contact.assignedTo,
          contactId: contact.id,
          contactName: contact.name,
          preview: textBody.slice(0, 500),
          evoInstanceName: parsed.instanceName,
          waMessageId: msg.waMessageId,
          evoInstanceId: parsed.instanceId || 'unknown',
        });
      } catch (e) {
        this.logger.warn(`notifyWhatsappInbound: ${String(e)}`);
      }
    }

    return { ok: true };
  }

  private async findContactByLoosePhone(peerDigits: string) {
    const suffix9 = peerDigits.slice(-9);
    const with51 = peerDigits.startsWith('51')
      ? peerDigits
      : `51${suffix9}`;
    return this.prisma.contact.findFirst({
      where: {
        OR: [
          { telefono: { contains: peerDigits } },
          { telefono: { contains: suffix9 } },
          { telefono: { contains: with51 } },
        ],
      },
      select: {
        id: true,
        name: true,
        telefono: true,
        assignedTo: true,
      },
    });
  }
}
