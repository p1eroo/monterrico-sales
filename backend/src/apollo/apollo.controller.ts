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
  async search(@Body() body: {
    query?: string; industry?: string; location?: string;
    title?: string; company?: string; emailStatus?: string;
    employeeMin?: string; employeeMax?: string;
    page?: number;
  }) {
    return this.apollo.searchPeople({
      query: body.query, industry: body.industry, location: body.location,
      title: body.title, company: body.company, emailStatus: body.emailStatus,
      employeeMin: body.employeeMin, employeeMax: body.employeeMax,
      page: body.page,
    });
  }

  @Post('companies/search')
  @RequirePermissions('contactos.ver')
  async searchCompanies(@Body() body: { query?: string; page?: number }) {
    return this.apollo.searchCompanies({ query: body.query, page: body.page });
  }

  @Post('organizations/enrich')
  @RequirePermissions('contactos.ver')
  async enrichOrganization(@Body() body: { domain: string }) {
    return this.apollo.enrichOrganization(body.domain);
  }

  @Post('match')
  @RequirePermissions('contactos.ver')
  async match(@Body() body: { emails: string[] }) {
    return this.apollo.matchPeople({ emails: body.emails || [] });
  }

  @Post('people/enrich')
  @RequirePermissions('contactos.ver')
  async enrich(@Body() body: { personId: string }) {
    return this.apollo.enrichPerson(body.personId);
  }
}
