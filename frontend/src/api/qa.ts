import { api } from './client';
import type { QAData } from '../types/qa';

export async function loadQAData(projectId: number): Promise<QAData | null> {
  const { data } = await api.get(`/api/qa/${projectId}/data`);
  return data.data;
}

export async function saveQAData(projectId: number, qaData: QAData): Promise<void> {
  await api.post(`/api/qa/${projectId}/data`, { data: qaData });
}
