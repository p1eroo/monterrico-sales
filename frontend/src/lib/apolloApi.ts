import { api } from './api';

export interface ApolloPerson {
  id: string;
  name: string;
  title: string;
  email: string;
  phone: string;
  organization?: {
    name: string;
    industry: string;
    location: { city: string; country: string };
  };
  linkedin_url: string;
}

export interface ApolloSearchParams {
  query?: string;
  industry?: string;
  location?: string;
  page?: number;
}

export interface ApolloSearchResponse {
  results: ApolloPerson[];
  total: number;
  credits: number;
}

export async function apolloSearch(params: ApolloSearchParams): Promise<ApolloSearchResponse> {
  return api('/apollo/search', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function apolloMatch(emails: string[]): Promise<ApolloSearchResponse> {
  return api('/apollo/match', {
    method: 'POST',
    body: JSON.stringify({ emails }),
  });
}
