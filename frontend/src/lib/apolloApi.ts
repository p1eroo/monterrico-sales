import { api } from './api';

export interface ApolloPerson {
  id: string;
  name: string;
  first_name: string;
  last_name: string;
  title: string;
  email: string;
  phone: string;
  linkedin_url: string;
  organization?: {
    name: string;
    industry: string;
    location: { city: string; country: string };
  };
}

export interface ApolloSearchParams {
  query?: string;
  industry?: string;
  location?: string;
  title?: string;
  company?: string;
  emailStatus?: string;
  employeeMin?: string;
  employeeMax?: string;
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

export interface ApolloCompany {
  id: string;
  name: string;
  industry: string;
  city: string;
  country: string;
  phone: string;
  website: string;
  linkedin_url: string;
  employee_count: number | null;
  revenue: number | null;
}

export interface ApolloCompaniesResponse {
  results: ApolloCompany[];
  total: number;
  credits: number;
}

export async function apolloCompaniesSearch(params: { query?: string; page?: number }): Promise<ApolloCompaniesResponse> {
  return api('/apollo/companies/search', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function apolloEnrichPerson(personId: string): Promise<ApolloPerson> {
  return api('/apollo/people/enrich', {
    method: 'POST',
    body: JSON.stringify({ personId }),
  });
}