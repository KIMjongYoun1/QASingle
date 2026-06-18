import { api } from './client';
import type { QAData, TestCase } from '../types/qa';

export async function loadQAData(projectId: number): Promise<QAData | null> {
  const { data } = await api.get(`/api/qa/${projectId}/data`);
  return data.data;
}

export async function saveQAData(projectId: number, qaData: QAData): Promise<QAData | null> {
  const { data } = await api.post(`/api/qa/${projectId}/data`, { data: qaData });
  return data.data ?? null;
}

export async function importCasesApi(
  projectId: number,
  cases: Partial<TestCase>[],
  categoryNames: string[],
): Promise<QAData> {
  const { data } = await api.post(`/api/qa/${projectId}/import-cases`, {
    cases,
    category_names: categoryNames,
  });
  return data.data;
}

export async function reorderCasesApi(projectId: number, caseIds: string[]): Promise<QAData> {
  const { data } = await api.patch(`/api/qa/${projectId}/reorder-cases`, { case_ids: caseIds });
  return data.data;
}

export async function restoreSectionApi(
  projectId: number,
  mode: 'tst' | 'dep',
  payload: {
    cover?: Record<string, string>;
    cases: { id: string; actual: string; pf: string; owner: string; date: string; notes: string }[];
    cat_names?: Record<string, string>;
  },
): Promise<QAData> {
  const { data } = await api.post(`/api/qa/${projectId}/restore-section`, { mode, ...payload });
  return data.data;
}
