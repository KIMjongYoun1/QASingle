import { useEffect, useState } from 'react';
import { Plus, Trash2, Send, Pencil, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { useQAStore } from '../store/useQAStore';
import {
  listNotifications,
  createNotification,
  updateNotification,
  deleteNotification,
  testNotification,
  type NotificationConfig,
} from '../api/notifications';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { cn } from '../lib/utils';

const EVENT_LABELS: Record<string, string> = {
  run_completed: '실행 완료',
  run_failed: '실행 오류',
};

const TYPE_META = {
  discord: { label: 'Discord', color: 'bg-[#5865f2]/10 text-[#5865f2] border-[#5865f2]/30', placeholder: 'https://discord.com/api/webhooks/...' },
  slack:   { label: 'Slack',   color: 'bg-[#4a154b]/10 text-[#e01e5a] border-[#e01e5a]/30', placeholder: 'https://hooks.slack.com/services/...' },
};

const emptyForm = {
  name: '',
  type: 'discord' as 'discord' | 'slack',
  webhook_url: '',
  events: ['run_completed', 'run_failed'] as string[],
};

export default function NotificationsPage() {
  const projectId = useQAStore((s) => s.projectId);
  const [configs, setConfigs] = useState<NotificationConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<NotificationConfig>>({});
  const [testingId, setTestingId] = useState<number | null>(null);

  const load = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      setConfigs(await listNotifications(projectId));
    } catch {
      toast.error('알림 설정을 불러오지 못했습니다');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [projectId]);

  const handleCreate = async () => {
    if (!form.name.trim()) { toast.error('이름을 입력하세요'); return; }
    if (!form.webhook_url.trim()) { toast.error('웹훅 URL을 입력하세요'); return; }
    if (!projectId) return;
    try {
      await createNotification({ project_id: projectId, ...form });
      toast.success('알림을 추가했습니다');
      setForm(emptyForm);
      setAdding(false);
      await load();
    } catch {
      toast.error('추가에 실패했습니다');
    }
  };

  const handleToggleEnabled = async (cfg: NotificationConfig) => {
    try {
      const updated = await updateNotification(cfg.id, { enabled: !cfg.enabled });
      setConfigs((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    } catch {
      toast.error('수정에 실패했습니다');
    }
  };

  const handleSaveEdit = async (id: number) => {
    try {
      const updated = await updateNotification(id, editForm);
      setConfigs((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setEditingId(null);
      toast.success('수정했습니다');
    } catch {
      toast.error('수정에 실패했습니다');
    }
  };

  const handleDelete = async (cfg: NotificationConfig) => {
    if (!confirm(`"${cfg.name}" 알림을 삭제하시겠습니까?`)) return;
    try {
      await deleteNotification(cfg.id);
      setConfigs((prev) => prev.filter((c) => c.id !== cfg.id));
      toast.success('삭제했습니다');
    } catch {
      toast.error('삭제에 실패했습니다');
    }
  };

  const handleTest = async (cfg: NotificationConfig) => {
    setTestingId(cfg.id);
    try {
      const res = await testNotification(cfg.id);
      toast.success(res.message);
    } catch {
      toast.error('테스트 전송에 실패했습니다');
    } finally {
      setTestingId(null);
    }
  };

  const toggleEvent = (events: string[], event: string) =>
    events.includes(event) ? events.filter((e) => e !== event) : [...events, event];

  if (!projectId) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        프로젝트를 선택해주세요
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">알림 설정</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">실행 완료·오류 시 Discord / Slack으로 알림을 전송합니다</p>
        </div>
        <Button size="sm" onClick={() => setAdding(true)} disabled={adding}>
          <Plus className="mr-1 size-3.5" /> 추가
        </Button>
      </div>

      {/* 추가 폼 */}
      {adding && (
        <div className="mb-4 rounded-xl border border-border bg-card p-4">
          <p className="mb-3 text-sm font-semibold">새 알림 설정</p>

          {/* 타입 선택 */}
          <div className="mb-3 flex gap-2">
            {(['discord', 'slack'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setForm({ ...form, type: t })}
                className={cn(
                  'flex-1 rounded-lg border py-2 text-sm font-medium transition-all',
                  form.type === t
                    ? TYPE_META[t].color + ' border-current'
                    : 'border-border text-muted-foreground hover:bg-secondary/60'
                )}
              >
                {TYPE_META[t].label}
              </button>
            ))}
          </div>

          <div className="mb-2">
            <label className="mb-1 block text-[11px] text-muted-foreground">이름</label>
            <Input
              placeholder="예: 개발팀 Discord 채널"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="h-8 text-sm"
            />
          </div>

          <div className="mb-3">
            <label className="mb-1 block text-[11px] text-muted-foreground">웹훅 URL</label>
            <Input
              placeholder={TYPE_META[form.type].placeholder}
              value={form.webhook_url}
              onChange={(e) => setForm({ ...form, webhook_url: e.target.value })}
              className="h-8 font-mono text-xs"
            />
          </div>

          <div className="mb-4">
            <label className="mb-1.5 block text-[11px] text-muted-foreground">구독 이벤트</label>
            <div className="flex gap-2">
              {Object.entries(EVENT_LABELS).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setForm({ ...form, events: toggleEvent(form.events, key) })}
                  className={cn(
                    'rounded-lg border px-3 py-1.5 text-xs font-medium transition-all',
                    form.events.includes(key)
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:bg-secondary/60'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleCreate} className="flex-1">추가</Button>
            <Button variant="outline" onClick={() => { setAdding(false); setForm(emptyForm); }}>취소</Button>
          </div>
        </div>
      )}

      {/* 설정 목록 */}
      {loading ? (
        <p className="text-center text-sm text-muted-foreground">불러오는 중...</p>
      ) : configs.length === 0 && !adding ? (
        <div className="rounded-xl border border-dashed border-border py-12 text-center">
          <p className="text-sm text-muted-foreground">등록된 알림 설정이 없습니다</p>
          <p className="mt-1 text-xs text-muted-foreground">위의 추가 버튼으로 Discord 또는 Slack 웹훅을 등록하세요</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {configs.map((cfg) => {
            const meta = TYPE_META[cfg.type] ?? TYPE_META.discord;
            const isEditing = editingId === cfg.id;

            return (
              <div
                key={cfg.id}
                className={cn(
                  'rounded-xl border bg-card p-4 transition-all',
                  cfg.enabled ? 'border-border' : 'border-border opacity-60'
                )}
              >
                {isEditing ? (
                  /* 인라인 수정 폼 */
                  <div>
                    <div className="mb-2">
                      <label className="mb-1 block text-[11px] text-muted-foreground">이름</label>
                      <Input
                        value={editForm.name ?? cfg.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="mb-3">
                      <label className="mb-1 block text-[11px] text-muted-foreground">웹훅 URL</label>
                      <Input
                        value={editForm.webhook_url ?? cfg.webhook_url}
                        onChange={(e) => setEditForm({ ...editForm, webhook_url: e.target.value })}
                        className="h-8 font-mono text-xs"
                      />
                    </div>
                    <div className="mb-3">
                      <label className="mb-1.5 block text-[11px] text-muted-foreground">구독 이벤트</label>
                      <div className="flex gap-2">
                        {Object.entries(EVENT_LABELS).map(([key, label]) => {
                          const events = editForm.events ?? cfg.events;
                          return (
                            <button
                              key={key}
                              onClick={() => setEditForm({ ...editForm, events: toggleEvent(events, key) })}
                              className={cn(
                                'rounded-lg border px-3 py-1.5 text-xs font-medium transition-all',
                                events.includes(key)
                                  ? 'border-primary bg-primary/10 text-primary'
                                  : 'border-border text-muted-foreground hover:bg-secondary/60'
                              )}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleSaveEdit(cfg.id)}><Check className="mr-1 size-3.5" /> 저장</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}><X className="mr-1 size-3.5" /> 취소</Button>
                    </div>
                  </div>
                ) : (
                  /* 일반 뷰 */
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className={cn('text-[10px] shrink-0', meta.color)}>{meta.label}</Badge>
                        <span className="font-medium text-sm truncate">{cfg.name}</span>
                        {!cfg.enabled && <span className="text-[11px] text-muted-foreground">(비활성)</span>}
                      </div>
                      <p className="font-mono text-[11px] text-muted-foreground truncate mb-2">{cfg.webhook_url}</p>
                      <div className="flex gap-1.5 flex-wrap">
                        {cfg.events.map((e) => (
                          <span key={e} className="rounded-md bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
                            {EVENT_LABELS[e] ?? e}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* 액션 버튼들 */}
                    <div className="flex shrink-0 flex-col gap-1.5">
                      {/* 활성화 토글 */}
                      <button
                        onClick={() => handleToggleEnabled(cfg)}
                        className={cn(
                          'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
                          cfg.enabled ? 'bg-primary' : 'bg-muted'
                        )}
                        title={cfg.enabled ? '비활성화' : '활성화'}
                      >
                        <span className={cn(
                          'pointer-events-none inline-block size-4 rounded-full bg-white shadow transition-transform',
                          cfg.enabled ? 'translate-x-4' : 'translate-x-0'
                        )} />
                      </button>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleTest(cfg)}
                          disabled={testingId === cfg.id || !cfg.enabled}
                          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-40"
                          title="테스트 전송"
                        >
                          <Send className="size-3.5" />
                        </button>
                        <button
                          onClick={() => { setEditingId(cfg.id); setEditForm({}); }}
                          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                          title="수정"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(cfg)}
                          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                          title="삭제"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
