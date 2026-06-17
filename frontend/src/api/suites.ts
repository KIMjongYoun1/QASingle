import axios from 'axios';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

export interface TestSuite {
  id: number;
  project_id: number;
  name: string;
  description: string | null;
  case_ids: string[];
  flow_ids: number[];
  is_default: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface SuiteCreate {
  project_id: number;
  name: string;
  description?: string;
  case_ids?: string[];
  flow_ids?: number[];
  is_default?: boolean;
}

export interface SuiteUpdate {
  name?: string;
  description?: string;
  case_ids?: string[];
  flow_ids?: number[];
  is_default?: boolean;
}

export async function listSuites(projectId: number): Promise<TestSuite[]> {
  const { data } = await axios.get(`${BASE}/api/suites`, { params: { project_id: projectId } });
  return data;
}

export async function createSuite(body: SuiteCreate): Promise<TestSuite> {
  const { data } = await axios.post(`${BASE}/api/suites`, body);
  return data;
}

export async function updateSuite(suiteId: number, body: SuiteUpdate): Promise<TestSuite> {
  const { data } = await axios.patch(`${BASE}/api/suites/${suiteId}`, body);
  return data;
}

export async function deleteSuite(suiteId: number): Promise<void> {
  await axios.delete(`${BASE}/api/suites/${suiteId}`);
}

export async function setDefaultSuite(suiteId: number): Promise<TestSuite> {
  const { data } = await axios.post(`${BASE}/api/suites/${suiteId}/set-default`);
  return data;
}
