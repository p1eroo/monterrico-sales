import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { InboundEmailService } from './inbound-email.service';

@Controller('campaigns/inbound')
@UseGuards(PermissionsGuard)
export class InboundEmailController {
  constructor(private readonly inbound: InboundEmailService) {}

  @Get()
  @RequirePermissions('campanas.ver')
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    const p = page ? Number.parseInt(page, 10) : 1;
    const l = limit ? Number.parseInt(limit, 10) : 50;
    return this.inbound.findPage(
      Number.isFinite(p) && p > 0 ? p : 1,
      Number.isFinite(l) && l > 0 ? l : 50,
      search,
    );
  }

  @Get(':id')
  @RequirePermissions('campanas.ver')
  findOne(@Param('id') id: string) {
    return this.inbound.findOne(id);
  }
}
