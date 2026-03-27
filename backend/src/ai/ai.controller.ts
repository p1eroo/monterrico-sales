import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequireAnyPermission } from '../auth/decorators/require-any-permission.decorator';
import { AiService } from './ai.service';
import { AssistantInstructionsService } from './assistant-instructions.service';
import { ChatDto } from './dto/chat.dto';
import { UpdateAssistantInstructionsDto } from './dto/update-assistant-instructions.dto';

type AuthedReq = {
  user: {
    userId: string;
    username: string;
    name: string;
    role: string;
    roleId?: string;
  };
};

@Controller('api/ai')
@UseGuards(ThrottlerGuard)
@Throttle({ default: { limit: 30, ttl: 60_000 } })
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly assistantInstructions: AssistantInstructionsService,
  ) {}

  /** Lista de hilos del usuario (barra lateral). */
  @Get('conversations')
  listConversations(@Req() req: AuthedReq) {
    return this.aiService.listConversationsForUser(req.user.userId);
  }

  /** Crea un hilo vacío (“Nuevo chat”). */
  @Post('conversations')
  createConversation(@Req() req: AuthedReq) {
    return this.aiService.createConversationForUser(req.user.userId);
  }

  /** Mensajes de un hilo concreto. */
  @Get('conversations/:id')
  getConversationById(
    @Param('id') id: string,
    @Req() req: AuthedReq,
  ) {
    return this.aiService.getConversationByIdForUser(req.user.userId, id);
  }

  @Delete('conversations/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteConversationById(
    @Param('id') id: string,
    @Req() req: AuthedReq,
  ) {
    return this.aiService.deleteConversationByIdForUser(req.user.userId, id);
  }

  /** Compat: hilo más reciente (clientes antiguos). */
  @Get('conversation')
  async getConversation(@Req() req: AuthedReq) {
    return this.aiService.getConversationForUser(req.user.userId);
  }

  /** Compat: borra solo el hilo más reciente. */
  @Delete('conversation')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteConversation(@Req() req: AuthedReq) {
    await this.aiService.deleteConversationForUser(req.user.userId);
  }

  /** Instrucciones editables del copiloto (lectura). */
  @Get('assistant-instructions')
  @UseGuards(PermissionsGuard)
  @RequireAnyPermission(
    'dashboard.ver',
    'configuracion.ver',
    'agentes_ia.ver',
    'agentes_ia.editar',
  )
  getAssistantInstructions() {
    return this.assistantInstructions.getForApi();
  }

  @Patch('assistant-instructions')
  @UseGuards(PermissionsGuard)
  @RequireAnyPermission('configuracion.editar', 'agentes_ia.editar')
  patchAssistantInstructions(
    @Body() body: UpdateAssistantInstructionsDto,
    @Req() req: AuthedReq,
  ) {
    return this.assistantInstructions.update(body ?? {}, req.user.userId);
  }

  @Post('chat')
  async chat(@Body() body: ChatDto, @Req() req: AuthedReq) {
    const { message, context, history } = body;
    if (!message || typeof message !== 'string') {
      return {
        message: 'Envía un mensaje de texto válido.',
        links: [],
        actions: [],
      };
    }
    const trimmed = message.trim();
    if (trimmed.length > 16_000) {
      throw new BadRequestException('El mensaje es demasiado largo.');
    }
    return this.aiService.chat(
      trimmed,
      context,
      req.user,
      history,
      body.conversationId,
    );
  }

  /**
   * Respuesta en vivo (SSE). Sin tools: markdown breve. Eventos: `delta`, luego `done` o `error`.
   */
  @Post('chat/stream')
  async chatStream(
    @Body() body: ChatDto,
    @Req() req: AuthedReq,
    @Res() res: Response,
  ): Promise<void> {
    const { message, context, history } = body;
    if (!message || typeof message !== 'string') {
      res.status(400).json({
        message: 'Envía un mensaje de texto válido.',
      });
      return;
    }
    const trimmed = message.trim();
    if (trimmed.length > 16_000) {
      res.status(400).json({ message: 'El mensaje es demasiado largo.' });
      return;
    }
    await this.aiService.streamChat(
      trimmed,
      context,
      req.user,
      history,
      body.conversationId,
      res,
    );
  }
}
