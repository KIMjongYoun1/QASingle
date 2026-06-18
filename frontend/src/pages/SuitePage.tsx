import { useEffect, useState } from 'react';
import { Layers, Plus, Trash2, Star, StarOff, Pencil, Check, X, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { useQAStore } from '../store/useQAStore';
import {
  listSuites,
  createSuite,
  updateSuite,
  deleteSuite,
  setDefaultSuite,
  type TestSuite,
} from '../api/suites';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { cn } from '../lib/utils';
import CaseFormDialog from '../components/CaseFormDialog';
import type { TestCase } from '../types/qa';

export default function SuitePage() {
  const projectId = useQAStore((s) => s.projectId);
  const data = useQAStore((s) => s.data);
  const activeSuiteId = useQAStore((s) => s.activeSuiteId);
  const setActiveSuiteId = useQAStore((s) => s.setActiveSuiteId);
  const deleteCase = useQAStore((s) => s.deleteCase);

  const allCases = data.mgr.cases;
  const allFlows: { id: number; name: string }[] = (data as any).flows ?? [];

  const [suites, setSuites] = useState<TestSuite[]>([]);
  const [selected, setSelected] = useState<TestSuite | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [caseDialogOpen, setCaseDialogOpen] = useState(false);
  const [editingCase, setEditingCase] = useState<TestCase | null>(null);

  const load = async () => {
    if (!projectId) return;
    const list = await listSuites(projectId);
    setSuites(list);
    // auto-activate default suite if none active
    if (!activeSuiteId) {
      const def = list.find((s) => s.is_default);
      if (def) setActiveSuiteId(def.id);
    }
    // refresh selected
    setSelected((prev) => (prev ? list.find((s) => s.id === prev.id) ?? null : null));
  };

  useEffect(() => { load(); }, [projectId]);

  const handleCreate = async () => {
    if (!newName.trim() || !projectId) return;
    try {
      await createSuite({ project_id: projectId, name: newName.trim(), description: newDesc.trim() || undefined });
      setNewName('');
      setNewDesc('');
      setCreating(false);
      toast.success('스위트를 생성했습니다');
      await load();
    } catch {
      toast.error('생성에 실패했습니다');
    }
  };

  const handleDelete = async (suite: TestSuite) => {
    if (!confirm(`"${suite.name}" 스위트를 삭제하시겠습니까?`)) return;
    try {
      await deleteSuite(suite.id);
      if (selected?.id === suite.id) setSelected(null);
      if (activeSuiteId === suite.id) setActiveSuiteId(null);
      toast.success('삭제했습니다');
      await load();
    } catch {
      toast.error('삭제에 실패했습니다');
    }
  };

  const handleSetDefault = async (suite: TestSuite) => {
    try {
      await setDefaultSuite(suite.id);
      toast.success(`"${suite.name}"을 기본 스위트로 설정했습니다`);
      await load();
    } catch {
      toast.error('설정에 실패했습니다');
    }
  };

  const handleSaveName = async () => {
    if (!selected || !editName.trim()) return;
    try {
      await updateSuite(selected.id, { name: editName.trim(), description: editDesc });
      setEditingName(false);
      toast.success('이름을 수정했습니다');
      await load();
    } catch {
      toast.error('수정에 실패했습니다');
    }
  };

  const toggleCase = async (caseId: string) => {
    if (!selected) return;
    const next = selected.case_ids.includes(caseId)
      ? selected.case_ids.filter((id) => id !== caseId)
      : [...selected.case_ids, caseId];
    try {
      const updated = await updateSuite(selected.id, { case_ids: next });
      setSuites((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      setSelected(updated);
    } catch {
      toast.error('저장에 실패했습니다');
    }
  };

  const handleDeleteCase = (c: TestCase) => {
    if (!confirm(`"${c.id} ${c.name}" 케이스를 삭제하시겠습니까?\n케이스 관리 전체에서 삭제됩니다.`)) return;
    deleteCase(c.id);
    toast.success('케이스를 삭제했습니다');
  };

  const handleCaseSaved = async (caseId: string) => {
    if (!selected) return;
    if (!selected.case_ids.includes(caseId)) {
      try {
        const updated = await updateSuite(selected.id, { case_ids: [...selected.case_ids, caseId] });
        setSuites((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
        setSelected(updated);
      } catch {
        // 추가 실패해도 케이스 저장은 이미 완료됨
      }
    }
  };

  const toggleFlow = async (flowId: number) => {
    if (!selected) return;
    const next = selected.flow_ids.includes(flowId)
      ? selected.flow_ids.filter((id) => id !== flowId)
      : [...selected.flow_ids, flowId];
    try {
      const updated = await updateSuite(selected.id, { flow_ids: next });
      setSuites((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      setSelected(updated);
    } catch {
      toast.error('저장에 실패했습니다');
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
    <div className="flex h-full">
      {/* Left: suite list */}
      <div className="flex w-72 min-w-72 flex-col gap-2 border-r border-border p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold">Test Suite</span>
          <Button size="sm" variant="outline" onClick={() => setCreating(true)}>
            <Plus className="mr-1 size-3.5" /> 추가
          </Button>
        </div>

        {creating && (
          <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-secondary/30 p-3">
            <Input
              autoFocus
              placeholder="스위트 이름"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setCreating(false); }}
              className="h-8 text-sm"
            />
            <Textarea
              placeholder="설명 (선택)"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              className="h-16 resize-none text-xs"
            />
            <div className="flex gap-1.5">
              <Button size="sm" onClick={handleCreate} className="flex-1">생성</Button>
              <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>취소</Button>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-1">
          {suites.length === 0 && !creating && (
            <p className="py-8 text-center text-xs text-muted-foreground">스위트가 없습니다</p>
          )}
          {suites.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelected(s)}
              className={cn(
                'group flex w-full flex-col gap-1 rounded-xl px-3 py-2.5 text-left transition-all',
                selected?.id === s.id
                  ? 'bg-[linear-gradient(310deg,var(--primary),var(--primary-2))] text-primary-foreground shadow-[0_2px_8px_-2px_color-mix(in_oklch,var(--primary)_55%,transparent)]'
                  : 'hover:bg-secondary/60'
              )}
            >
              <div className="flex items-center gap-1.5">
                <Layers className="size-3.5 shrink-0" />
                <span className="flex-1 truncate text-sm font-medium">{s.name}</span>
                {s.is_default && (
                  <Badge variant="secondary" className="h-4 px-1 text-[10px]">기본</Badge>
                )}
              </div>
              <div className={cn('text-[11px]', selected?.id === s.id ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
                케이스 {s.case_ids.length}개 · 플로우 {s.flow_ids.length}개
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Right: detail */}
      {!selected ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          스위트를 선택하거나 새로 만들어주세요
        </div>
      ) : (
        <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto p-6">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              {editingName ? (
                <div className="flex flex-col gap-2">
                  <Input
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="text-lg font-semibold"
                  />
                  <Textarea
                    placeholder="설명"
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    className="h-16 resize-none text-sm"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSaveName}><Check className="mr-1 size-3.5" /> 저장</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingName(false)}><X className="mr-1 size-3.5" /> 취소</Button>
                  </div>
                </div>
              ) : (
                <div>
                  <h2 className="text-lg font-semibold">{selected.name}</h2>
                  {selected.description && <p className="mt-0.5 text-sm text-muted-foreground">{selected.description}</p>}
                </div>
              )}
            </div>
            {!editingName && (
              <div className="flex shrink-0 gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleSetDefault(selected)}
                  title="프로젝트 기본 스위트로 설정"
                >
                  {selected.is_default ? <StarOff className="size-3.5" /> : <Star className="size-3.5" />}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setEditingName(true); setEditName(selected.name); setEditDesc(selected.description ?? ''); }}
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button size="sm" variant="outline" className="text-destructive hover:bg-destructive/10" onClick={() => handleDelete(selected)}>
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            )}
          </div>

          {/* Cases */}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold">테스트 케이스 <span className="font-normal text-muted-foreground">({selected.case_ids.length}/{allCases.length})</span></h3>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs"
                onClick={() => { setEditingCase(null); setCaseDialogOpen(true); }}
              >
                <Plus className="mr-1 size-3" /> 케이스 추가
              </Button>
            </div>
            {allCases.length === 0 ? (
              <p className="text-xs text-muted-foreground">케이스가 없습니다. 위의 버튼으로 추가하세요.</p>
            ) : (
              <div className="flex flex-col gap-1">
                {allCases.map((c) => {
                  const included = selected.case_ids.includes(c.id);
                  return (
                    <div
                      key={c.id}
                      className={cn(
                        'group flex items-center gap-2.5 rounded-xl border px-3 py-2 text-xs transition-all',
                        included
                          ? 'border-primary/40 bg-primary/8 text-foreground'
                          : 'border-border bg-card text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                      )}
                    >
                      {/* 체크박스 — 스위트 포함 여부 토글 */}
                      <button
                        onClick={() => toggleCase(c.id)}
                        className={cn('flex size-4 shrink-0 items-center justify-center rounded border text-[10px] transition-colors', included ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:border-primary/50')}
                      >
                        {included && <Check className="size-3" />}
                      </button>
                      <span className="font-mono font-medium">{c.id}</span>
                      <span className="flex-1 truncate">{c.name}</span>
                      {c.method && <Badge variant="outline" className="shrink-0 text-[10px]">{c.method}</Badge>}
                      {/* 수정/삭제 버튼 — hover 시 표시 */}
                      <div className="ml-1 flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          onClick={() => { setEditingCase(c); setCaseDialogOpen(true); }}
                          className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                          title="케이스 수정"
                        >
                          <Pencil className="size-3" />
                        </button>
                        <button
                          onClick={() => handleDeleteCase(c)}
                          className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          title="케이스 삭제"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Flows */}
          <section>
            <h3 className="mb-2 text-sm font-semibold">테스트 플로우 <span className="font-normal text-muted-foreground">({selected.flow_ids.length}개 선택)</span></h3>
            <FlowList suiteFlowIds={selected.flow_ids} projectId={projectId} allCases={allCases} onToggle={toggleFlow} />
          </section>
        </div>
      )}

      <CaseFormDialog
        open={caseDialogOpen}
        onClose={() => { setCaseDialogOpen(false); setEditingCase(null); }}
        editCase={editingCase}
        onSaved={handleCaseSaved}
      />
    </div>
  );
}

interface FlowWithSteps {
  id: number;
  name: string;
  steps: { case_id: string; order: number }[];
}

function FlowList({
  suiteFlowIds, projectId, allCases, onToggle,
}: {
  suiteFlowIds: number[];
  projectId: number;
  allCases: { id: string; name: string; method?: string; endpoint?: string }[];
  onToggle: (id: number) => void;
}) {
  const [flows, setFlows] = useState<FlowWithSteps[]>([]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  useEffect(() => {
    import('../api/flows').then(({ listFlows }) => {
      listFlows(projectId).then((list) => {
        setFlows(list as FlowWithSteps[]);
        // 스위트에 포함된 플로우는 기본 펼침
        setExpanded(new Set(suiteFlowIds));
      }).catch(() => {});
    });
  }, [projectId]);

  // 스위트 변경 시 새로 포함된 플로우 자동 펼침
  useEffect(() => {
    setExpanded((prev) => {
      const next = new Set(prev);
      suiteFlowIds.forEach((id) => next.add(id));
      return next;
    });
  }, [suiteFlowIds.join(',')]);

  const caseMap = new Map(allCases.map((c) => [c.id, c]));

  const toggleExpand = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  if (flows.length === 0) {
    return <p className="text-xs text-muted-foreground">플로우가 없습니다</p>;
  }

  return (
    <div className="flex flex-col gap-1.5">
      {flows.map((f) => {
        const included = suiteFlowIds.includes(f.id);
        const isExpanded = expanded.has(f.id);
        const sorted = [...f.steps].sort((a, b) => a.order - b.order);

        return (
          <div
            key={f.id}
            className={cn(
              'rounded-xl border transition-all',
              included ? 'border-primary/40 bg-primary/8' : 'border-border bg-card'
            )}
          >
            {/* 플로우 헤더 행 */}
            <div className="flex items-center gap-2.5 px-3 py-2">
              {/* 체크박스 */}
              <button
                onClick={() => onToggle(f.id)}
                className={cn(
                  'flex size-4 shrink-0 items-center justify-center rounded border text-[10px] transition-colors',
                  included ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:border-primary/50'
                )}
              >
                {included && <Check className="size-3" />}
              </button>

              {/* 플로우 이름 */}
              <span className={cn('flex-1 truncate text-xs font-medium', included ? 'text-foreground' : 'text-muted-foreground')}>
                {f.name}
              </span>

              {/* 스텝 수 + 펼침 버튼 */}
              <span className="shrink-0 text-[11px] text-muted-foreground">{f.steps.length}스텝</span>
              <button
                onClick={(e) => toggleExpand(f.id, e)}
                className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground"
              >
                {isExpanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
              </button>
            </div>

            {/* 케이스 순서 목록 */}
            {isExpanded && (
              <div className="border-t border-border/60 px-3 pb-2 pt-2">
                {sorted.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">스텝 없음</p>
                ) : (
                  <ol className="flex flex-col gap-1">
                    {sorted.map((step, idx) => {
                      const c = caseMap.get(step.case_id);
                      return (
                        <li key={step.case_id} className="flex items-center gap-2 text-[11px]">
                          {/* 순서 번호 */}
                          <span className={cn(
                            'flex size-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                            included
                              ? 'bg-primary/20 text-primary'
                              : 'bg-muted text-muted-foreground'
                          )}>
                            {idx + 1}
                          </span>
                          {/* 케이스 ID */}
                          <span className="shrink-0 font-mono font-medium text-foreground">{step.case_id}</span>
                          {/* 케이스 이름 */}
                          {c ? (
                            <span className="truncate text-muted-foreground">{c.name}</span>
                          ) : (
                            <span className="text-muted-foreground/50 italic">케이스 없음</span>
                          )}
                          {/* 메서드 */}
                          {c?.method && (
                            <span className={cn(
                              'ml-auto shrink-0 rounded px-1 py-0.5 text-[10px] font-medium',
                              c.method === 'GET' ? 'bg-blue-500/10 text-blue-600' :
                              c.method === 'POST' ? 'bg-green-500/10 text-green-600' :
                              c.method === 'DELETE' ? 'bg-red-500/10 text-red-600' :
                              'bg-orange-500/10 text-orange-600'
                            )}>
                              {c.method}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
