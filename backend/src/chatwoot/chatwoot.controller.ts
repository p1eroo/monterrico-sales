import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  ParseIntPipe,
  Res,
  Req,
  Logger,
} from '@nestjs/common';
import { HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { ChatwootService } from './chatwoot.service';
import { ChatwootClient } from './chatwoot.client';
import { ChatwootEventService } from './chatwoot-event.service';
import { ChatwootAttachmentStorageService } from './chatwoot-attachment-storage.service';

type AuthedReq = { user: { userId: string; name: string }; headers: { authorization?: string } };

@Controller('api/chatwoot')
export class ChatwootController {
  private readonly logger = new Logger(ChatwootController.name);

  constructor(
    private readonly service: ChatwootService,
    private readonly client: ChatwootClient,
    private readonly events: ChatwootEventService,
    private readonly attachmentStorage: ChatwootAttachmentStorageService,
  ) {}

  @Get('conversations')
  async listConversations(
    @Res({ passthrough: true }) res: Response,
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('inbox_id') inboxId?: string,
    @Query('page') page?: string,
    @Query('unread_only') unreadOnly?: string,
    @Query('force') force?: string,
  ) {
    if (unreadOnly === 'true' || unreadOnly === '1') {
      res.setHeader('Cache-Control', 'no-store');
      const items = await this.service.getUnreadConversations({
        force: force === 'true' || force === '1',
        page: page ? Number(page) : undefined,
      });
      return { data: items };
    }
    const items = await this.service.listConversations({
      status,
      q,
      inbox_id: inboxId ? Number(inboxId) : undefined,
      page: page ? Number(page) : undefined,
    });
    return { data: items };
  }

  @Get('conversations/search')
  async searchConversations(
    @Query('q') q: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.setHeader('Cache-Control', 'no-store');
    const items = await this.service.searchConversations(q ?? '');
    return { data: items };
  }

  /** Resuelve conversación por teléfono (rápido: contacto + historial). `deep=1` escanea inbox completo. */
  @Get('resolve-conversation')
  async resolveConversation(
    @Query('phone') phone: string,
    @Res({ passthrough: true }) res: Response,
    @Query('contact_id') contactId?: string,
    @Query('deep') deep?: string,
  ) {
    res.setHeader('Cache-Control', 'no-store');
    const conv = await this.service.resolveConversation(
      phone ?? '',
      contactId ? Number(contactId) : undefined,
      { deep: deep === 'true' || deep === '1' },
    );
    return { data: conv };
  }

  @Get('unread-summary')
  async unreadSummary(
    @Res({ passthrough: true }) res: Response,
    @Query('force') force?: string,
  ) {
    res.setHeader('Cache-Control', 'no-store');
    return this.service.getUnreadSummary(force === 'true' || force === '1');
  }

  @Get('conversations/:id')
  async getConversation(@Param('id', ParseIntPipe) id: number) {
    return this.client.getConversation(id);
  }

  @Get('conversations/:id/messages')
  async listMessages(
    @Param('id', ParseIntPipe) id: number,
    @Query('before') before?: string,
  ) {
    return this.service.listMessages(id, before ? Number(before) : undefined);
  }

  @Post('conversations/:id/messages')
  async sendMessage(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: {
      content?: string;
      template_params?: {
        name: string;
        category: string;
        language: string;
        processed_params: Record<string, unknown>;
      };
    },
    @Req() req: AuthedReq,
  ) {
    return this.service.sendMessage(id, body.content ?? '', body.template_params, {
      userId: req.user.userId,
      name: req.user.name,
    });
  }

  @Post('conversations/:id/messages/template')
  async sendTemplateMessage(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: {
      content?: string;
      templateName: string;
      templateCategory: string;
      templateLanguage?: string;
      templateParams?: Record<string, unknown>;
    },
    @Req() req: AuthedReq,
  ) {
    return this.service.sendMessage(id, body.content ?? '', {
      name: body.templateName,
      category: body.templateCategory,
      language: body.templateLanguage ?? 'es_PE',
      processed_params: body.templateParams ?? {},
    }, {
      userId: req.user.userId,
      name: req.user.name,
    });
  }

  @Patch('conversations/:id')
  async updateConversation(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { status?: string; assignee_id?: number },
  ) {
    return this.service.updateConversation(id, body);
  }

  @Post('conversations/:id/sync-operador')
  async syncOperador(
    @Param('id', ParseIntPipe) id: number,
    @Query('phone') phone?: string,
  ) {
    return this.service.syncOperadorFromConversation(id, phone);
  }

  @Get('contacts')
  async searchContacts(@Query('q') q: string) {
    return this.service.searchContacts(q ?? '');
  }

  @Post('contacts')
  async createContact(
    @Body() body: { name: string; phone_number?: string; email?: string },
  ) {
    return this.service.createContact(body);
  }

  @Patch('contacts/:id')
  async updateContact(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { name?: string; custom_attributes?: Record<string, string> },
  ) {
    return this.client.updateContact(id, body);
  }

  @Get('contacts/:id/conversations')
  async listContactConversations(@Param('id', ParseIntPipe) id: number) {
    const items = await this.service.getContactConversations(id);
    return { data: items };
  }

  @Get('inboxes')
  async listInboxes() {
    return this.service.listInboxes();
  }

  @Get('agents')
  async listAgents() {
    return this.service.listAgents();
  }

  @Get('config')
  async config() {
    return this.service.config();
  }

  @Post('conversations/:id/read')
  async markAsRead(@Param('id', ParseIntPipe) id: number) {
    await this.client.markAsRead(id);
    this.service.invalidateUnreadCache();
    return { received: true };
  }

  @Public()
  @Get('content')
  async content(
    @Query('url') url: string,
    @Res() res: Response,
  ) {
    if (!url) {
      res.status(400).json({ error: 'url query param required' });
      return;
    }
    try {
      const { buffer, contentType } = await this.client.fetchMedia(url);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(buffer);
    } catch (e) {
      this.logger.error(`[Content] ${e instanceof Error ? e.message : e}`);
      res.status(502).json({ error: 'Error al obtener contenido de Chatwoot' });
    }
  }

  @Post('conversations/:id/upload')
  async uploadAttachment(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { file: string; fileName: string; mimeType: string; caption?: string },
    @Req() req: AuthedReq,
  ) {
    const buffer = Buffer.from(body.file, 'base64');
    const msg = await this.client.uploadAttachment(
      id,
      buffer,
      body.fileName,
      body.mimeType,
      body.caption || '',
    );
    await this.attachmentStorage.storeOutboundUpload({
      conversationId: id,
      uploadedById: req.user.userId,
      buffer,
      originalName: body.fileName,
      mimeType: body.mimeType,
      message: msg,
      authorizationHeader:
        typeof req.headers.authorization === 'string'
          ? req.headers.authorization
          : undefined,
    }).catch((e) => {
      this.logger.warn(
        `Adjunto Chatwoot enviado pero no copiado a bucket Flota conv ${id}: ${e instanceof Error ? e.message : e}`,
      );
    });
    return msg;
  }

  @Public()
  @Get('test-emit')
  async testEmit() {
    const ns = this.events.namespace;
    if (!ns) {
      return { error: 'namespace null', nsReady: this.events.isReady };
    }
    const clientCount = (ns as unknown as { sockets?: Map<string, unknown> })?.sockets?.size ?? 0;
    ns.emit('chatwoot', { event: 'test', data: { msg: 'test desde backend', ts: Date.now() } });
    return { success: true, clients: clientCount };
  }

  @Post('initiate-conversation')
  async initiateConversation(
    @Body() body: {
      name: string;
      phone: string;
      contactId?: number;
      templateName?: string;
      templateCategory?: string;
      templateLanguage?: string;
      templateContent?: string;
      templateParams?: Record<string, unknown>;
      skipTemplate?: boolean;
      operador?: string;
    },
    @Req() req: AuthedReq,
  ) {
    try {
      const result = await this.service.initiateConversation({
        ...body,
        templateLanguage: body.templateLanguage ?? 'es_PE',
        sender: { userId: req.user.userId, name: req.user.name },
      });
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error desconocido';
      this.logger.error(`[initiate-conversation] ${msg}`);
      const statusMatch = msg.match(/Chatwoot API error (\d{3})/);
      const status = statusMatch
        ? (Number(statusMatch[1]) >= 400 && Number(statusMatch[1]) < 600
            ? Number(statusMatch[1])
            : HttpStatus.BAD_GATEWAY)
        : HttpStatus.BAD_GATEWAY;
      throw new HttpException(msg, status);
    }
  }

  @Get('templates')
  async listTemplates() {
    return this.service.listTemplates();
  }

  @Get('contacts-list')
  async listContacts(@Query('page') page?: string, @Query('q') q?: string) {
    return this.service.listContacts(page ? parseInt(page) : undefined, q);
  }
}
