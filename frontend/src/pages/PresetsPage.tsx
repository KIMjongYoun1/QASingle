import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Pencil, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { useQAStore } from '../store/useQAStore';
import {
  listPresets,
  createPreset,
  updatePreset,
  deletePreset,
  type ProjectPreset,
  type PresetKind,
} from '../api/presets';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { cn } from '../lib/utils';

const KIND_META: Record<PresetKind, { label: string; color: string; needsKey: boolean }> = {
  header: { label: '헤더', color: 'bg-[#4f8cff]/10 text-[#4f8cff] border-[#4f8cff]/30', needsKey: true },
  param:  { label: '파라미터', color: 'bg-[#16a34a]/10 text-[#16a34a] border-[#16a34a]/30', needsKey: true },
  url:    { label: '서버 URL', color: 'bg-[#7c3aed]/10 text-[#7c3aed] border-[#7c3aed]/30', needsKey: false },
  path:   { label: '엔드포인트 경로', color: 'bg-[#d97706]/10 text-[#d97706] border-[#d97706]/30', needsKey: false },
  body:   { label: '바디 필드', color: 'bg-[#e11d48]/10 text-[#e11d48] border-[#e11d48]/30', needsKey: true },
};

const ALL_CATS = '__all';
const COMMON_CAT = '__common';
const NEW_CAT = '__new';

const emptyForm = { kind: 'header' as PresetKind, label: '', key: '', value: '', categoryId: '' };

