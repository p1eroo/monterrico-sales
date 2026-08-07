import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Put,
  Query,
  Req,
  Param,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { GmailService } from './gmail.service';
import { EmailSignatureService } from './email-signature.service';
import { Public } from '../auth/decorators/public.decorator';

type AuthedReq = {
  user: { userId: string };
  headers: { authorization?: string };
};

const signatureUploadStorage = memoryStorage();

@Controller('gmail')
export class GmailController {
  constructor(
    private readonly gmailService: GmailService,
    private readonly emailSignature: EmailSignatureService,
  ) {}

  @Get('sender-avatar')
  @Public()
  async getSenderAvatar(@Query('from') from: string, @Res() res: Response) {
    const result = from ? await this.gmailService.getSenderAvatar(from) : null;
    if (!result) {
      res.status(204).end();
      return;
    }
    res.setHeader('Content-Type', result.contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.end(result.body);
  }

  @Get('profile')
  async getProfile(@Req() req: AuthedReq) {
    return this.gmailService.getUserProfile(req.user.userId);
  }

  @Get('messages')
  async listMessages(
    @Req() req: AuthedReq,
    @Query('maxResults') maxResults?: string,
    @Query('pageToken') pageToken?: string,
    @Query('labelIds') labelIds?: string,
    @Query('q') q?: string,
  ) {
    return this.gmailService.listMessages(req.user.userId, {
      maxResults: maxResults ? parseInt(maxResults, 10) : 50,
      pageToken,
      labelIds: labelIds ? labelIds.split(',') : undefined,
      q,
    });
  }

  @Get('messages/:id')
  async getMessage(@Req() req: AuthedReq, @Param('id') id: string) {
    return this.gmailService.getMessage(req.user.userId, id);
  }

  @Get('threads/:id')
  async getThread(@Req() req: AuthedReq, @Param('id') id: string) {
    return this.gmailService.getThread(req.user.userId, id);
  }

  @Post('threads/:id/read')
  async markThreadRead(@Req() req: AuthedReq, @Param('id') id: string) {
    await this.gmailService.markThreadAsRead(req.user.userId, id);
    return { ok: true };
  }

  @Post('threads/:id/star')
  async setThreadStar(
    @Req() req: AuthedReq,
    @Param('id') id: string,
    @Body() body: { starred?: boolean },
  ) {
    if (typeof body?.starred !== 'boolean') {
      throw new BadRequestException('starred es obligatorio (boolean)');
    }
    await this.gmailService.setThreadStarred(req.user.userId, id, body.starred);
    return { ok: true };
  }

  @Post('threads/:id/archive')
  async archiveThread(@Req() req: AuthedReq, @Param('id') id: string) {
    await this.gmailService.archiveThread(req.user.userId, id);
    return { ok: true };
  }

  @Post('threads/:id/trash')
  async trashThread(@Req() req: AuthedReq, @Param('id') id: string) {
    await this.gmailService.trashThread(req.user.userId, id);
    return { ok: true };
  }

  @Post('threads/:id/unread')
  async markThreadUnread(@Req() req: AuthedReq, @Param('id') id: string) {
    await this.gmailService.markThreadAsUnread(req.user.userId, id);
    return { ok: true };
  }

  @Get('messages/:messageId/attachments/:attachmentId')
  async downloadAttachment(
    @Req() req: AuthedReq,
    @Param('messageId') messageId: string,
    @Param('attachmentId') attachmentId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { data, filename, mimeType } = await this.gmailService.downloadAttachment(
      req.user.userId,
      messageId,
      attachmentId,
    );
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      'Content-Length': data.length.toString(),
    });
    return new StreamableFile(data);
  }

  @Post('send')
  async sendMessage(
    @Req() req: AuthedReq,
    @Body()
    body: {
      to: string;
      subject: string;
      body: string;
      cc?: string;
      threadId?: string;
      inReplyTo?: string;
      attachments?: { fileName: string; mimeType?: string; contentBase64: string }[];
    },
  ) {
    await this.gmailService.sendMessage(
      req.user.userId,
      body.to,
      body.subject,
      body.body,
      body.cc,
      body.threadId,
      body.inReplyTo,
      body.attachments,
    );
    return { ok: true };
  }

  @Post('link')
  async linkEmail(
    @Req() req: AuthedReq,
    @Body() body: { to: string; subject: string },
  ) {
    return this.gmailService.linkEmail(body.to, body.subject, req.user.userId);
  }

  @Get('register-activity/preview')
  async previewRegisterEmailActivity(@Query('counterparty') counterparty?: string) {
    if (!counterparty?.trim()) {
      throw new BadRequestException('counterparty es obligatorio');
    }
    return this.gmailService.previewRegisterEmailActivity(counterparty.trim());
  }

  @Post('register-activity')
  async registerEmailAsActivity(
    @Req() req: AuthedReq,
    @Body()
    body: {
      counterparty: string;
      subject: string;
      direction?: 'inbound' | 'outbound';
      title?: string;
      description?: string;
      dueDate?: string;
      startDate?: string;
      startTime?: string;
    },
  ) {
    if (!body?.counterparty?.trim()) {
      throw new BadRequestException('counterparty es obligatorio');
    }
    if (!body?.subject?.trim()) {
      throw new BadRequestException('subject es obligatorio');
    }
    const direction = body.direction === 'outbound' ? 'outbound' : 'inbound';
    return this.gmailService.registerEmailAsActivity(
      body.counterparty,
      body.subject,
      direction,
      req.user.userId,
      {
        title: body.title,
        description: body.description,
        dueDate: body.dueDate,
        startDate: body.startDate,
        startTime: body.startTime,
      },
    );
  }

  @Get('signature')
  async getSignature(@Req() req: AuthedReq) {
    return this.emailSignature.getSignature(req.user.userId);
  }

  @Get('signature/image')
  async getSignatureImage(
    @Req() req: AuthedReq,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const opened = await this.emailSignature.openStoredImageStream(
      req.user.userId,
    );
    if (!opened) {
      throw new NotFoundException('No hay imagen de firma guardada');
    }
    res.set({
      'Content-Type': opened.mimeType,
      'Cache-Control': 'private, max-age=3600',
    });
    return new StreamableFile(opened.stream);
  }

  @Put('signature')
  async saveSignature(
    @Req() req: AuthedReq,
    @Body() body: { html?: string },
  ) {
    if (typeof body?.html !== 'string') {
      throw new BadRequestException('html es obligatorio');
    }
    return this.emailSignature.saveSignature(req.user.userId, body.html);
  }

  @Post('signature/image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: signatureUploadStorage,
      limits: { fileSize: 6 * 1024 * 1024 },
    }),
  )
  async uploadSignatureImage(
    @Req() req: AuthedReq,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Falta el archivo (campo file)');
    }
    const auth =
      typeof req.headers.authorization === 'string'
        ? req.headers.authorization
        : undefined;
    return this.emailSignature.uploadSignatureImage(
      req.user.userId,
      file.buffer,
      file.mimetype || 'image/png',
      file.originalname || 'firma.png',
      auth,
    );
  }

  @Delete('signature')
  async deleteSignature(@Req() req: AuthedReq) {
    return this.emailSignature.deleteSignature(req.user.userId);
  }
}
