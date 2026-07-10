const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

export interface EncryptionConfig {
  id: number;
  project_id: number;
  label: string;
  mode: 'GCM' | 'CBC';
  key_base64: string;
  created_at: string | null;
}

export async function listEncryptionConfigs(projectId: number): Promise<EncryptionConfig[]> {
  const res = await fetch(`${BASE}/api/encryption-configs?project_id=${projectId}`);
  if (!res.ok) throw new Error('암호화 설정을 불러오지 못했습니다');
  return res.json();
}

export async function createEncryptionConfig(body: {
  project_id: number;
  label: string;
  mode: 'GCM' | 'CBC';
  key_base64: string;
}): Promise<EncryptionConfig> {
  const res = await fetch(`${BASE}/api/encryption-configs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('저장에 실패했습니다');
  return res.json();
}

export async function updateEncryptionConfig(
  id: number,
  patch: Partial<Pick<EncryptionConfig, 'label' | 'mode' | 'key_base64'>>
): Promise<EncryptionConfig> {
  const res = await fetch(`${BASE}/api/encryption-configs/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error('수정에 실패했습니다');
  return res.json();
}

export async function deleteEncryptionConfig(id: number): Promise<void> {
  const res = await fetch(`${BASE}/api/encryption-configs/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('삭제에 실패했습니다');
}
