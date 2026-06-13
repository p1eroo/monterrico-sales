import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { ApolloService } from './apollo.service';

@Controller('apollo')
@UseGuards(PermissionsGuard)
export class ApolloController {
  constructor(private readonly apollo: ApolloService) {}

  @Post('search')
  @RequirePermissions('contactos.ver')
  async search(@Body() body: { query?: string; industry?: string; location?: string; page?: number }) {
    return this.apollo.searchPeople({
      query: body.query,
      industry: body.industry,
      location: body.location,
      page: body.page,
    });
  }

  @Post('match')
  @RequirePermissions('contactos.ver')
  async match(@Body() body: { emails: string[] }) {
    return this.apollo.matchPeople({ emails: body.emails || [] });
  }
}
