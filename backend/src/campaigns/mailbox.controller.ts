import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { MailboxService, type MailboxFolder } from './mailbox.service';

@Controller('campaigns/mailbox')
@UseGuards(PermissionsGuard)
export class MailboxController {
  constructor(private readonly mailbox: MailboxService) {}

  @Get()
  @RequirePermissions('campanas.ver')
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

  @Get('threads/:id')
  @RequirePermissions('campanas.ver')
  getThread(@Param('id') id: string) {
    return this.mailbox.getThread(id);
  }
}
