import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FilesService } from '../files/files.service';
import { ChatwootClient } from './chatwoot.client';
import { ChatwootOperadorSyncService } from './chatwoot-operador-sync.service';
import { FlotaDocumentExtractionService } from '../flota-prospectos/flota-document-extraction.service';
import type { ChatwootAttachment, ChatwootMessage } from './chatwoot.types';

type ProspectoRef = { id: string; nombreCompleto: string };

@Injectable()
export class ChatwootAttachmentStorageService {
  private readonly logger = new Logger(ChatwootAttachmentStorageService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FilesService,
    private readonly client: ChatwootClient,
    private readonly operadorSync: ChatwootOperadorSyncService,
    private readonly documentExtraction: FlotaDocumentExtractionService,
  ) {}

  /** Guarda adjuntos de un mensaje Chatwoot ya enviado (buffer local disponible). */
  async storeOutboundUpload(args: {
    conversationId: number;
    uploadedById: string;
    buffer: Buffer;
    originalName: string;
    mimeType: string;
    message: ChatwootMessage;
    authorizationHeader?: string;
  }): Promise<void> {
    const prospecto = await this.resolveProspectoForConversation(args.conversationId);
    if (!prospecto) {
      this.logger.warn(
        `Adjunto Chatwoot outbound conv ${args.conversationId}: sin prospecto, omitido`,
      );
      return;
    }
    const attachments = args.message.attachments ?? [];
    if (attachments.length === 0) {
      await this.persistBuffer({
        prospecto,
        uploadedById: args.uploadedById,
        messageId: args.message.id,
        attachmentId: '0',
        buffer: args.buffer,
        originalName: args.originalName,
        mimeType: args.mimeType,
        authorizationHeader: args.authorizationHeader,
      });
      return;
    }
    for (const att of attachments) {
      await this.persistBuffer({
        prospecto,
        uploadedById: args.uploadedById,
        messageId: args.message.id,
        attachmentId: att.id,
        buffer: args.buffer,
        originalName: args.originalName,
        mimeType: args.mimeType,
        authorizationHeader: args.authorizationHeader,
      });
    }
  }

  /** Guarda adjuntos entrantes/salientes desde webhook message_created. */
  async storeFromWebhookPayload(args: {
    payload: Record<string, unknown>;
    prospecto: ProspectoRef;
    uploadedById: string | null;
  }): Promise<void> {
    const messageId = args.payload.id as string | number | undefined;
    if (messageId == null) return;

    const attachments = (args.payload.attachments as ChatwootAttachment[] | undefined) ?? [];
    if (!attachments.length) return;

    const uploadedById =
      args.uploadedById ?? (await this.fallbackUploaderId());

    for (const att of attachments) {
      const mediaUrl = att.data_url || att.file_url || (att as { thumb_url?: string }).thumb_url;
      if (!mediaUrl) continue;

      const relatedEntityId = `${messageId}:${att.id ?? mediaUrl}`;
      const exists = await this.prisma.crmFile.findFirst({
        where: {
          relatedEntityType: 'chatwoot-message',
          relatedEntityId,
        },
        select: { id: true },
      });
      if (exists) continue;

      try {
        const { buffer, contentType } = await this.client.fetchMedia(mediaUrl);
        const originalName = this.fileNameFromAttachment(att, contentType);
        const mimeType = this.mimeFromAttachment(att, contentType, originalName);
        await this.persistBuffer({
          prospecto: args.prospecto,
          uploadedById,
          messageId,
          attachmentId: att.id ?? relatedEntityId,
          buffer,
          originalName,
          mimeType,
        });
      } catch (e) {
        this.logger.warn(
          `No se pudo copiar adjunto Chatwoot ${messageId}/${att.id} a bucket Flota: ${String(e)}`,
        );
      }
    }
  }

