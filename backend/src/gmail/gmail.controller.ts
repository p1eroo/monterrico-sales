import { Controller, Get, Post, Query, Body, Req, Param, Res, StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { GmailService } from './gmail.service';

type AuthedReq = { user: { userId: string } };

@Controller('gmail')
export class GmailController {
  constructor(private readonly gmailService: GmailService) {}

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
    @Body() body: { to: string; subject: string; body: string; cc?: string },
  ) {
    await this.gmailService.sendMessage(req.user.userId, body.to, body.subject, body.body, body.cc);
    return { ok: true };
  }

  @Post('link')
  async linkEmail(
    @Req() req: AuthedReq,
    @Body() body: { to: string; subject: string },
  ) {
    return this.gmailService.linkEmail(body.to, body.subject, req.user.userId);
  }
}
