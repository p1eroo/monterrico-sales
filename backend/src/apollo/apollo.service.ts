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
