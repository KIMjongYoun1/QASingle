import { api } from './client';

export type AnalysisMode = 'testcase' | 'deploy' | 'business';
export type LLMProvider = 'local' | 'claude';

export async function analyze(projectId: number, mode: AnalysisMode, question?: string, provider?: LLMProvider) {
  const { data } = await api.post('/api/analysis/analyze', { project_id: projectId, mode, question, provider });
  return data as { result: string; mode: AnalysisMode; provider: LLMProvider };
}

export interface DeployHistoryItem {
  id: number;
  version: string;
  environment: string;
  deploy_type: string;
  deployer: string;
  target_server: string;
  summary: string;
  total_cases: number;
  done_cases: number;
  fail_cases: number;
  deployed_at: string | null;
  created_at: string | null;
}

export async function getDeployHistory(projectId: number) {
  const { data } = await api.get(`/api/analysis/deploy-history/${projectId}`);
  return data as DeployHistoryItem[];
}
