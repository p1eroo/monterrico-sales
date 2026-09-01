import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChatwootClient } from './chatwoot.client';

export type ProspectoNameRef = {
  nombreCompleto: string;
  dni?: string | null;
};

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Decide si un nombre entrante de Chatwoot puede sobrescribir el prospecto local. */
export function shouldAcceptChatwootName(
  local: ProspectoNameRef,
  incomingName: string,
): boolean {
  const incoming = incomingName?.trim();
  if (!incoming) return false;

  const localName = local.nombreCompleto?.trim();
  if (!localName) return true;

  if (local.dni?.trim()) return false;

  if (normalizeName(localName) === normalizeName(incoming)) return false;

  const localWords = localName.split(/\s+/).filter(Boolean).length;
  const incomingWords = incoming.split(/\s+/).filter(Boolean).length;
  if (incomingWords < localWords) return false;
  if (incoming.length < localName.length) return false;

  return true;
}

@Injectable()
export class ChatwootContactNameSyncService {
  private readonly logger = new Logger(ChatwootContactNameSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: ChatwootClient,
  ) {}

  shouldAcceptChatwootName(local: ProspectoNameRef, incomingName: string): boolean {
    return shouldAcceptChatwootName(local, incomingName);
  }

  /** Envía el nombre del prospecto al contacto vinculado en Chatwoot. */
  async pushNameToChatwoot(prospectoId: string, newName: string): Promise<void> {
    const trimmed = newName?.trim();
    if (!trimmed) return;

    try {
      const prospecto = await this.prisma.flotaProspecto.findUnique({
        where: { id: prospectoId },
        select: {
          id: true,
          chatwootContactId: true,
          celular: true,
          nombreCompleto: true,
        },
      });
      if (!prospecto) return;

      const contactId = await this.resolveContactId(prospecto);
      if (!contactId) {
        this.logger.warn(
          `Chatwoot sync: sin contacto para prospecto ${prospectoId}`,
        );
        return;
      }

      await this.client.updateContact(contactId, { name: trimmed });

      if (!prospecto.chatwootContactId) {
        await this.prisma.flotaProspecto.update({
          where: { id: prospectoId },
          data: { chatwootContactId: contactId },
        });
      }

      this.logger.log(
        `Chatwoot contact ${contactId} actualizado → "${trimmed}" (prospecto ${prospectoId})`,
      );
    } catch (e) {
      this.logger.warn(
        `Chatwoot sync nombre falló prospecto ${prospectoId}: ${e instanceof Error ? e.message : e}`,
      );
    }
  }

  private async resolveContactId(prospecto: {
    chatwootContactId: number | null;
    celular: string | null;
  }): Promise<number | null> {
    if (prospecto.chatwootContactId && prospecto.chatwootContactId > 0) {
      return prospecto.chatwootContactId;
    }

    const phone = prospecto.celular;
    if (!phone) return null;

    const suffix = phone.replace(/\D/g, '').slice(-9);
    if (!suffix) return null;

    try {
      const contacts = await this.client.listContacts({ q: suffix });
      const match = contacts.find((c) => {
        const contactSuffix = (c.phone_number || '')
          .replace(/\D/g, '')
          .slice(-9);
        return contactSuffix === suffix;
      });
      return match?.id ?? null;
    } catch {
      return null;
    }
  }
}