  private async persistBuffer(args: {
    prospecto: ProspectoRef;
    uploadedById: string;
    messageId: string | number;
    attachmentId: string | number;
    buffer: Buffer;
    originalName: string;
    mimeType: string;
    authorizationHeader?: string;
  }): Promise<void> {
    const relatedEntityId = `${args.messageId}:${args.attachmentId}`;
    const exists = await this.prisma.crmFile.findFirst({
      where: {
        relatedEntityType: 'chatwoot-message',
        relatedEntityId,
      },
      select: { id: true },
    });
    if (exists) return;

    await this.files.create(args.uploadedById, {
      buffer: args.buffer,
      originalName: args.originalName,
      mimeType: args.mimeType,
      entityType: 'flota-prospecto',
      entityId: args.prospecto.id,
      entityName: args.prospecto.nombreCompleto,
      relatedEntityType: 'chatwoot-message',
      relatedEntityId,
      relatedEntityName: `chatwoot-${args.mimeType.split('/')[0] || 'file'}`,
      authorizationHeader: args.authorizationHeader,
    });
    void this.documentExtraction
      .processFile(
        args.prospecto.id,
        args.buffer,
        args.mimeType,
        args.originalName,
      )
      .catch(() => undefined);
    this.logger.log(
      `Adjunto Chatwoot guardado en bucket Flota (prospecto ${args.prospecto.id}, ${relatedEntityId})`,
    );
  }

  async resolveProspectoForConversation(
    conversationId: number,
  ): Promise<ProspectoRef | null> {
    const linked = await this.prisma.flotaProspecto.findFirst({
      where: { chatwootConversationId: conversationId },
      select: { id: true, nombreCompleto: true },
    });
    if (linked) return linked;

    try {
      const conversation = await this.client.getConversation(conversationId);
      const phone = this.operadorSync.extractPhoneFromConversation(conversation);
      if (!phone) return null;
      const cleaned = phone.replace(/\D/g, '').slice(-9);
      if (!cleaned) return null;
      return this.prisma.flotaProspecto.findFirst({
        where: {
          OR: [
            { celular: { contains: cleaned } },
            { movil: { contains: cleaned } },
          ],
        },
        select: { id: true, nombreCompleto: true },
      });
    } catch {
      return null;
    }
  }

  private async fallbackUploaderId(): Promise<string> {
    const admin = await this.prisma.user.findFirst({
      where: { role: { slug: 'admin' } },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });
    if (!admin) {
      throw new Error('No hay usuario admin para registrar adjuntos Chatwoot');
    }
    return admin.id;
  }

  private fileNameFromAttachment(
    att: ChatwootAttachment,
    contentType: string,
  ): string {
    const fromUrl = (url?: string) => {
      if (!url) return '';
      try {
        const path = url.includes('://')
          ? new URL(url).pathname
          : url.split('?')[0];
        const base = path.split('/').pop() || '';
        return decodeURIComponent(base);
      } catch {
        return '';
      }
    };
    const candidate =
      (att as { file_name?: string }).file_name
      || fromUrl(att.data_url)
      || fromUrl(att.file_url)
      || '';
    if (candidate) return candidate.slice(0, 500);
    const ext = contentType.split('/')[1]?.split(';')[0] || 'bin';
    return `chatwoot-${att.id ?? 'file'}.${ext}`;
  }

  private mimeFromAttachment(
    att: ChatwootAttachment,
    contentType: string,
    fileName: string,
  ): string {
    if (att.file_type?.includes('/')) return att.file_type;
    if (contentType && contentType !== 'application/octet-stream') {
      return contentType;
    }
    const ext = fileName.split('.').pop()?.toLowerCase();
    const byExt: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      gif: 'image/gif',
      mp4: 'video/mp4',
      ogg: 'audio/ogg',
      mp3: 'audio/mpeg',
      pdf: 'application/pdf',
    };
    if (ext && byExt[ext]) return byExt[ext];
    const byType: Record<string, string> = {
      image: 'image/jpeg',
      audio: 'audio/ogg',
      video: 'video/mp4',
      file: 'application/octet-stream',
    };
    return byType[att.file_type] || 'application/octet-stream';
  }
}
