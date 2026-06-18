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
  Logger,
} from '@nestjs/common';
import { NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { ChatwootService } from './chatwoot.service';
import { ChatwootClient } from './chatwoot.client';

@Controller('api/chatwoot')
export class ChatwootController {
  private readonly logger = new Logger(ChatwootController.name);

  constructor(
    private readonly service: ChatwootService,
    private readonly client: ChatwootClient,
  ) {}

  @Get('conversations')
  async listConversations(
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('inbox_id') inboxId?: string,
    @Query('page') page?: string,
  ) {
    const items = await this.service.listConversations({
      status,
      q,
      inbox_id: inboxId ? Number(inboxId) : undefined,
      page: page ? Number(page) : undefined,
    });
    return { data: items };
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
    @Body() body: { content: string },
  ) {
    return this.service.sendMessage(id, body.content);
  }

  @Patch('conversations/:id')
  async updateConversation(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { status?: string; assignee_id?: number },
  ) {
    return this.service.updateConversation(id, body);
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
    @Body() body: { custom_attributes?: Record<string, string> },
  ) {
    return this.client.updateContact(id, body);
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
}