export default function PresetsPage() {
  const projectId = useQAStore((s) => s.projectId);
  const cats = useQAStore((s) => s.data.mgr.cats);
  const addCategory = useQAStore((s) => s.addCategory);
  const [presets, setPresets] = useState<ProjectPreset[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<ProjectPreset>>({});
  const [filterCat, setFilterCat] = useState(ALL_CATS);
  const [newCatTarget, setNewCatTarget] = useState<'add' | 'edit' | null>(null);
  const [newCatName, setNewCatName] = useState('');

  const createCategory = (name: string): string | null => {
    if (!name.trim()) return null;
    addCategory(name.trim());
    const created = useQAStore.getState().data.mgr.cats.at(-1);
    return created?.id ?? null;
  };

  const confirmNewCategory = () => {
    const id = createCategory(newCatName);
    if (!id) { toast.error('카테고리 이름을 입력하세요'); return; }
    if (newCatTarget === 'add') setForm((f) => ({ ...f, categoryId: id }));
    if (newCatTarget === 'edit') setEditForm((f) => ({ ...f, category_id: id }));
    setNewCatTarget(null);
    setNewCatName('');
    toast.success('카테고리를 생성했습니다');
  };

  const catName = (id: string | null) => (id ? cats.find((c) => c.id === id)?.name ?? id : null);

  const load = async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      setPresets(await listPresets(projectId));
    } catch {
      toast.error('저장된 값을 불러오지 못했습니다');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [projectId]);

  const handleCreate = async () => {
    if (!form.label.trim()) { toast.error('이름을 입력하세요'); return; }
    if (KIND_META[form.kind].needsKey && !form.key.trim()) { toast.error('키를 입력하세요'); return; }
    if (!form.value.trim()) { toast.error('값을 입력하세요'); return; }
    if (!projectId) return;
    try {
      await createPreset({
        project_id: projectId, kind: form.kind, label: form.label,
        key: form.key || undefined, value: form.value,
        category_id: form.categoryId || null,
      });
      toast.success('저장된 값을 추가했습니다');
      setForm(emptyForm);
      setAdding(false);
      await load();
    } catch {
      toast.error('추가에 실패했습니다');
    }
  };

  const handleSaveEdit = async (id: number) => {
    try {
      const updated = await updatePreset(id, editForm);
      setPresets((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setEditingId(null);
      toast.success('수정했습니다');
    } catch {
      toast.error('수정에 실패했습니다');
    }
  };

  const handleDelete = async (p: ProjectPreset) => {
    if (!confirm(`"${p.label}"를 삭제하시겠습니까? (이 값을 참조하던 케이스는 영향받지 않습니다)`)) return;
    try {
      await deletePreset(p.id);
      setPresets((prev) => prev.filter((x) => x.id !== p.id));
      toast.success('삭제했습니다');
    } catch {
      toast.error('삭제에 실패했습니다');
    }
  };

  const filtered = useMemo(() => {
    if (filterCat === ALL_CATS) return presets;
    if (filterCat === COMMON_CAT) return presets.filter((p) => !p.category_id);
    return presets.filter((p) => p.category_id === filterCat);
  }, [presets, filterCat]);

  const catFilterOptions = [
    { id: ALL_CATS, name: '전체' },
    { id: COMMON_CAT, name: '카테고리 공통 (미지정)' },
    ...cats,
  ];

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
          <h2 className="text-lg font-semibold">저장된 값 관리</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            자주 쓰는 헤더 · URL · 파라미터를 등록해두고, 카테고리를 지정하면 케이스 추가 시 그 카테고리를
            선택하는 것만으로 자동 적용됩니다. 값이 바뀌면 여기서 수정하세요.
          </p>
        </div>
        <Button size="sm" onClick={() => setAdding(true)} disabled={adding}>
          <Plus className="mr-1 size-3.5" /> 추가
        </Button>
      </div>

      {/* 카테고리 필터 */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {catFilterOptions.map((c) => (
          <button
            key={c.id}
            onClick={() => setFilterCat(c.id)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-all',
              filterCat === c.id ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-secondary/60'
            )}
          >
            {c.name}
          </button>
        ))}
      </div>

      {adding && (
        <div className="mb-4 rounded-xl border border-border bg-card p-4">
          <p className="mb-3 text-sm font-semibold">새 저장 값</p>

          <div className="mb-3 flex gap-2">
            {(Object.keys(KIND_META) as PresetKind[]).map((k) => (
              <button
                key={k}
                onClick={() => setForm({ ...form, kind: k, key: '' })}
                className={cn(
                  'flex-1 rounded-lg border py-2 text-sm font-medium transition-all',
                  form.kind === k ? KIND_META[k].color + ' border-current' : 'border-border text-muted-foreground hover:bg-secondary/60'
                )}
              >
                {KIND_META[k].label}
              </button>
            ))}
          </div>

          <div className="mb-2">
            <label className="mb-1 block text-[11px] text-muted-foreground">이름 (식별용)</label>
            <Input
              placeholder="예: 인증 토큰, 스테이징 서버"
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              className="h-8 text-sm"
            />
          </div>

          <div className="mb-2">
            <label className="mb-1 block text-[11px] text-muted-foreground">
              적용 카테고리 — 지정하면 케이스 추가 시 이 카테고리를 고르는 것만으로 자동 적용됨 (안 정하면 항상 수동 선택)
            </label>
            <select
              value={form.categoryId}
              onChange={(e) => {
                if (e.target.value === NEW_CAT) { setNewCatTarget('add'); setNewCatName(''); return; }
                setForm({ ...form, categoryId: e.target.value });
              }}
              className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">카테고리 공통 (자동 적용 안 함, 수동 선택)</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              <option value={NEW_CAT}>+ 새 카테고리 만들기</option>
            </select>
            {newCatTarget === 'add' && (
              <div className="mt-1.5 flex gap-1.5">
                <Input
                  autoFocus
                  placeholder="새 카테고리 이름"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') confirmNewCategory(); if (e.key === 'Escape') setNewCatTarget(null); }}
                  className="h-8 flex-1 text-xs"
                />
                <Button size="sm" onClick={confirmNewCategory}>생성</Button>
                <Button size="sm" variant="ghost" onClick={() => setNewCatTarget(null)}>취소</Button>
              </div>
            )}
          </div>

          {KIND_META[form.kind].needsKey && (
            <div className="mb-2">
              <label className="mb-1 block text-[11px] text-muted-foreground">키</label>
              <Input
                placeholder={form.kind === 'header' ? 'Authorization' : form.kind === 'body' ? 'deviceId' : 'userId'}
                value={form.key}
                onChange={(e) => setForm({ ...form, key: e.target.value })}
                className="h-8 font-mono text-xs"
              />
            </div>
          )}

          <div className="mb-4">
            <label className="mb-1 block text-[11px] text-muted-foreground">값</label>
            <Input
              placeholder={form.kind === 'url' ? 'https://api-stg.example.com' : form.kind === 'path' ? '/api/products/{id}' : '값 입력'}
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
              className="h-8 font-mono text-xs"
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={handleCreate} className="flex-1">추가</Button>
            <Button variant="outline" onClick={() => { setAdding(false); setForm(emptyForm); }}>취소</Button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-center text-sm text-muted-foreground">불러오는 중...</p>
      ) : filtered.length === 0 && !adding ? (
        <div className="rounded-xl border border-dashed border-border py-12 text-center">
          <p className="text-sm text-muted-foreground">등록된 값이 없습니다</p>
          <p className="mt-1 text-xs text-muted-foreground">위의 추가 버튼으로 헤더 · URL · 파라미터를 등록하세요</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((p) => {
            const meta = KIND_META[p.kind];
            const isEditing = editingId === p.id;
            return (
              <div key={p.id} className="rounded-xl border border-border bg-card p-4">
                {isEditing ? (
                  <div>
                    <div className="mb-2">
                      <label className="mb-1 block text-[11px] text-muted-foreground">이름</label>
                      <Input value={editForm.label ?? p.label} onChange={(e) => setEditForm({ ...editForm, label: e.target.value })} className="h-8 text-sm" />
                    </div>
                    <div className="mb-2">
                      <label className="mb-1 block text-[11px] text-muted-foreground">적용 카테고리</label>
                      <select
                        value={editForm.category_id ?? p.category_id ?? ''}
                        onChange={(e) => {
                          if (e.target.value === NEW_CAT) { setNewCatTarget('edit'); setNewCatName(''); return; }
                          setEditForm({ ...editForm, category_id: e.target.value || null });
                        }}
                        className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        <option value="">카테고리 공통 (자동 적용 안 함, 수동 선택)</option>
                        {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        <option value={NEW_CAT}>+ 새 카테고리 만들기</option>
                      </select>
                      {newCatTarget === 'edit' && (
                        <div className="mt-1.5 flex gap-1.5">
                          <Input
                            autoFocus
                            placeholder="새 카테고리 이름"
                            value={newCatName}
                            onChange={(e) => setNewCatName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') confirmNewCategory(); if (e.key === 'Escape') setNewCatTarget(null); }}
                            className="h-8 flex-1 text-xs"
                          />
                          <Button size="sm" onClick={confirmNewCategory}>생성</Button>
                          <Button size="sm" variant="ghost" onClick={() => setNewCatTarget(null)}>취소</Button>
                        </div>
                      )}
                    </div>
                    {meta.needsKey && (
                      <div className="mb-2">
                        <label className="mb-1 block text-[11px] text-muted-foreground">키</label>
                        <Input value={editForm.key ?? p.key ?? ''} onChange={(e) => setEditForm({ ...editForm, key: e.target.value })} className="h-8 font-mono text-xs" />
                      </div>
                    )}
                    <div className="mb-3">
                      <label className="mb-1 block text-[11px] text-muted-foreground">값</label>
                      <Input value={editForm.value ?? p.value} onChange={(e) => setEditForm({ ...editForm, value: e.target.value })} className="h-8 font-mono text-xs" />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleSaveEdit(p.id)}><Check className="mr-1 size-3.5" /> 저장</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}><X className="mr-1 size-3.5" /> 취소</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className={cn('text-[10px] shrink-0', meta.color)}>{meta.label}</Badge>
                        {catName(p.category_id) ? (
                          <Badge variant="outline" className="text-[10px] shrink-0 border-muted-foreground/30 text-muted-foreground">{catName(p.category_id)}</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] shrink-0 border-dashed border-muted-foreground/30 text-muted-foreground/70">공통</Badge>
                        )}
                        <span className="truncate text-sm font-medium">{p.label}</span>
                      </div>
                      <p className="truncate font-mono text-[11px] text-muted-foreground">
                        {p.key ? `${p.key} = ${p.value}` : p.value}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button onClick={() => { setEditingId(p.id); setEditForm({}); }} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground" title="수정">
                        <Pencil className="size-3.5" />
                      </button>
                      <button onClick={() => handleDelete(p)} className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive" title="삭제">
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
