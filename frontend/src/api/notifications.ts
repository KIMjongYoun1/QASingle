const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

export interface NotificationConfig {
  id: number;
  project_id: number;
  name: string;
  type: 'discord' | 'slack';
  webhook_url: string;
  enabled: boolean;
  events: string[];
  attach_excel: boolean;
  created_at: string | null;
}

export async function listNotifications(projectId: number): Promise<NotificationConfig[]> {
  const res = await fetch(`${BASE}/api/notifications?project_id=${projectId}`);
  if (!res.ok) throw new Error('알림 설정을 불러오지 못했습니다');
  return res.json();
}

export async function createNotification(body: {
  project_id: number;
  name: string;
  type: 'discord' | 'slack';
  webhook_url: string;
  enabled?: boolean;
  events?: string[];
  attach_excel?: boolean;
}): Promise<NotificationConfig> {
  const res = await fetch(`${BASE}/api/notifications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('생성에 실패했습니다');
  return res.json();
}

export async function updateNotification(
  id: number,
  patch: Partial<Pick<NotificationConfig, 'name' | 'webhook_url' | 'enabled' | 'events' | 'attach_excel'>>
): Promise<NotificationConfig> {
  const res = await fetch(`${BASE}/api/notifications/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error('수정에 실패했습니다');
  return res.json();
}

export async function deleteNotification(id: number): Promise<void> {
  const res = await fetch(`${BASE}/api/notifications/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('삭제에 실패했습니다');
}

export async function testNotification(id: number): Promise<{ ok: boolean; message: string }> {
  const res = await fetch(`${BASE}/api/notifications/${id}/test`, { method: 'POST' });
  if (!res.ok) throw new Error('테스트 전송에 실패했습니다');
  return res.json();
}
