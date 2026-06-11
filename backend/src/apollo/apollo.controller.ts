import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { ApolloService } from './apollo.service';

@Controller('apollo')
@UseGuards(PermissionsGuard)
export class ApolloController {
  constructor(private readonly apollo: ApolloService) {}

  @Post('match')
  @RequirePermissions('contactos.ver')
  async match(@Body() body: { emails: string[] }) {
    return this.apollo.matchPeople({ emails: body.emails || [] });
  }
}
