import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { MailboxService, type MailboxFolder } from './mailbox.service';
import { ReplyMailboxThreadDto } from './dto/reply-mailbox-thread.dto';

@Controller('campaigns/mailbox')
@UseGuards(PermissionsGuard)
export class MailboxController {
  constructor(private readonly mailbox: MailboxService) {}

  @Get()
  list(
    @Query('folder') folder?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    const f: MailboxFolder = folder === 'sent' ? 'sent' : 'inbox';
    const p = page ? Number.parseInt(page, 10) : 1;
    const l = limit ? Number.parseInt(limit, 10) : 40;
    return this.mailbox.listThreads({
      folder: f,
      page: Number.isFinite(p) && p > 0 ? p : 1,
      limit: Number.isFinite(l) && l > 0 ? l : 40,
      search,
    });
  }

  @Get('messages/:messageId/attachments/:attachmentId')
  async downloadAttachment(
    @Param('messageId') messageId: string,
    @Param('attachmentId') attachmentId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { data, filename, mimeType } = await this.mailbox.downloadAttachment(
      messageId,
      attachmentId,
    );
    const safeName = filename.replace(/[\r\n"]/g, '_').slice(0, 180) || 'adjunto';
    res.set({
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(safeName)}"`,
      'Content-Length': data.length.toString(),
    });
    return new StreamableFile(data);
  }

  @Get('threads/:id')
  getThread(@Param('id') id: string) {
    return this.mailbox.getThread(id);
  }

  @Post('threads/:id/reply')
  reply(@Param('id') id: string, @Body() body: ReplyMailboxThreadDto) {
    return this.mailbox.replyToThread(id, body.htmlBody ?? '');
  }
}
