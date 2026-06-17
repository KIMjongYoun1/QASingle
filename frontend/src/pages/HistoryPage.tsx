import { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { useQAStore } from '../store/useQAStore';
import {
  listRuns, getRun, listComments, addComment, updateRunLabel,
  type RunSummary, type RunStatus, type RunComment,
} from '../api/runs';
import { listFlows } from '../api/flows';
import type { TestFlow } from '../types/qa';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { cn } from '../lib/utils';

function passRate(r: RunSummary | RunStatus) {
  return r.total ? Math.round(((r.total - r.fail) / r.total) * 100) : 0;
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('ko-KR', {
    year: '2-digit', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function HistoryPage() {
  const projectId = useQAStore((s) => s.projectId);
  const allCases = useQAStore((s) => s.data.mgr.cases);
  const allCats = useQAStore((s) => s.data.mgr.cats);

  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<RunStatus | null>(null);
  const [comments, setComments] = useState<RunComment[]>([]);
  const [flows, setFlows] = useState<TestFlow[]>([]);
  const [commentText, setCommentText] = useState('');
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [expandedCaseIds, setExpandedCaseIds] = useState<Set<string>>(new Set());
  const [runSearch, setRunSearch] = useState('');
  const [runResultFilter, setRunResultFilter] = useState<'all' | 'pass' | 'fail'>('all');
  const [caseFilter, setCaseFilter] = useState<'all' | 'Pass' | 'Fail'>('all');
  const [catFilter, setCatFilter] = useState<string>('all');
  const [collapsedCatIds, setCollapsedCatIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!projectId) return;
    listRuns(projectId).then(setRuns).catch(() => { toast.error('히스토리 목록을 불러오지 못했습니다'); });
    listFlows(projectId).then(setFlows).catch(() => {});
  }, [projectId]);

  const toggleCaseExpand = (caseId: string) => {
    setExpandedCaseIds((prev) => {
      const next = new Set(prev);
      next.has(caseId) ? next.delete(caseId) : next.add(caseId);
      return next;
    });
  };

  const selectRun = async (id: number) => {
    setSelectedId(id);
    setEditingLabel(null);
    setCommentText('');
    setExpandedCaseIds(new Set());
    setCaseFilter('all');
    setCatFilter('all');
    setCollapsedCatIds(new Set());
    try {
      const [d, c] = await Promise.all([getRun(id), listComments(id)]);
      setDetail(d);
      setComments(c);
    } catch {
      toast.error('실행 상세 정보를 불러오지 못했습니다');
    }
  };

  const submitComment = async () => {
    if (!selectedId || !commentText.trim()) return;
    try {
      const c = await addComment(selectedId, commentText.trim());
      setComments((prev) => [...prev, c]);
      setCommentText('');
      toast.success('댓글을 등록했습니다');
    } catch {
      toast.error('댓글 등록에 실패했습니다');
    }
  };

  const saveLabel = async () => {
    if (selectedId === null || editingLabel === null) return;
    try {
      await updateRunLabel(selectedId, editingLabel);
      setRuns((prev) => prev.map((r) => r.id === selectedId ? { ...r, label: editingLabel } : r));
      if (detail) setDetail({ ...detail, label: editingLabel });
      setEditingLabel(null);
      toast.success('레이블을 저장했습니다');
    } catch {
      toast.error('레이블 저장에 실패했습니다');
    }
  };

  const caseName = (id: string) => allCases.find((c) => c.id === id)?.name ?? id;
  const flowName = (id: number) => flows.find((f) => f.id === id)?.name ?? `플로우 #${id}`;

  // case_id → catId: mgr_snapshot 우선, 없으면 현재 allCases fallback
  const caseCatId = (caseId: string): string => {
    const snap = detail?.mgr_snapshot?.find((s) => s.id === caseId);
    if (snap) return snap.catId;
    return allCases.find((c) => c.id === caseId)?.catId ?? '';
  };

  // case_results를 카테고리별로 그룹핑 (P/F 필터 적용 후)
  const groupedCaseResults = (() => {
    if (!detail?.case_results?.length) return [];
    const filtered = detail.case_results.filter((cr) => caseFilter === 'all' || cr.pf === caseFilter);
    const groupMap = new Map<string, typeof filtered>();
    filtered.forEach((cr) => {
      const catId = caseCatId(cr.case_id);
      if (!groupMap.has(catId)) groupMap.set(catId, []);
      groupMap.get(catId)!.push(cr);
    });
    // 카테고리 순서: allCats 순서 유지, 미분류 마지막
    const result: { catId: string; catName: string; catColor: string; cases: typeof filtered }[] = [];
    allCats.forEach((cat) => {
      if (groupMap.has(cat.id)) result.push({ catId: cat.id, catName: cat.name, catColor: cat.color, cases: groupMap.get(cat.id)! });
    });
    if (groupMap.has('')) result.push({ catId: '', catName: '미분류', catColor: '#888', cases: groupMap.get('')! });
    return result;
  })();

  if (!projectId) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        프로젝트를 선택하세요
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0">
      {/* 왼쪽: 실행 목록 */}
      <div className="flex w-72 min-w-72 flex-col gap-0 overflow-y-auto border-r border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-foreground">실행 히스토리</h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{runs.length}건 기록</p>
          <div className="mt-2 flex flex-col gap-1.5">
            <Input
              placeholder="레이블 또는 URL 검색"
              value={runSearch}
              onChange={(e) => setRunSearch(e.target.value)}
              className="h-7 text-xs"
            />
            <div className="flex gap-1">
              {(['all', 'pass', 'fail'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setRunResultFilter(f)}
                  className={cn(
                    'flex-1 rounded-md py-0.5 text-[10px] font-medium transition-colors',
                    runResultFilter === f
                      ? f === 'all' ? 'bg-primary text-primary-foreground'
                        : f === 'pass' ? 'bg-success text-success-foreground'
                        : 'bg-destructive text-destructive-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  )}
                >
                  {f === 'all' ? '전체' : f === 'pass' ? '전통과' : '실패포함'}
                </button>
              ))}
            </div>
          </div>
        </div>
        {runs.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center py-16 text-center text-sm text-muted-foreground">
            아직 완료된 실행이 없습니다
          </div>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {runs.filter((r) => {
              if (runSearch) {
                const q = runSearch.toLowerCase();
                if (!(r.label ?? '').toLowerCase().includes(q) && !r.base_url.toLowerCase().includes(q)) return false;
              }
              if (runResultFilter === 'pass' && r.fail > 0) return false;
              if (runResultFilter === 'fail' && r.fail === 0) return false;
              return true;
            }).map((r) => {
              const rate = passRate(r);
              const active = selectedId === r.id;
              return (
                <li key={r.id}>
                  <button
                    onClick={() => selectRun(r.id)}
                    className={cn(
                      'flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-muted/40',
                      active && 'bg-primary/5 border-l-2 border-l-primary'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className={cn('text-xs font-bold', r.fail === 0 ? 'text-success' : rate >= 50 ? 'text-warning' : 'text-destructive')}>
                        {rate}%
                      </span>
                      <span className="truncate text-xs font-medium text-foreground">
                        {r.label || `Run #${r.id}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span>{r.total}건</span>
                      <span className="text-success">{r.total - r.fail}P</span>
                      <span className="text-destructive">{r.fail}F</span>
                      {r.flow_ids.length > 0 && (
                        <span className="rounded bg-primary/10 px-1 text-primary">
                          플로우 {r.flow_ids.length}
                        </span>
                      )}
                      <span className="ml-auto shrink-0">{fmtDate(r.finished_at)}</span>
                    </div>
                    <div className="truncate text-[10px] text-muted-foreground">{r.base_url}</div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* 오른쪽: 선택된 Run 상세 */}
      {detail ? (
        <div className="flex min-w-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
          {/* 헤더: 레이블 편집 */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-1 flex-col gap-1">
              {editingLabel !== null ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={editingLabel}
                    onChange={(e) => setEditingLabel(e.target.value)}
                    className="h-8 text-sm"
                    placeholder="레이블 입력..."
                    onKeyDown={(e) => { if (e.key === 'Enter') saveLabel(); if (e.key === 'Escape') setEditingLabel(null); }}
                    autoFocus
                  />
                  <Button size="sm" className="h-8 shrink-0" onClick={saveLabel}>저장</Button>
                  <Button size="sm" variant="ghost" className="h-8 shrink-0" onClick={() => setEditingLabel(null)}>취소</Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-foreground">
                    {detail.label || `Run #${detail.id}`}
                  </h3>
                  <button
                    onClick={() => setEditingLabel(detail.label || '')}
                    className="text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    레이블 편집
                  </button>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                {detail.base_url} · {fmtDate(detail.started_at)} → {fmtDate(detail.finished_at)}
              </p>
            </div>
          </div>

          {/* 요약 수치 */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: '전체', val: detail.total, cls: 'text-foreground' },
              { label: '성공', val: detail.total - detail.fail, cls: 'text-success' },
              { label: '실패', val: detail.fail, cls: 'text-destructive' },
              { label: 'Pass율', val: `${passRate(detail)}%`, cls: 'text-primary' },
            ].map(({ label, val, cls }) => (
              <div key={label} className="rounded-xl border border-border bg-card px-4 py-3 text-center shadow-[var(--shadow-soft)]">
                <div className={cn('text-2xl font-bold', cls)}>{val}</div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">{label}</div>
              </div>
            ))}
          </div>

          {/* 실행 구성 정보 */}
          {(detail.flow_ids?.length || detail.case_ids?.length) && (
            <div className="flex flex-wrap gap-2 text-xs">
              {detail.case_ids?.length ? (
                <span className="rounded-md border border-border bg-muted/40 px-2 py-1 text-muted-foreground">
                  개별 케이스 {detail.case_ids.length}건
                </span>
              ) : null}
              {detail.flow_ids?.map((fid) => (
                <span key={fid} className="rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-primary">
                  {flowName(fid)}
                </span>
              ))}
            </div>
          )}

          {/* 플로우 결과 */}
          {(detail.flow_results ?? []).length > 0 && (
            <div className="flex flex-col gap-3">
              <h4 className="text-xs font-semibold text-foreground">플로우 결과</h4>
              {detail.flow_results.map((fr) => {
                const stopped = fr.status === 'stopped';
                const passN = fr.steps.filter((s) => !s.skipped && s.pf === 'Pass').length;
                return (
                  <div key={fr.flow_id} className="rounded-xl border border-border bg-card shadow-[var(--shadow-soft)]">
                    <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
                      <span className="text-xs font-semibold text-foreground">{fr.flow_name}</span>
                      {stopped && (
                        <Badge className="border-destructive/30 bg-destructive/15 text-destructive text-[10px] h-4">중단됨</Badge>
                      )}
                      <span className="ml-auto text-[11px] text-muted-foreground">{passN}/{fr.steps.length} 성공</span>
                    </div>
                    <div className="flex flex-col divide-y divide-border/50">
                      {fr.steps.map((step, idx) => {
                        const skipped = step.skipped;
                        const pass = step.pf === 'Pass';
                        const stepKey = `flow-${fr.flow_id}-${step.case_id}`;
                        const expanded = expandedCaseIds.has(stepKey);
                        const caseResult = detail.case_results?.find((cr) => cr.case_id === step.case_id);
                        return (
                          <div key={step.case_id} className={cn('text-xs', skipped && 'opacity-50')}>
                            <button
                              onClick={() => !skipped && toggleCaseExpand(stepKey)}
                              className={cn('flex w-full items-center gap-2 px-4 py-2 text-left', !skipped && 'hover:bg-muted/30')}
                            >
                              <span className="w-4 shrink-0 text-center text-[10px] text-muted-foreground">{idx + 1}</span>
                              {!skipped && <span className="text-muted-foreground/60">{expanded ? '▾' : '▸'}</span>}
                              <span className="font-mono text-primary">{step.case_id}</span>
                              <span className="flex-1 truncate text-foreground">{caseName(step.case_id)}</span>
                              <Badge className={cn('shrink-0 text-[10px]',
                                skipped ? 'border-border bg-muted text-muted-foreground'
                                : pass ? 'border-success/30 bg-success/15 text-success'
                                : 'border-destructive/30 bg-destructive/15 text-destructive'
                              )}>
                                {skipped ? '건너뜀' : step.pf}
                              </Badge>
                            </button>
                            {expanded && caseResult && (
                              <div className="border-t border-border/40 bg-muted/20 px-4 py-2.5 text-[11px]">
                                <div className="mb-1.5">
                                  <span className="font-medium text-muted-foreground">실제 결과</span>
                                  <p className="mt-0.5 whitespace-pre-wrap text-foreground">{caseResult.actual || '—'}</p>
                                </div>
                                {caseResult.notes && (
                                  <div>
                                    <span className="font-medium text-muted-foreground">비고</span>
                                    <p className="mt-0.5 whitespace-pre-wrap text-foreground">{caseResult.notes}</p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 개별 케이스 결과 */}
          {(detail.case_results ?? []).length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-semibold text-foreground">개별 케이스 결과</h4>
                  <div className="ml-auto flex gap-1">
                    {(['all', 'Pass', 'Fail'] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setCaseFilter(f)}
                        className={cn(
                          'rounded px-2 py-0.5 text-[10px] font-medium transition-colors',
                          caseFilter === f
                            ? f === 'all' ? 'bg-primary text-primary-foreground'
                              : f === 'Pass' ? 'bg-success text-success-foreground'
                              : 'bg-destructive text-destructive-foreground'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        )}
                      >
                        {f === 'all' ? '전체' : f}
                      </button>
                    ))}
                  </div>
                </div>
                {groupedCaseResults.length > 1 && (
                  <div className="flex flex-wrap gap-1">
                    <button
                      onClick={() => setCatFilter('all')}
                      className={cn('rounded px-2 py-0.5 text-[10px] font-medium transition-colors', catFilter === 'all' ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:bg-muted/80')}
                    >
                      전체
                    </button>
                    {groupedCaseResults.map(({ catId, catName, catColor }) => (
                      <button
                        key={catId}
                        onClick={() => setCatFilter(catId)}
                        className={cn('flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium transition-colors', catFilter === catId ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:bg-muted/80')}
                      >
                        <span className="size-1.5 shrink-0 rounded-full" style={{ background: catColor }} />
                        {catName}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2">
                {groupedCaseResults.filter(({ catId }) => catFilter === 'all' || catFilter === catId).map(({ catId, catName, catColor, cases }) => {
                  const collapsed = collapsedCatIds.has(catId);
                  const passN = cases.filter((c) => c.pf === 'Pass').length;
                  return (
                    <div key={catId} className="rounded-xl border border-border bg-card shadow-[var(--shadow-soft)] overflow-hidden">
                      <button
                        onClick={() => setCollapsedCatIds((prev) => { const next = new Set(prev); next.has(catId) ? next.delete(catId) : next.add(catId); return next; })}
                        className="flex w-full items-center gap-2 border-b border-border bg-muted/30 px-4 py-2 text-left hover:bg-muted/50"
                      >
                        <ChevronRight className={cn('size-3 shrink-0 text-muted-foreground transition-transform', !collapsed && 'rotate-90')} />
                        <span className="size-2 shrink-0 rounded-full" style={{ background: catColor }} />
                        <span className="flex-1 text-xs font-semibold text-foreground">{catName}</span>
                        <span className="text-[10px] text-muted-foreground">{passN}/{cases.length} Pass</span>
                      </button>
                      {!collapsed && (
                        <div className="flex flex-col divide-y divide-border/50">
                          {cases.map((cr) => {
                            const pass = cr.pf === 'Pass';
                            const expanded = expandedCaseIds.has(cr.case_id);
                            return (
                              <div key={cr.case_id} className={cn('text-xs', !pass && 'bg-destructive/5')}>
                                <button
                                  onClick={() => toggleCaseExpand(cr.case_id)}
                                  className="flex w-full items-center gap-2 px-4 py-2 text-left hover:bg-muted/30"
                                >
                                  <span className="text-muted-foreground/60">{expanded ? '▾' : '▸'}</span>
                                  <span className="font-mono text-primary">{cr.case_id}</span>
                                  <span className="flex-1 truncate text-foreground">{caseName(cr.case_id)}</span>
                                  <Badge className={pass
                                    ? 'border-success/30 bg-success/15 text-success'
                                    : 'border-destructive/30 bg-destructive/15 text-destructive'
                                  }>
                                    {cr.pf}
                                  </Badge>
                                </button>
                                {expanded && (
                                  <div className="border-t border-border/40 bg-muted/20 px-4 py-2.5 text-[11px]">
                                    <div className="mb-1.5">
                                      <span className="font-medium text-muted-foreground">실제 결과</span>
                                      <p className="mt-0.5 whitespace-pre-wrap text-foreground">{cr.actual || '—'}</p>
                                    </div>
                                    {cr.notes && (
                                      <div>
                                        <span className="font-medium text-muted-foreground">비고</span>
                                        <p className="mt-0.5 whitespace-pre-wrap text-foreground">{cr.notes}</p>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 댓글 */}
          <div className="flex flex-col gap-3">
            <h4 className="text-xs font-semibold text-foreground">메모 / 댓글</h4>
            {comments.length === 0 ? (
              <p className="text-xs text-muted-foreground">아직 댓글이 없습니다</p>
            ) : (
              <div className="flex flex-col gap-2">
                {comments.map((c) => (
                  <div key={c.id} className="rounded-xl border border-border bg-card px-4 py-3 shadow-[var(--shadow-soft)]">
                    <p className="whitespace-pre-wrap text-sm text-foreground">{c.text}</p>
                    <p className="mt-1.5 text-[10px] text-muted-foreground">{fmtDate(c.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="메모 또는 댓글 입력... (Enter로 등록)"
                className="h-9 text-xs"
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitComment(); } }}
              />
              <Button size="sm" className="h-9 shrink-0 px-4" onClick={submitComment} disabled={!commentText.trim()}>
                등록
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          왼쪽에서 실행 기록을 선택하세요
        </div>
      )}
    </div>
  );
}
