import { Controller, Delete, Get, Param, Patch, Query, Req } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

type AuthedReq = { user: { userId: string } };

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  async list(@Req() req: AuthedReq, @Query('limit') limitRaw?: string) {
    const n = limitRaw ? parseInt(limitRaw, 10) : 100;
    const limit = Number.isFinite(n) ? n : 100;
    return this.notifications.listForUser(req.user.userId, limit);
  }

  @Patch('read-all')
  async markAllRead(@Req() req: AuthedReq) {
    return this.notifications.markAllRead(req.user.userId);
  }

  @Patch(':id/read')
  async markRead(@Req() req: AuthedReq, @Param('id') id: string) {
    return this.notifications.markRead(req.user.userId, id);
  }

  @Delete(':id')
  async remove(@Req() req: AuthedReq, @Param('id') id: string) {
    await this.notifications.remove(req.user.userId, id);
    return { ok: true };
  }
}
