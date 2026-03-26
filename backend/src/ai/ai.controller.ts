import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AiService } from './ai.service';
import { ChatDto } from './dto/chat.dto';

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
  constructor(private readonly aiService: AiService) {}

  /** Historial persistido (PostgreSQL) para hidratar el cliente. */
  @Get('conversation')
  async getConversation(@Req() req: AuthedReq) {
    return this.aiService.getConversationForUser(req.user.userId);
  }

  @Delete('conversation')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteConversation(@Req() req: AuthedReq) {
    await this.aiService.deleteConversationForUser(req.user.userId);
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
    return this.aiService.chat(trimmed, context, req.user, history);
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
    await this.aiService.streamChat(trimmed, context, req.user, history, res);
  }
}
