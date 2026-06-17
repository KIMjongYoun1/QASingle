import { api } from './client';
import type { KV } from '../types/qa';

export interface ParsedOpenApiCase {
  id: string;
  name: string;
  type: 'Positive' | 'Negative';
  input: string;
  expected: string;
  actual: string;
  pf: 'Pass';
  owner: string;
  date: string;
  catName: string;
  endpoint: string;
  method: string;
  expectedStatus: number;
  headers: KV[];
  queryParams: KV[];
  body: string;
}

export async function parseOpenApi(file: File) {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post('/api/openapi/parse', form);
  return data as { cases: ParsedOpenApiCase[]; categories: string[]; baseUrl: string; total: number };
}
