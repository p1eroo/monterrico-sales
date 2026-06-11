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

export interface ApolloMatchResponse {
  results: ApolloPerson[];
  total: number;
  credits: number;
}

export async function apolloMatch(emails: string[]): Promise<ApolloMatchResponse> {
  return api('/apollo/match', {
    method: 'POST',
    body: JSON.stringify({ emails }),
  });
}
