import { api } from './client';

export interface FlowStepResult {
  case_id: string;
  pf: 'Pass' | 'Fail' | 'N/A';
  skipped: boolean;
}

export interface FlowRunResult {
  flow_id: number;
  flow_name: string;
  status: 'running' | 'done' | 'stopped';
  steps: FlowStepResult[];
}

export interface CaseResult {
  case_id: string;
  pf: 'Pass' | 'Fail' | null;
  actual: string;
  notes: string;
}

export interface MgrSnapshot {
  id: string;
  name: string;
  endpoint: string;
  method: string;
  catId: string;
}

export interface RunStatus {
  id: number;
  status: 'pending' | 'running' | 'done' | 'failed';
  total: number;
  done: number;
  fail: number;
  error: string | null;
  base_url: string;
  label?: string;
  case_ids?: string[];
  flow_ids?: number[];
  case_results?: CaseResult[];
  flow_results: FlowRunResult[];
  mgr_snapshot?: MgrSnapshot[];
  started_at?: string;
  finished_at?: string;
}

export interface RunSummary {
  id: number;
  status: string;
  label: string | null;
  base_url: string;
  total: number;
  done: number;
  fail: number;
  case_ids: string[];
  flow_ids: number[];
  started_at: string | null;
  finished_at: string | null;
}

export interface RunComment {
  id: number;
  text: string;
  created_at: string;
}

export async function createRun(projectId: number, baseUrl: string, caseIds: string[], authHeader?: string, flowIds?: number[]) {
  const { data } = await api.post('/api/runs', {
    project_id: projectId,
    base_url: baseUrl,
    auth_header: authHeader || undefined,
    case_ids: caseIds,
    flow_ids: flowIds || [],
  });
  return data as { run_id: number; total: number; flow_count: number };
}

export async function getRun(runId: number) {
  const { data } = await api.get(`/api/runs/${runId}`);
  return data as RunStatus;
}

export async function listRuns(projectId: number) {
  const { data } = await api.get(`/api/runs?project_id=${projectId}`);
  return data as RunSummary[];
}

export async function updateRunLabel(runId: number, label: string) {
  const { data } = await api.patch(`/api/runs/${runId}/label`, { label });
  return data as { id: number; label: string };
}

export async function listComments(runId: number) {
  const { data } = await api.get(`/api/runs/${runId}/comments`);
  return data as RunComment[];
}

export async function addComment(runId: number, text: string) {
  const { data } = await api.post(`/api/runs/${runId}/comments`, { text });
  return data as RunComment;
}
