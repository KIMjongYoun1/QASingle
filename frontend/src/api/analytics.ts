import axios from 'axios';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

export interface CaseStat {
  case_id: string;
  total: number;
  pass: number;
  fail: number;
  pass_rate: number;
}

export interface TrendPoint {
  run_id: number;
  label: string | null;
  total: number;
  pass: number;
  fail: number;
  pass_rate: number;
  started_at: string | null;
}

export interface DateRange {
  start?: string;   // YYYY-MM-DD
  end?: string;
}

export interface ProjectAnalytics {
  total_runs: number;
  overall_pass_rate: number;
  case_stats: CaseStat[];
  trend: TrendPoint[];
  last_run_at: string | null;
}

export interface CaseHistoryEntry {
  id: number;
  case_id: string;
  action: 'created' | 'updated' | 'deleted';
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  changed_at: string;
}

export async function getAnalytics(projectId: number, range?: DateRange): Promise<ProjectAnalytics> {
  const params: Record<string, string> = {};
  if (range?.start) params.start_date = range.start;
  if (range?.end) params.end_date = range.end;
  const { data } = await axios.get(`${BASE}/api/analytics/${projectId}`, { params });
  return data;
}

export async function getCaseHistory(projectId: number, caseId?: string): Promise<CaseHistoryEntry[]> {
  const params = caseId ? { case_id: caseId } : {};
  const { data } = await axios.get(`${BASE}/api/qa/${projectId}/case-history`, { params });
  return data;
}
