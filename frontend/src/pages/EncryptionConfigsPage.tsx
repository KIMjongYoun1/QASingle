import { useEffect, useState } from 'react';
import { Plus, Trash2, Pencil, Check, X, Shuffle } from 'lucide-react';
import { toast } from 'sonner';
import { useQAStore } from '../store/useQAStore';
import {
  listEncryptionConfigs,
  createEncryptionConfig,
  updateEncryptionConfig,
  deleteEncryptionConfig,
  type EncryptionConfig,
} from '../api/encryptionConfigs';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';

const emptyForm = { label: '', mode: 'GCM' as 'GCM' | 'CBC', key_base64: '' };

/** AES-256용 32바이트 랜덤 키를 만들어 Base64로 반환 (브라우저 Web Crypto 사용) */
function generateKeyBase64(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = '';
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary);
}

export default function EncryptionConfigsPage() {
  const projectId = useQAStore((s) => s.projectId);
  const [configs, setConfigs] = useState<EncryptionConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<EncryptionConfig>>({});

  const load = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      setConfigs(await listEncryptionConfigs(projectId));
    } catch {
      toast.error('암호화 설정을 불러오지 못했습니다');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [projectId]);

  const handleCreate = async () => {
    if (!form.label.trim()) { toast.error('이름을 입력하세요'); return; }
    if (!form.key_base64.trim()) { toast.error('키를 입력하거나 생성하세요'); return; }
    if (!projectId) return;
    try {
      await createEncryptionConfig({ project_id: projectId, ...form });
      toast.success('암호화 설정을 추가했습니다');
      setForm(emptyForm);
      setAdding(false);
      await load();
    } catch {
      toast.error('추가에 실패했습니다');
    }
  };

  const handleSaveEdit = async (id: number) => {
    try {
      const updated = await updateEncryptionConfig(id, editForm);
      setConfigs((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setEditingId(null);
      toast.success('수정했습니다');
    } catch {
      toast.error('수정에 실패했습니다');
    }
  };

  const handleDelete = async (c: EncryptionConfig) => {
    if (!confirm(`"${c.label}"를 삭제하시겠습니까? 이 키를 참조하던 케이스는 복호화가 안 될 수 있습니다.`)) return;
    try {
      await deleteEncryptionConfig(c.id);
      setConfigs((prev) => prev.filter((x) => x.id !== c.id));
      toast.success('삭제했습니다');
    } catch {
      toast.error('삭제에 실패했습니다');
    }
  };

  if (!projectId) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        프로젝트를 선택해주세요
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">암호화 설정</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            케이스에서 "암호화 호출"을 켤 때 사용할 AES 키/모드를 등록합니다. 저장된 값(프리셋)과는
            별도로 관리됩니다 — 나중에 접근 권한을 따로 제한할 수 있도록 분리했습니다.
          </p>
        </div>
        <Button size="sm" onClick={() => setAdding(true)} disabled={adding}>
          <Plus className="mr-1 size-3.5" /> 추가
        </Button>
      </div>

      {adding && (
        <div className="mb-4 max-w-xl rounded-xl border border-border bg-card p-4">
          <p className="mb-3 text-sm font-semibold">새 암호화 설정</p>

          <div className="mb-2">
            <label className="mb-1 block text-[11px] text-muted-foreground">이름 (식별용)</label>
            <Input
              placeholder="예: 결제 암호화 키"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              className="h-8 text-sm"
            />
          </div>

          <div className="mb-2">
            <label className="mb-1 block text-[11px] text-muted-foreground">모드</label>
            <div className="flex gap-2">
              {(['GCM', 'CBC'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setForm({ ...form, mode: m })}
                  className={`flex-1 rounded-lg border py-1.5 text-sm font-medium transition-all ${
                    form.mode === m ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-secondary/60'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <label className="mb-1 block text-[11px] text-muted-foreground">
              키 (Base64, AES-256 = 32바이트)
            </label>
            <div className="flex gap-1.5">
              <Input
                placeholder="Base64 키 문자열"
                value={form.key_base64}
                onChange={(e) => setForm({ ...form, key_base64: e.target.value })}
                className="h-8 flex-1 font-mono text-xs"
              />
              <Button size="sm" variant="outline" onClick={() => setForm({ ...form, key_base64: generateKeyBase64() })} title="랜덤 키 생성">
                <Shuffle className="size-3.5" />
              </Button>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleCreate} className="flex-1">추가</Button>
            <Button variant="outline" onClick={() => { setAdding(false); setForm(emptyForm); }}>취소</Button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-center text-sm text-muted-foreground">불러오는 중...</p>
      ) : configs.length === 0 && !adding ? (
        <div className="rounded-xl border border-dashed border-border py-12 text-center">
          <p className="text-sm text-muted-foreground">등록된 암호화 설정이 없습니다</p>
          <p className="mt-1 text-xs text-muted-foreground">위의 추가 버튼으로 키를 생성하거나 입력하세요</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {configs.map((c) => {
            const isEditing = editingId === c.id;
            return (
              <div key={c.id} className="rounded-xl border border-border bg-card p-4">
                {isEditing ? (
                  <div>
                    <div className="mb-2">
                      <label className="mb-1 block text-[11px] text-muted-foreground">이름</label>
                      <Input value={editForm.label ?? c.label} onChange={(e) => setEditForm({ ...editForm, label: e.target.value })} className="h-8 text-sm" />
                    </div>
                    <div className="mb-3">
                      <label className="mb-1 block text-[11px] text-muted-foreground">키 (Base64)</label>
                      <div className="flex gap-1.5">
                        <Input value={editForm.key_base64 ?? c.key_base64} onChange={(e) => setEditForm({ ...editForm, key_base64: e.target.value })} className="h-8 flex-1 font-mono text-xs" />
                        <Button size="sm" variant="outline" onClick={() => setEditForm({ ...editForm, key_base64: generateKeyBase64() })} title="랜덤 키 생성">
                          <Shuffle className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleSaveEdit(c.id)}><Check className="mr-1 size-3.5" /> 저장</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}><X className="mr-1 size-3.5" /> 취소</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] shrink-0 border-[#e11d48]/30 bg-[#e11d48]/10 text-[#e11d48]">{c.mode}</Badge>
                        <span className="truncate text-sm font-medium">{c.label}</span>
                      </div>
                      <p className="truncate font-mono text-[11px] text-muted-foreground">{c.key_base64}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button onClick={() => { setEditingId(c.id); setEditForm({}); }} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground" title="수정">
                        <Pencil className="size-3.5" />
                      </button>
                      <button onClick={() => handleDelete(c)} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive" title="삭제">
                        <Trash2 className="size-3.5" />
                      </button>
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
