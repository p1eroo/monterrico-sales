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

    this.logger.log(`Apollo search: query="${params.query}" page=${body.page}`);

    const res = await fetch(`${this.baseUrl}/mixed_people/search`, {
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
    return {
      results: data.people || [],
      total: data.pagination?.totalEntries ?? 0,
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
}
