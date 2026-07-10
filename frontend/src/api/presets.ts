const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

export type PresetKind = 'header' | 'url' | 'param' | 'path' | 'body' | 'assertion_path';

export interface ProjectPreset {
  id: number;
  project_id: number;
  kind: PresetKind;
  label: string;
  key: string | null;
  value: string;
  category_id: string | null;
  created_at: string | null;
}

export async function listPresets(projectId: number): Promise<ProjectPreset[]> {
  const res = await fetch(`${BASE}/api/presets?project_id=${projectId}`);
  if (!res.ok) throw new Error('저장된 값을 불러오지 못했습니다');
  return res.json();
}

export async function createPreset(body: {
  project_id: number;
  kind: PresetKind;
  label: string;
  key?: string;
  value: string;
  category_id?: string | null;
}): Promise<ProjectPreset> {
  const res = await fetch(`${BASE}/api/presets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('저장에 실패했습니다');
  return res.json();
}

export async function updatePreset(
  id: number,
  patch: Partial<Pick<ProjectPreset, 'label' | 'key' | 'value' | 'category_id'>>
): Promise<ProjectPreset> {
  const res = await fetch(`${BASE}/api/presets/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error('수정에 실패했습니다');
  return res.json();
}

export async function deletePreset(id: number): Promise<void> {
  const res = await fetch(`${BASE}/api/presets/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('삭제에 실패했습니다');
}
