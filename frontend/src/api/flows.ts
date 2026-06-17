import { api } from './client';
import type { TestFlow, FlowStep } from '../types/qa';

export async function listFlows(projectId: number): Promise<TestFlow[]> {
  const { data } = await api.get('/api/flows', { params: { project_id: projectId } });
  return data;
}

export async function createFlow(projectId: number, name: string, steps: FlowStep[]): Promise<TestFlow> {
  const { data } = await api.post('/api/flows', { project_id: projectId, name, steps });
  return data;
}

export async function updateFlow(flowId: number, name: string, steps: FlowStep[]): Promise<TestFlow> {
  const { data } = await api.put(`/api/flows/${flowId}`, { name, steps });
  return data;
}

export async function deleteFlow(flowId: number): Promise<void> {
  await api.delete(`/api/flows/${flowId}`);
}
