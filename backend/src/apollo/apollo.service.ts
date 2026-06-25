import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ApolloService {
  private readonly logger = new Logger(ApolloService.name);
  private readonly baseUrl = 'https://api.apollo.io/api/v1';

  constructor(private readonly config: ConfigService) {}

  private getApiKey(): string {
    const key = this.config.get<string>('APOLLO_API_KEY')?.trim();
    if (!key) throw new ServiceUnavailableException('Apollo.io no configurado: falta APOLLO_API_KEY');
    return key;
  }

  async searchPeople(params: {
    query?: string;
    industry?: string;
    location?: string;
    title?: string;
    company?: string;
    emailStatus?: string;
    employeeMin?: string;
    employeeMax?: string;
    page?: number;
    perPage?: number;
  }) {
    const apiKey = this.getApiKey();
    const body: Record<string, unknown> = {
      page: params.page || 1,
      per_page: params.perPage || 25,
    };
    if (params.query?.trim()) body.q_keywords = params.query.trim();
    if (params.industry?.trim()) body.industry = params.industry.trim();
    if (params.location?.trim()) body.q_organization_location = params.location.trim();
    if (params.title?.trim()) body.titles = params.title.split(',').map((t) => t.trim()).filter(Boolean);
    if (params.company?.trim()) body.q_organization_name = params.company.trim();
    if (params.emailStatus?.trim()) body.email_status = [params.emailStatus.trim()];
    if (params.employeeMin) body.organization_num_employees_ranges = { min: parseInt(params.employeeMin, 10) };
    if (params.employeeMax) {
      const range = (body.organization_num_employees_ranges as Record<string, unknown>) || {};
      range.max = parseInt(params.employeeMax, 10);
      body.organization_num_employees_ranges = range;
    }

    this.logger.log(`Apollo search: query="${params.query}" page=${body.page}`);

    const res = await fetch(`${this.baseUrl}/mixed_people/api_search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`Apollo error ${res.status}: ${text.slice(0, 500)}`);
      throw new ServiceUnavailableException(`Apollo.io respondió ${res.status}`);
    }

    const data = await res.json();
    const results = (data.people || []).map((p: Record<string, unknown>) => ({
      id: p.id,
      name: [p.first_name, p.last_name || p.last_name_obfuscated].filter(Boolean).join(' ') || '',
      first_name: p.first_name,
      last_name: p.last_name || p.last_name_obfuscated || '',
      title: p.title || '',
      email: p.email || '',
      phone: p.direct_phone || p.phone || '',
      linkedin_url: p.linkedin_url || '',
      organization: p.organization
        ? {
            name: (p.organization as Record<string, unknown>).name || '',
            industry: (p.organization as Record<string, unknown>).industry || '',
            location: {
              city: (p.organization as Record<string, unknown>).city || '',
              country: (p.organization as Record<string, unknown>).country || '',
            },
          }
        : undefined,
    }));
    return {
      results,
      total: data.total_entries ?? data.pagination?.totalEntries ?? 0,
      credits: data.pagination?.totalCredits ?? 0,
    };
  }

  async searchCompanies(params: {
    query?: string;
    page?: number;
  }) {
    const apiKey = this.getApiKey();
    const body: Record<string, unknown> = {
      page: params.page || 1,
      per_page: 25,
    };
    if (params.query?.trim()) body.q_organization_name = params.query.trim();

    const res = await fetch(`${this.baseUrl}/organizations/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`Apollo companies error ${res.status}: ${text.slice(0, 500)}`);
      throw new ServiceUnavailableException(`Apollo.io respondió ${res.status}`);
    }

    const data = await res.json();
    const results = (data.organizations || []).map((org: Record<string, unknown>) => ({
      id: org.id,
      name: org.name || '',
      industry: org.industry || '',
      city: org.city || '',
      country: org.country || '',
      phone: org.phone || '',
      website: org.website || '',
      linkedin_url: org.linkedin_url || '',
      employee_count: org.employee_count ?? null,
      revenue: org.revenue ?? null,
    }));
    return {
      results,
      total: data.total_entries ?? 0,
      credits: data.pagination?.totalCredits ?? 0,
    };
  }

  async matchPeople(params: {
    emails: string[];
  }) {
    const apiKey = this.getApiKey();
    const body: Record<string, unknown> = {};

    if (params.emails.length === 1) {
      body.email = params.emails[0].trim();
    } else if (params.emails.length > 1) {
      body.emails = params.emails;
    }

    this.logger.log(`Apollo match: ${body.email || 'multiple'}`);

    const res = await fetch(`${this.baseUrl}/people/match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`Apollo error ${res.status}: ${text.slice(0, 500)}`);
      throw new ServiceUnavailableException(`Apollo.io respondió ${res.status}`);
    }

    const data = await res.json();
    const people: unknown[] = [];
    if (data.person) people.push(data.person);
    if (data.people) people.push(...data.people);

    return {
      results: people,
      total: people.length,
      credits: data.credits ?? 0,
    };
  }

  async enrichPerson(personId: string) {
    const apiKey = this.getApiKey();
    const res = await fetch(`${this.baseUrl}/people/match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
      body: JSON.stringify({ id: personId }),
    });

    if (!res.ok) {
      const text = await res.text();
      this.logger.error(`Apollo enrich error ${res.status}: ${text.slice(0, 500)}`);
      throw new ServiceUnavailableException(`Apollo.io respondió ${res.status}`);
    }

    const data = await res.json();
    const p = data.person || data.people?.[0] || null;
    if (!p) return { error: 'Persona no encontrada' };

    return {
      id: p.id,
      name: [p.first_name, p.last_name].filter(Boolean).join(' ') || '',
      first_name: p.first_name || '',
      last_name: p.last_name || '',
      title: p.title || '',
      email: p.email || '',
      phone: p.direct_phone || p.phone || (p.contact as Record<string, unknown>)?.sanitized_phone as string || (Array.isArray((p.contact as Record<string, unknown>)?.phone_numbers) ? ((p.contact as Record<string, unknown>).phone_numbers as Array<Record<string, unknown>>)[0]?.sanitized_number as string : '') || '',
      linkedin_url: p.linkedin_url || '',
      organization: p.organization
        ? {
            name: p.organization.name || '',
            industry: p.organization.industry || '',
            location: {
              city: p.organization.city || '',
              country: p.organization.country || '',
            },
          }
        : undefined,
    };
  }
}
