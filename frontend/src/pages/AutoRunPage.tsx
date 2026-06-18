import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Play, Plus, Trash2, ChevronUp, ChevronDown, Pencil } from 'lucide-react';
import { useQAStore } from '../store/useQAStore';
import { createRun, getRun, listRuns, type RunStatus, type RunSummary } from '../api/runs';
import { parseOpenApi, type ParsedOpenApiCase } from '../api/openapi';
import { listFlows, createFlow, updateFlow, deleteFlow } from '../api/flows';
import type { TestFlow } from '../types/qa';
import SpecUploadDropzone from '../components/SpecUploadDropzone';
import CaseTable from '../components/CaseTable';
import DiffViewer from '../components/DiffViewer';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Progress, ProgressTrack, ProgressIndicator } from '../components/ui/progress';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { cn } from '../lib/utils';
import { parseNotes } from '../components/DiffViewer';

export default function AutoRunPage({ onGoHistory }: { onGoHistory?: () => void }) {
  const data = useQAStore((s) => s.data);
  const projectId = useQAStore((s) => s.projectId);
  const updateCase = useQAStore((s) => s.updateCase);
  const setApiBaseUrl = useQAStore((s) => s.setApiBaseUrl);
  const setApiHeaders = useQAStore((s) => s.setApiHeaders);
  const importCases = useQAStore((s) => s.importCases);
  const loadProject = useQAStore((s) => s.loadProject);
  const pendingRunRestore = useQAStore((s) => s.pendingRunRestore);
  const setPendingRunRestore = useQAStore((s) => s.setPendingRunRestore);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [baseUrl, setBaseUrl] = useState(data.apiBaseUrl || '');
  const [headersOpen, setHeadersOpen] = useState(false);
  const [run, setRun] = useState<RunStatus | null>(null);
  const [diffCaseId, setDiffCaseId] = useState<string | null>(null);
  const [specFileName, setSpecFileName] = useState('');
  const [parsing, setParsing] = useState(false);
  const [analysis, setAnalysis] = useState<{ cases: ParsedOpenApiCase[]; categories: string[]; baseUrl: string; total: number } | null>(null);
  const [imported, setImported] = useState(false);
  const [tab, setTab] = useState('spec');
  const [analysisDetailId, setAnalysisDetailId] = useState<string | null>(null);
  const [headLog, setHeadLog] = useState('');
  const [tailLog, setTailLog] = useState('');
  const [caseLogs, setCaseLogs] = useState<Record<string, { done: boolean; pass?: boolean; summary?: string }>>({});
  const [resultFilter, setResultFilter] = useState<'all' | 'pass' | 'fail'>('all');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const orderRef = useRef<string[]>([]);
  const doneCountRef = useRef(0);

  // 플로우 관련 상태
  const [flows, setFlows] = useState<TestFlow[]>([]);
  const [selectedFlowIds, setSelectedFlowIds] = useState<Set<number>>(new Set());
  const [flowEditing, setFlowEditing] = useState<TestFlow | null>(null);
  const [flowForm, setFlowForm] = useState<{ name: string; stepIds: string[] } | null>(null);
  const flowRunRef = useRef<{ flow_id: number; flow_name: string; steps: string[] }[]>([]);

  // 히스토리 불러오기 모달 상태
  const [history, setHistory] = useState<RunSummary[]>([]);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);

  // Suite 불러오기 모달 상태
  const [suiteModalOpen, setSuiteModalOpen] = useState(false);
  const [suiteList, setSuiteList] = useState<import('../api/suites').TestSuite[]>([]);

  // flows/selectedFlowIds 이후에 선언 — 선택된 플로우에 속한 케이스는 개별 목록에서 제외
  const allRunnable = useMemo(() => data.mgr.cases.filter((c) => c.endpoint), [data.mgr.cases]);
  const selectedFlowCaseIds = useMemo(() => {
    const ids = new Set<string>();
    flows.filter((f) => selectedFlowIds.has(f.id)).forEach((f) => f.steps.forEach((s) => ids.add(s.case_id)));
    return ids;
  }, [flows, selectedFlowIds]);
  const runnable = useMemo(() => allRunnable.filter((c) => !selectedFlowCaseIds.has(c.id)), [allRunnable, selectedFlowCaseIds]);
  // 선택된 플로우 목록 (순서 유지)
  const activeFlows = useMemo(() => flows.filter((f) => selectedFlowIds.has(f.id)), [flows, selectedFlowIds]);

  useEffect(() => { setBaseUrl(data.apiBaseUrl || ''); }, [data.apiBaseUrl]);
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  useEffect(() => {
    if (projectId) listFlows(projectId).then(setFlows).catch(() => {});
  }, [projectId]);

  const openHistoryModal = () => {
    if (projectId) listRuns(projectId).then(setHistory).catch(() => { toast.error('히스토리를 불러오지 못했습니다'); });
    setHistoryModalOpen(true);
  };

  const openSuiteModal = () => {
    if (!projectId) return;
    import('../api/suites').then(({ listSuites }) => {
      listSuites(projectId).then(setSuiteList).catch(() => { toast.error('Suite를 불러오지 못했습니다'); });
    });
    setSuiteModalOpen(true);
  };

  const applySuite = (suite: import('../api/suites').TestSuite) => {
    setSelected(new Set(suite.case_ids));
    setSelectedFlowIds(new Set(suite.flow_ids));
    setSuiteModalOpen(false);
    setTab('cases');
    toast.success(`Suite "${suite.name}" 적용 — 케이스 ${suite.case_ids.length}건 · 플로우 ${suite.flow_ids.length}개`);
  };

  const restoreFromHistory = async (runId: number) => {
    const detail = await getRun(runId);
    // 빈 배열이어도 항상 덮어써서 이전 선택 상태를 초기화
    setSelected(new Set(detail.case_ids ?? []));
    setSelectedFlowIds(new Set((detail.flow_ids ?? []).map(Number)));
    if (detail.base_url) setBaseUrl(detail.base_url);
    setHistoryModalOpen(false);
    setTab('cases');
    toast.success('이전 실행 설정을 불러왔습니다. 확인 후 실행하세요.');
  };

  // 케이스관리 "불러오기"에서 설정한 pendingRunRestore를 자동 적용
  useEffect(() => {
    if (!pendingRunRestore) return;
    setSelected(new Set(pendingRunRestore.caseIds));
    setSelectedFlowIds(new Set(pendingRunRestore.flowIds.map(Number)));
    if (pendingRunRestore.baseUrl) setBaseUrl(pendingRunRestore.baseUrl);
    setPendingRunRestore(null);
    setTab('cases');
    toast.success(`${pendingRunRestore.sourceLabel ? `"${pendingRunRestore.sourceLabel}" ` : ''}히스토리 설정이 자동실행에 적용되었습니다.`);
  }, [pendingRunRestore]);

  // 플로우 선택 시 해당 케이스를 개별 selected에서 자동 제거 (중복 카운트 방지)
  useEffect(() => {
    if (selectedFlowCaseIds.size === 0) return;
    setSelected((prev) => {
      const next = new Set(prev);
      let changed = false;
      selectedFlowCaseIds.forEach((id) => { if (next.has(id)) { next.delete(id); changed = true; } });
      return changed ? next : prev;
    });
  }, [selectedFlowCaseIds]);

  const openCreateFlow = () => {
    setFlowEditing(null);
    setFlowForm({ name: '', stepIds: [] });
  };

  const openEditFlow = (f: TestFlow) => {
    setFlowEditing(f);
    setFlowForm({ name: f.name, stepIds: f.steps.sort((a, b) => a.order - b.order).map((s) => s.case_id) });
  };

  const saveFlow = async () => {
    if (!flowForm || !projectId) return;
    const steps = flowForm.stepIds.map((id, i) => ({ case_id: id, order: i }));
    try {
      if (flowEditing) {
        const updated = await updateFlow(flowEditing.id, flowForm.name, steps);
        setFlows((prev) => prev.map((f) => (f.id === updated.id ? updated : f)));
        toast.success('플로우가 수정되었습니다');
      } else {
        const created = await createFlow(projectId, flowForm.name, steps);
        setFlows((prev) => [...prev, created]);
        toast.success('플로우가 생성되었습니다');
      }
      setFlowForm(null);
      setFlowEditing(null);
    } catch {
      toast.error('저장에 실패했습니다');
    }
  };

  const handleDeleteFlow = async (flowId: number) => {
    try {
      await deleteFlow(flowId);
      setFlows((prev) => prev.filter((f) => f.id !== flowId));
      setSelectedFlowIds((prev) => { const n = new Set(prev); n.delete(flowId); return n; });
      toast.success('플로우가 삭제되었습니다');
    } catch {
      toast.error('삭제에 실패했습니다');
    }
  };

  const moveStep = (idx: number, dir: -1 | 1) => {
    if (!flowForm) return;
    const arr = [...flowForm.stepIds];
    const target = idx + dir;
    if (target < 0 || target >= arr.length) return;
    [arr[idx], arr[target]] = [arr[target], arr[idx]];
    setFlowForm({ ...flowForm, stepIds: arr });
  };

  const toggleFlowStep = (caseId: string) => {
    if (!flowForm) return;
    const ids = flowForm.stepIds.includes(caseId)
      ? flowForm.stepIds.filter((id) => id !== caseId)
      : [...flowForm.stepIds, caseId];
    setFlowForm({ ...flowForm, stepIds: ids });
  };

  const toggleSelectedFlow = (flowId: number) => {
    setSelectedFlowIds((prev) => {
      const n = new Set(prev);
      n.has(flowId) ? n.delete(flowId) : n.add(flowId);
      return n;
    });
  };

  const handleFile = async (file: File) => {
    setParsing(true);
    setImported(false);
    try {
      const parsed = await parseOpenApi(file);
      setSpecFileName(file.name);
      setAnalysis(parsed);
      toast.success(`${parsed.total}개 케이스를 발견했습니다 — 내용을 확인하고 임포트해주세요`);
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || '스펙 파싱에 실패했습니다');
    } finally {
      setParsing(false);
    }
  };

  const confirmImport = () => {
    if (!analysis) return;
    importCases(analysis.cases, analysis.categories);
    if (analysis.baseUrl) setApiBaseUrl(analysis.baseUrl);
    toast.success(`${analysis.total}개 케이스 임포트 완료${analysis.baseUrl ? ` (기본 URL: ${analysis.baseUrl})` : ''}`);
    setImported(true);
    setTab('cases');
  };

  const groupedAnalysis = useMemo(() => {
    if (!analysis) return [];
    const map = new Map<string, ParsedOpenApiCase[]>();
    analysis.cases.forEach((c) => {
      const key = `${c.method || ''} ${c.endpoint || ''}`.trim() || '(엔드포인트 없음)';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    });
    return Array.from(map.entries());
  }, [analysis]);

  const methodColor = (m?: string) => {
    switch ((m || '').toUpperCase()) {
      case 'GET': return 'border-primary/30 bg-primary/15 text-primary';
      case 'POST': return 'border-success/30 bg-success/15 text-success';
      case 'PUT': case 'PATCH': return 'border-warning/30 bg-warning/15 text-warning';
      case 'DELETE': return 'border-destructive/30 bg-destructive/15 text-destructive';
      default: return 'border-border bg-muted text-muted-foreground';
    }
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) => (prev.size === runnable.length ? new Set() : new Set(runnable.map((c) => c.id))));
  };

  const startRun = async () => {
    if (!projectId) return;
    if (selected.size === 0 && selectedFlowIds.size === 0) return;
    if (baseUrl.trim() && data.apiBaseUrl !== baseUrl) setApiBaseUrl(baseUrl);

    const flowIds = Array.from(selectedFlowIds);
    const selectedFlows = flows.filter((f) => selectedFlowIds.has(f.id));

    // 개별 케이스 순서 — 플로우 케이스 중복 제외
    const flowCaseIdSet = new Set(selectedFlows.flatMap((f) => f.steps.map((s) => s.case_id)));
    orderRef.current = data.mgr.cases.filter((c) => selected.has(c.id) && c.endpoint && !flowCaseIdSet.has(c.id)).map((c) => c.id);
    // 플로우 케이스 순서 저장 (로그 렌더링용)
    flowRunRef.current = selectedFlows.map((f) => ({
      flow_id: f.id,
      flow_name: f.name,
      steps: f.steps.sort((a, b) => a.order - b.order).map((s) => s.case_id),
    }));

    const totalCount = orderRef.current.length + flowRunRef.current.reduce((s, f) => s + f.steps.length, 0);
    setHeadLog(`▶ 실행 시작 (개별 ${orderRef.current.length}개 + 플로우 ${flowRunRef.current.length}개, 대상: ${baseUrl.trim()})`);
    setTailLog('');
    const allCaseIds = [...orderRef.current, ...flowRunRef.current.flatMap((f) => f.steps)];
    setCaseLogs(Object.fromEntries(allCaseIds.map((cid) => [cid, { done: false }])));
    doneCountRef.current = 0;

    let run_id: number;
    try {
      const hdrs = Object.fromEntries((data.apiHeaders ?? []).filter((h) => h.key.trim()).map((h) => [h.key.trim(), h.value]));
      ({ run_id } = await createRun(projectId, baseUrl.trim(), orderRef.current, hdrs, flowIds));
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || '실행 시작에 실패했습니다');
      return;
    }
    setRun({ id: run_id, status: 'pending', total: totalCount, done: 0, fail: 0, error: null, base_url: baseUrl, flow_results: [] });

    pollRef.current = setInterval(async () => {
      let status: RunStatus;
      try {
        status = await getRun(run_id);
      } catch (e) {
        console.error(e);
        return;
      }
      doneCountRef.current = status.done;

      // 폴링 중 플로우 단계별 실시간 반영 (백엔드가 단계 완료 시 즉시 flow_results 저장)
      if (status.flow_results?.length) {
        setCaseLogs((prev) => {
          const next = { ...prev };
          status.flow_results.forEach((fr) => {
            fr.steps.forEach((step) => {
              const skipped = step.skipped;
              next[step.case_id] = {
                done: true,
                pass: skipped ? undefined : step.pf === 'Pass',
                summary: skipped ? '건너뜀 (이전 단계 실패)' : step.pf,
              };
            });
          });
          return next;
        });
      }

      setRun(status);
      if (status.status === 'done' || status.status === 'failed') {
        if (pollRef.current) clearInterval(pollRef.current);
        if (projectId) await loadProject(projectId);
        if (status.status === 'done') {
          const finalCases = useQAStore.getState().data.tst.cases;
          setCaseLogs((prev) => {
            const next = { ...prev };
            // 개별 케이스: 완료 후 실제 결과로 업데이트
            orderRef.current.forEach((cid) => {
              const t = finalCases.find((c) => c.id === cid);
              const pass = t?.pf === 'Pass';
              const { reqLine, resBody } = parseNotes(t?.notes || '');
              const summary = `${reqLine || ''} → ${resBody ? resBody.split('\n')[0].slice(0, 100) : t?.actual || ''}`.trim();
              next[cid] = { done: true, pass, summary };
            });
            // 플로우 케이스: 완료 후 최종 결과로 업데이트
            status.flow_results?.forEach((fr) => {
              fr.steps.forEach((step) => {
                const t = finalCases.find((c) => c.id === step.case_id);
                const skipped = step.skipped;
                const { reqLine, resBody } = parseNotes(t?.notes || '');
                const summary = skipped
                  ? '건너뜀 (이전 단계 실패)'
                  : `${reqLine || ''} → ${resBody ? resBody.split('\n')[0].slice(0, 100) : t?.actual || ''}`.trim();
                next[step.case_id] = { done: true, pass: skipped ? undefined : t?.pf === 'Pass', summary };
              });
            });
            return next;
          });
          const passRate = status.total ? Math.round(((status.total - status.fail) / status.total) * 100) : 0;
          setTailLog(`■ 실행 완료 — Pass율 ${passRate}% (${status.total - status.fail}/${status.total})`);
          toast.success(`실행 완료 — Pass율 ${passRate}% (${status.total - status.fail}/${status.total})`);
        } else {
          setTailLog(`■ 실행 실패: ${status.error}`);
          toast.error(`실행 실패: ${status.error}`);
        }
      }
    }, 1000);
  };

  const tstCase = (id: string) => data.tst.cases.find((c) => c.id === id);
  const isRunning = run?.status === 'running' || run?.status === 'pending';
  const runningId = isRunning ? orderRef.current[run!.done] ?? null : null;
  const progressPct = run && run.total ? Math.round((run.done / run.total) * 100) : 0;

  const flowCaseIds = new Set(flowRunRef.current.flatMap((f) => f.steps));
  // 현재 세션 run에 포함된 케이스만 표시 (이전 실행 결과 누적 방지)
  const currentRunCaseIds = new Set([...orderRef.current, ...flowRunRef.current.flatMap((f) => f.steps)]);
  const executedResults = run
    ? data.tst.cases.filter((t) => t.actual && currentRunCaseIds.has(t.id) && allRunnable.some((c) => c.id === t.id))
    : [];
  const individualResults = executedResults.filter((t) => !flowCaseIds.has(t.id));

  // 요약 수치는 플로우 중복 케이스 포함 실행 횟수 기준 (flow_results 기반)
  const flowStepResults = run?.flow_results?.flatMap((fr) => fr.steps) ?? [];
  const flowPassCount = flowStepResults.filter((s) => !s.skipped && s.pf === 'Pass').length;
  const flowFailCount = flowStepResults.filter((s) => !s.skipped && s.pf === 'Fail').length;
  const flowSkipCount = flowStepResults.filter((s) => s.skipped).length;
  const indivPassCount = individualResults.filter((t) => t.pf === 'Pass').length;
  const indivFailCount = individualResults.filter((t) => t.pf !== 'Pass').length;
  const totalExecutionCount = individualResults.length + flowStepResults.length;
  const passCount = indivPassCount + flowPassCount;
  const failCount = indivFailCount + flowFailCount;
  const skipCount = flowSkipCount;
  const passRate = (totalExecutionCount - skipCount) ? Math.round((passCount / (totalExecutionCount - skipCount)) * 100) : 0;
  const filteredIndividual = individualResults.filter((t) =>
    resultFilter === 'all' ? true : resultFilter === 'pass' ? t.pf === 'Pass' : t.pf !== 'Pass'
  );

  const diffCase = diffCaseId ? allRunnable.find((c) => c.id === diffCaseId) : null;
  const diffResult = diffCaseId ? tstCase(diffCaseId) : null;
  const analysisDetailCase = analysisDetailId ? analysis?.cases.find((c) => c.id === analysisDetailId) ?? null : null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-3">
        <h2 className="text-base font-bold text-foreground">🚀 자동 실행</h2>
        <span className="text-xs text-muted-foreground">연동규격서 업로드 → 케이스 검토/수정 → 실행</span>
      </div>

      {run && (
        <div className="border-b border-border bg-muted/30 px-5 py-2.5">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {isRunning ? `실행 중 — ${runningId ?? ''}` : run.status === 'done' ? '완료' : '실패'}
            </span>
            <span className="font-medium">{run.done}/{run.total}</span>
          </div>
          <Progress value={progressPct}>
            <ProgressTrack>
              <ProgressIndicator className={run.fail > 0 ? 'bg-warning' : 'bg-success'} />
            </ProgressTrack>
          </Progress>
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col p-5">
        <TabsList>
          <TabsTrigger value="spec">규격서 분석</TabsTrigger>
          <TabsTrigger value="cases">테스트 케이스 편집</TabsTrigger>
          <TabsTrigger value="results">실행 결과</TabsTrigger>
          <TabsTrigger value="logs">로그 확인</TabsTrigger>
        </TabsList>

        <TabsContent value="spec" className="mt-4 flex min-h-0 flex-1 flex-col gap-4 overflow-auto">
          <SpecUploadDropzone onFile={handleFile} loading={parsing} />

          {analysis && (
            <div className="flex min-h-0 flex-1 flex-col gap-3">
              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3.5 py-2.5">
                <div className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{specFileName}</span> 분석 결과 — 엔드포인트 {groupedAnalysis.length}개, 케이스 {analysis.total}개
                  {analysis.baseUrl && <span> · 기본 URL: {analysis.baseUrl}</span>}
                </div>
                <Button size="sm" onClick={confirmImport} disabled={imported} className="gap-1.5">
                  {imported ? '임포트 완료 ✓' : '케이스로 임포트'}
                </Button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {groupedAnalysis.map(([key, cases]) => {
                    const [method, endpoint] = key.split(/ (.+)/);
                    return (
                      <div
                        key={key}
                        className="rounded-xl border border-border bg-card p-3.5 shadow-[var(--shadow-soft)]"
                      >
                        <div className="mb-2 flex items-center gap-2">
                          <Badge className={methodColor(method)}>{method}</Badge>
                          <span className="truncate font-mono text-xs text-foreground">{endpoint}</span>
                          <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">{cases.length}건</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          {cases.map((c) => (
                            <button
                              key={c.id}
                              onClick={() => setAnalysisDetailId(c.id)}
                              className="flex w-full items-center gap-1.5 rounded-md bg-muted/40 px-2 py-1 text-left text-[11px] hover:bg-muted/70"
                            >
                              <span className="font-mono text-primary">{c.id}</span>
                              <span className="flex-1 truncate text-foreground">{c.name}</span>
                              <Badge
                                className={cn(
                                  'text-[10px]',
                                  c.type === 'Positive' ? 'border-success/30 bg-success/15 text-success' : 'border-destructive/30 bg-destructive/15 text-destructive'
                                )}
                              >
                                {c.type}
                              </Badge>
                              <span className="shrink-0 text-[10px] text-muted-foreground">상세보기 →</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="cases" className="mt-4 flex min-h-0 flex-1 flex-col gap-3 overflow-auto">
          {/* 헤더: 요약 + 불러오기 + 실행 설정 + 실행 버튼 */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {activeFlows.length > 0 && (
                <span className="flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-primary">
                  플로우 {activeFlows.length}개 · {activeFlows.reduce((s, f) => s + f.steps.length, 0)}단계 (순서 고정)
                </span>
              )}
              <span>{selected.size}/{runnable.length} 개별 케이스 선택 (병렬)</span>
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={openSuiteModal}>
                Suite 불러오기
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={openHistoryModal}>
                히스토리에서 불러오기
              </Button>
              <div className="h-4 w-px bg-border" />
              <Input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="대상 서버 URL (예: https://api.example.com)"
                className="h-8 w-52 text-xs"
              />
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 text-xs"
                onClick={() => setHeadersOpen(true)}
              >
                헤더{(data.apiHeaders?.filter((h) => h.key.trim()).length ?? 0) > 0 && (
                  <span className="rounded-full bg-primary/15 px-1.5 text-[10px] font-semibold text-primary">
                    {data.apiHeaders!.filter((h) => h.key.trim()).length}
                  </span>
                )}
              </Button>
              <Button
                onClick={startRun}
                disabled={(selected.size === 0 && selectedFlowIds.size === 0) || isRunning}
                className="gap-1.5"
              >
                <Play className="size-4" /> 전체 수행
              </Button>
            </div>
          </div>

          {/* 플로우 섹션 */}
          <div className="rounded-xl border border-border bg-card shadow-[var(--shadow-soft)]">
            <div className="flex items-center border-b border-border px-4 py-2.5">
              <span className="text-xs font-semibold text-foreground">플로우</span>
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">— 선택 시 해당 케이스는 개별 목록에서 제외되고 순서대로 실행됩니다</span>
              <Button size="sm" variant="ghost" className="ml-auto gap-1 h-6 px-2 text-xs" onClick={openCreateFlow}>
                <Plus className="size-3" /> 플로우 추가
              </Button>
            </div>
            {flows.length === 0 ? (
              <div className="px-4 py-5 text-center text-xs text-muted-foreground">
                아직 플로우가 없습니다. 오른쪽 위 버튼으로 추가하세요.
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-border">
                {flows.map((f) => {
                  const active = selectedFlowIds.has(f.id);
                  const sortedSteps = f.steps.sort((a, b) => a.order - b.order);
                  return (
                    <div key={f.id} className={cn('px-4 py-3 transition-colors', active && 'bg-primary/5')}>
                      <div className="mb-2 flex items-center gap-2">
                        <button
                          onClick={() => toggleSelectedFlow(f.id)}
                          className={cn('size-4 shrink-0 rounded border transition-colors', active ? 'border-primary bg-primary' : 'border-border')}
                        />
                        <span className={cn('text-sm font-medium', active ? 'text-foreground' : 'text-muted-foreground')}>{f.name}</span>
                        <span className="text-xs text-muted-foreground">{f.steps.length}단계</span>
                        <div className="ml-auto flex items-center gap-0.5">
                          <Button size="icon" variant="ghost" className="size-6" onClick={() => openEditFlow(f)}>
                            <Pencil className="size-3" />
                          </Button>
                          <Button size="icon" variant="ghost" className="size-6 text-destructive hover:text-destructive" onClick={() => handleDeleteFlow(f.id)}>
                            <Trash2 className="size-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="ml-6 flex flex-wrap gap-1.5">
                        {sortedSteps.map((step, idx) => {
                          const c = allRunnable.find((r) => r.id === step.case_id);
                          return (
                            <span key={step.case_id} className={cn('flex items-center gap-1 rounded-md px-2 py-0.5 text-xs border', active ? 'border-primary/20 bg-primary/10 text-primary' : 'border-border bg-muted/40 text-muted-foreground')}>
                              <span className="opacity-60">{idx + 1}.</span>
                              <span className="font-mono">{step.case_id}</span>
                              {c && <span className="opacity-70">{c.name}</span>}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 개별 케이스 섹션 */}
          <div className="rounded-xl border border-border bg-card shadow-[var(--shadow-soft)]">
            <div className="border-b border-border px-4 py-2.5 text-xs font-semibold text-foreground">
              개별 케이스 <span className="font-normal text-muted-foreground ml-1">— 선택한 케이스는 병렬로 실행됩니다</span>
            </div>
            <CaseTable
              cases={runnable}
              results={data.tst.cases}
              cats={data.mgr.cats}
              runningId={runningId}
              selected={selected}
              onToggle={toggle}
              onToggleAll={toggleAll}
              onUpdate={updateCase}
              onShowDiff={setDiffCaseId}
            />
          </div>

          {/* 플로우 생성/편집 다이얼로그 */}
          {flowForm && (
            <Dialog open onOpenChange={(o) => { if (!o) { setFlowForm(null); setFlowEditing(null); } }}>
              <DialogContent className="w-[90vw] max-w-[90vw]">
                <DialogHeader>
                  <DialogTitle>{flowEditing ? '플로우 편집' : '새 플로우 만들기'}</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col gap-4">
                  <div>
                    <div className="mb-1 text-xs text-muted-foreground">플로우 이름</div>
                    <Input
                      value={flowForm.name}
                      onChange={(e) => setFlowForm({ ...flowForm, name: e.target.value })}
                      placeholder="예: 결제 메인 플로우"
                      className="h-8 text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* 케이스 선택 */}
                    <div>
                      <div className="mb-1.5 text-xs font-medium text-foreground">케이스 선택</div>
                      <div className="max-h-[480px] overflow-y-auto rounded-lg border border-border">
                        {allRunnable.map((c) => {
                          const included = flowForm.stepIds.includes(c.id);
                          return (
                            <button
                              key={c.id}
                              onClick={() => toggleFlowStep(c.id)}
                              className={cn(
                                'flex w-full items-center gap-2 border-b border-border/50 px-2 py-1.5 text-left text-xs last:border-0 hover:bg-muted/50',
                                included && 'bg-primary/5'
                              )}
                            >
                              <span className={cn('size-3.5 shrink-0 rounded border', included ? 'border-primary bg-primary' : 'border-border')} />
                              <span className="font-mono text-[10px] text-primary shrink-0">{c.id}</span>
                              <span className="flex-1 break-keep text-foreground">{c.name}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* 순서 지정 */}
                    <div>
                      <div className="mb-1.5 text-xs font-medium text-foreground">실행 순서</div>
                      <div className="max-h-[480px] overflow-y-auto rounded-lg border border-border">
                        {flowForm.stepIds.length === 0 ? (
                          <div className="flex h-full items-center justify-center py-8 text-xs text-muted-foreground">왼쪽에서 케이스를 선택하세요</div>
                        ) : (
                          flowForm.stepIds.map((cid, idx) => {
                            const c = allRunnable.find((r) => r.id === cid);
                            return (
                              <div key={cid} className="flex items-center gap-1.5 border-b border-border/50 px-2 py-1.5 last:border-0">
                                <span className="w-4 shrink-0 text-center text-[10px] text-muted-foreground">{idx + 1}</span>
                                <span className="flex-1 break-keep text-xs text-foreground">{c?.name || cid}</span>
                                <div className="flex shrink-0 flex-col">
                                  <button onClick={() => moveStep(idx, -1)} disabled={idx === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                                    <ChevronUp className="size-3" />
                                  </button>
                                  <button onClick={() => moveStep(idx, 1)} disabled={idx === flowForm.stepIds.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                                    <ChevronDown className="size-3" />
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={() => { setFlowForm(null); setFlowEditing(null); }}>취소</Button>
                    <Button size="sm" onClick={saveFlow} disabled={!flowForm.name.trim() || flowForm.stepIds.length === 0}>저장</Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </TabsContent>

        <TabsContent value="results" className="mt-4 min-h-0 flex-1 overflow-auto">
          {totalExecutionCount === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">아직 실행된 케이스가 없습니다</p>
          ) : (
            <div className="space-y-4">
              {/* 요약 카드 */}
              {/* 요약 — 전체/성공/실패 */}
              <div className="rounded-xl border border-border bg-card shadow-[var(--shadow-soft)]">
                <div className="grid grid-cols-3 divide-x divide-border border-b border-border">
                  <div className="px-5 py-3.5">
                    <div className="mb-1 text-[11px] text-muted-foreground">전체</div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl font-bold text-foreground">{totalExecutionCount}</span>
                      <span className="text-xs text-muted-foreground">건</span>
                    </div>
                  </div>
                  <div className="px-5 py-3.5">
                    <div className="mb-1 text-[11px] text-muted-foreground">성공</div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl font-bold text-success">{passCount}</span>
                      <span className="text-xs text-muted-foreground">건 ({passRate}%)</span>
                    </div>
                  </div>
                  <div className="px-5 py-3.5">
                    <div className="mb-1 text-[11px] text-muted-foreground">실패</div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-2xl font-bold text-destructive">{failCount}</span>
                      <span className="text-xs text-muted-foreground">건{skipCount > 0 && ` · 건너뜀 ${skipCount}건`}</span>
                    </div>
                  </div>
                </div>
                {/* 개별 + 플로우별 breakdown */}
                <div className="flex flex-wrap divide-x divide-border">
                  {individualResults.length > 0 && (
                    <div className="px-5 py-2.5">
                      <div className="text-[10px] text-muted-foreground">개별 케이스</div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-xs">
                        <span className="font-semibold text-foreground">{individualResults.length}건</span>
                        <span className="text-success">{individualResults.filter((t) => t.pf === 'Pass').length} 성공</span>
                        <span className="text-destructive">{individualResults.filter((t) => t.pf !== 'Pass').length} 실패</span>
                      </div>
                    </div>
                  )}
                  {flowRunRef.current.map((flow) => {
                    const fCases = flow.steps.map((cid) => data.tst.cases.find((t) => t.id === cid)).filter(Boolean) as typeof data.tst.cases;
                    const fPass = fCases.filter((t) => t.pf === 'Pass').length;
                    const fFail = fCases.filter((t) => t.pf !== 'Pass' && !t.actual?.includes('건너뜀')).length;
                    const fSkip = fCases.filter((t) => t.actual?.includes('건너뜀')).length;
                    const stopped = run?.flow_results?.find((r) => r.flow_id === flow.flow_id)?.status === 'stopped';
                    return (
                      <div key={flow.flow_id} className="px-5 py-2.5">
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          {flow.flow_name}
                          <span className="opacity-60">· {flow.steps.length}단계</span>
                          {stopped && <Badge className="border-destructive/30 bg-destructive/15 text-destructive text-[9px] h-3.5 px-1">중단</Badge>}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1.5 text-xs">
                          <span className="font-semibold text-foreground">{fCases.length}건</span>
                          <span className="text-success">{fPass} 성공</span>
                          <span className="text-destructive">{fFail} 실패</span>
                          {fSkip > 0 && <span className="text-muted-foreground">{fSkip} 건너뜀</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 필터 */}
              <div className="flex gap-1.5">
                {([
                  { key: 'all', label: `전체 (${totalExecutionCount})` },
                  { key: 'pass', label: `성공 (${passCount})` },
                  { key: 'fail', label: `실패 (${failCount})` },
                ] as const).map((f) => {
                  const active = resultFilter === f.key;
                  return (
                    <button
                      key={f.key}
                      onClick={() => setResultFilter(f.key)}
                      className={cn('rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors', !active && 'border-border text-muted-foreground hover:bg-muted/50')}
                      style={active ? { borderColor: 'var(--primary)', background: 'color-mix(in oklch, var(--primary) 10%, transparent)', color: 'var(--primary)' } : undefined}
                    >
                      {f.label}
                    </button>
                  );
                })}
              </div>

              {/* 플로우별 결과 */}
              {flowRunRef.current.length > 0 && flowRunRef.current.map((flow) => {
                const flowTstCases = flow.steps
                  .map((cid) => data.tst.cases.find((t) => t.id === cid))
                  .filter(Boolean) as typeof data.tst.cases;
                const filtered = flowTstCases.filter((t) =>
                  resultFilter === 'all' ? true : resultFilter === 'pass' ? t.pf === 'Pass' : t.pf !== 'Pass'
                );
                if (filtered.length === 0) return null;
                const flowPass = flowTstCases.filter((t) => t.pf === 'Pass').length;
                const flowStopped = run?.flow_results?.find((r) => r.flow_id === flow.flow_id)?.status === 'stopped';
                return (
                  <div key={flow.flow_id} className="rounded-xl border border-border bg-card shadow-[var(--shadow-soft)]">
                    <div className="flex items-center gap-2 border-b border-border px-3.5 py-2.5">
                      <span className="text-xs font-semibold text-foreground">{flow.flow_name}</span>
                      {flowStopped && <Badge className="border-destructive/30 bg-destructive/15 text-destructive text-[10px]">중단됨</Badge>}
                      <span className="ml-auto text-[11px] text-muted-foreground">{flowPass}/{flowTstCases.length} 성공</span>
                    </div>
                    <div className="flex flex-col gap-0">
                      {filtered.map((t, idx) => {
                        const pass = t.pf === 'Pass';
                        const skipped = t.actual?.includes('건너뜀');
                        return (
                          <button
                            key={t.id}
                            onClick={() => !skipped && setDiffCaseId(t.id)}
                            className={cn(
                              'flex w-full items-center gap-3 border-b border-border/50 px-3.5 py-2 text-left text-xs last:border-0',
                              !skipped && 'hover:bg-muted/50',
                              skipped && 'opacity-50 cursor-default'
                            )}
                          >
                            <span className="w-4 shrink-0 text-center text-[10px] text-muted-foreground">{idx + 1}</span>
                            <span className="font-mono text-primary">{t.id}</span>
                            <span className="flex-1 truncate text-foreground">{allRunnable.find((c) => c.id === t.id)?.name || t.id}</span>
                            <Badge className={cn(
                              'shrink-0 text-[10px]',
                              skipped ? 'border-border bg-muted text-muted-foreground' :
                              pass ? 'border-success/30 bg-success/15 text-success' : 'border-destructive/30 bg-destructive/15 text-destructive'
                            )}>
                              {skipped ? '건너뜀' : t.pf}{!skipped && ' · 상세보기 →'}
                            </Badge>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* 개별 케이스 결과 */}
              {filteredIndividual.length > 0 && (
                <div className="rounded-xl border border-border bg-card shadow-[var(--shadow-soft)]">
                  {flowRunRef.current.length > 0 && (
                    <div className="border-b border-border px-3.5 py-2.5">
                      <span className="text-xs font-semibold text-foreground">개별 케이스</span>
                      <span className="ml-2 text-[11px] text-muted-foreground">
                        {individualResults.filter((t) => t.pf === 'Pass').length}/{individualResults.length} 성공
                      </span>
                    </div>
                  )}
                  <div className="flex flex-col gap-0">
                    {filteredIndividual.map((t) => {
                      const pass = t.pf === 'Pass';
                      return (
                        <button
                          key={t.id}
                          onClick={() => setDiffCaseId(t.id)}
                          className="flex w-full items-center gap-3 border-b border-border/50 px-3.5 py-2 text-left text-xs last:border-0 hover:bg-muted/50"
                        >
                          <span className="font-mono text-primary">{t.id}</span>
                          <span className="flex-1 truncate text-foreground">{allRunnable.find((c) => c.id === t.id)?.name || t.id}</span>
                          <Badge className={pass ? 'border-success/30 bg-success/15 text-success' : 'border-destructive/30 bg-destructive/15 text-destructive'}>
                            {t.pf} · 상세보기 →
                          </Badge>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="logs" className="mt-4 flex min-h-0 flex-1 flex-col">
          <Tabs defaultValue="console-logs" className="flex min-h-0 flex-1 flex-col">
            <TabsList variant="line">
              <TabsTrigger value="console-logs">Logs</TabsTrigger>
              <TabsTrigger value="console-analysis">Analysis</TabsTrigger>
              <TabsTrigger value="console-suggestions">Suggestions</TabsTrigger>
            </TabsList>

            <TabsContent value="console-logs" className="mt-3 min-h-0 flex-1 overflow-auto">
              {orderRef.current.length === 0 && flowRunRef.current.length === 0 ? (
                <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border">
                  <p className="text-sm text-muted-foreground">실행 로그가 여기에 표시됩니다</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3 font-mono text-xs">
                  {headLog && (
                    <div className="rounded-lg border border-border bg-muted/40 px-3.5 py-2 font-semibold text-foreground">
                      {headLog}
                    </div>
                  )}

                  {/* 개별 케이스 섹션 */}
                  {orderRef.current.length > 0 && (
                    <div className="rounded-xl border border-border bg-card shadow-[var(--shadow-soft)]">
                      <div className="flex items-center gap-2 border-b border-border px-3.5 py-2">
                        <span className="font-semibold text-foreground">개별 케이스</span>
                        <span className="text-[10px] text-muted-foreground">{orderRef.current.length}건 · 병렬 실행</span>
                        <span className="ml-auto text-[10px] text-muted-foreground">
                          {orderRef.current.filter((cid) => caseLogs[cid]?.done).length}/{orderRef.current.length} 완료
                        </span>
                      </div>
                      <div className="flex flex-col divide-y divide-border/50">
                        {orderRef.current.map((cid) => {
                          const entry = caseLogs[cid];
                          if (!entry) return null;
                          const icon = !entry.done ? '⏳' : entry.pass === false ? '✗' : '✓';
                          return (
                            <div
                              key={cid}
                              className={cn(
                                'px-3.5 py-2',
                                entry.pass === false && 'bg-destructive/5',
                                entry.pass === true && 'bg-success/5'
                              )}
                            >
                              <div className={cn(
                                'flex items-center gap-1.5',
                                entry.pass === false ? 'text-destructive' : entry.pass === true ? 'text-success' : 'text-muted-foreground'
                              )}>
                                <span>{icon}</span>
                                <span className="font-mono font-semibold">{cid}</span>
                                <span className="text-[10px] opacity-70">{entry.done ? '완료' : '대기 중'}</span>
                              </div>
                              {entry.summary && (
                                <div className="ml-4 mt-0.5 truncate text-[10px] text-muted-foreground">{entry.summary}</div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* 플로우 섹션 — 각 플로우별 카드 */}
                  {flowRunRef.current.map((flow) => {
                    const doneCount = flow.steps.filter((cid) => caseLogs[cid]?.done).length;
                    const failCount = flow.steps.filter((cid) => caseLogs[cid]?.done && caseLogs[cid]?.pass === false && caseLogs[cid]?.summary !== '건너뜀 (이전 단계 실패)').length;
                    const stopped = run?.flow_results?.find((r) => r.flow_id === flow.flow_id)?.status === 'stopped';
                    return (
                      <div key={flow.flow_id} className="rounded-xl border border-border bg-card shadow-[var(--shadow-soft)]">
                        <div className="flex items-center gap-2 border-b border-border px-3.5 py-2">
                          <span className="font-semibold text-foreground">플로우: {flow.flow_name}</span>
                          <span className="text-[10px] text-muted-foreground">{flow.steps.length}단계 · 순차 실행</span>
                          {stopped && <Badge className="border-destructive/30 bg-destructive/15 text-destructive text-[10px] h-4">중단됨</Badge>}
                          <span className="ml-auto text-[10px] text-muted-foreground">
                            {doneCount}/{flow.steps.length} 완료{failCount > 0 ? ` · ${failCount}건 실패` : ''}
                          </span>
                        </div>
                        <div className="flex flex-col divide-y divide-border/50">
                          {flow.steps.map((cid, idx) => {
                            const entry = caseLogs[cid];
                            if (!entry) return null;
                            const skipped = entry.summary === '건너뜀 (이전 단계 실패)';
                            const icon = !entry.done ? '⏳' : skipped ? '⊘' : entry.pass === false ? '✗' : '✓';
                            return (
                              <div
                                key={cid}
                                className={cn(
                                  'px-3.5 py-2',
                                  skipped && 'opacity-50',
                                  !skipped && entry.pass === false && 'bg-destructive/5',
                                  !skipped && entry.pass === true && 'bg-success/5'
                                )}
                              >
                                <div className={cn(
                                  'flex items-center gap-1.5',
                                  skipped ? 'text-muted-foreground' : entry.pass === false ? 'text-destructive' : entry.pass === true ? 'text-success' : 'text-muted-foreground'
                                )}>
                                  <span className="w-4 shrink-0 text-center text-[10px] text-muted-foreground">{idx + 1}.</span>
                                  <span>{icon}</span>
                                  <span className="font-mono font-semibold">{cid}</span>
                                  <span className="text-[10px] opacity-70">
                                    {entry.done ? (skipped ? '건너뜀' : '완료') : '대기 중'}
                                  </span>
                                </div>
                                {entry.summary && !skipped && (
                                  <div className="ml-9 mt-0.5 truncate text-[10px] text-muted-foreground">{entry.summary}</div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                  {tailLog && (
                    <div className="rounded-lg border border-border bg-muted/40 px-3.5 py-2 font-semibold text-foreground">
                      {tailLog}
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            <TabsContent value="console-analysis" className="mt-3 min-h-0 flex-1 overflow-auto">
              <div className="flex h-full flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border text-center">
                <p className="text-sm text-muted-foreground">LLM 기반 실패 원인 분석은 추후 연동됩니다</p>
                <Button variant="outline" size="sm" disabled>분석 실행 (준비 중)</Button>
              </div>
            </TabsContent>

            <TabsContent value="console-suggestions" className="mt-3 min-h-0 flex-1 overflow-auto">
              <div className="flex h-full flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border text-center">
                <p className="text-sm text-muted-foreground">LLM 기반 수정 제안은 추후 연동됩니다</p>
                <Button variant="outline" size="sm" disabled>제안 받기 (준비 중)</Button>
              </div>
            </TabsContent>
          </Tabs>
        </TabsContent>

      </Tabs>

      {/* 히스토리에서 불러오기 모달 */}
      {historyModalOpen && (
        <Dialog open onOpenChange={(o) => { if (!o) setHistoryModalOpen(false); }}>
          <DialogContent className="w-[560px] max-w-[90vw]">
            <DialogHeader>
              <DialogTitle>히스토리에서 불러오기</DialogTitle>
            </DialogHeader>
            <p className="text-xs text-muted-foreground">선택하면 케이스·플로우·URL이 세팅됩니다. 실행은 직접 버튼을 눌러 진행하세요.</p>
            <div className="mt-1 max-h-[60vh] overflow-y-auto">
              {history.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">완료된 실행 기록이 없습니다</p>
              ) : (
                <div className="flex flex-col divide-y divide-border">
                  {history.map((r) => {
                    const rate = r.total ? Math.round(((r.total - r.fail) / r.total) * 100) : 0;
                    const date = r.finished_at ? new Date(r.finished_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-';
                    return (
                      <button
                        key={r.id}
                        onClick={() => restoreFromHistory(r.id)}
                        className="flex w-full items-center gap-3 px-1 py-3 text-left hover:bg-muted/40 transition-colors"
                      >
                        <span className={cn('text-sm font-bold w-12 shrink-0', r.fail === 0 ? 'text-success' : rate >= 50 ? 'text-warning' : 'text-destructive')}>
                          {rate}%
                        </span>
                        <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                          <span className="truncate text-sm font-medium text-foreground">{r.label || `Run #${r.id}`}</span>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            <span>{r.total}건</span>
                            <span className="text-success">{r.total - r.fail}P</span>
                            <span className="text-destructive">{r.fail}F</span>
                            {r.flow_ids.length > 0 && <span>· 플로우 {r.flow_ids.length}개</span>}
                            <span className="truncate">{r.base_url}</span>
                          </div>
                        </div>
                        <span className="shrink-0 text-[11px] text-muted-foreground">{date}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            {onGoHistory && (
              <div className="border-t border-border pt-3 text-center">
                <button onClick={onGoHistory} className="text-xs text-primary hover:underline">
                  전체 히스토리 보기 →
                </button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}

      {suiteModalOpen && (
        <Dialog open onOpenChange={(o) => { if (!o) setSuiteModalOpen(false); }}>
          <DialogContent className="w-[480px] max-w-[90vw]">
            <DialogHeader>
              <DialogTitle>Suite 불러오기</DialogTitle>
            </DialogHeader>
            <p className="text-xs text-muted-foreground">선택하면 케이스·플로우가 자동 세팅됩니다. 실행은 직접 버튼을 눌러 진행하세요.</p>
            <div className="mt-1 max-h-[60vh] overflow-y-auto">
              {suiteList.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">저장된 Suite가 없습니다</p>
              ) : (
                <div className="flex flex-col divide-y divide-border">
                  {suiteList.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => applySuite(s)}
                      className="flex w-full flex-col gap-1 px-1 py-3 text-left transition-colors hover:bg-muted/40"
                    >
                      <div className="flex items-center gap-2">
                        <span className="flex-1 text-sm font-medium text-foreground">{s.name}</span>
                        {s.is_default && <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">기본</span>}
                      </div>
                      <div className="flex gap-3 text-[11px] text-muted-foreground">
                        <span>케이스 {s.case_ids.length}건</span>
                        <span>플로우 {s.flow_ids.length}개</span>
                        {s.description && <span className="truncate">{s.description}</span>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {analysisDetailCase && (
        <Dialog open={!!analysisDetailId} onOpenChange={(o) => { if (!o) setAnalysisDetailId(null); }}>
          <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className="font-mono">{analysisDetailCase.id}</span>
                <Badge
                  className={
                    analysisDetailCase.type === 'Positive'
                      ? 'border-success/30 bg-success/15 text-success'
                      : 'border-destructive/30 bg-destructive/15 text-destructive'
                  }
                >
                  {analysisDetailCase.type}
                </Badge>
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-3 text-sm">
              <div>
                <div className="mb-1 text-[11px] text-muted-foreground">테스트 항목명</div>
                <div>{analysisDetailCase.name}</div>
              </div>
              <div>
                <div className="mb-1 text-[11px] text-muted-foreground">호출</div>
                <div className="rounded-md border border-border bg-muted/30 px-3 py-2 font-mono text-xs">
                  <Badge className={cn('mr-1.5', methodColor(analysisDetailCase.method))}>{analysisDetailCase.method}</Badge>
                  {analysisDetailCase.endpoint}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md border border-border px-3 py-2">
                  <div className="mb-1 text-[11px] text-muted-foreground">카테고리</div>
                  <div className="text-xs">{analysisDetailCase.catName || '-'}</div>
                </div>
                <div className="rounded-md border border-border px-3 py-2">
                  <div className="mb-1 text-[11px] text-muted-foreground">기대 상태코드</div>
                  <div className="text-xs">{analysisDetailCase.expectedStatus}</div>
                </div>
              </div>
              <div>
                <div className="mb-1 text-[11px] text-muted-foreground">기대 결과</div>
                <div className="rounded-md border border-border px-3 py-2 text-xs">{analysisDetailCase.expected}</div>
              </div>
              {!!analysisDetailCase.headers?.length && (
                <div>
                  <div className="mb-1 text-[11px] text-muted-foreground">헤더 (Headers)</div>
                  <div className="flex flex-col gap-1">
                    {analysisDetailCase.headers.map((h, i) => (
                      <div key={i} className="flex justify-between rounded-md bg-muted/40 px-2 py-1 font-mono text-[11px]">
                        <span className="text-foreground">{h.key}</span>
                        <span className="text-muted-foreground">{h.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {!!analysisDetailCase.queryParams?.length && (
                <div>
                  <div className="mb-1 text-[11px] text-muted-foreground">쿼리 파라미터 (Query Params)</div>
                  <div className="flex flex-col gap-1">
                    {analysisDetailCase.queryParams.map((q, i) => (
                      <div key={i} className="flex justify-between rounded-md bg-muted/40 px-2 py-1 font-mono text-[11px]">
                        <span className="text-foreground">{q.key}</span>
                        <span className="text-muted-foreground">{q.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {!!analysisDetailCase.body && (
                <div>
                  <div className="mb-1 text-[11px] text-muted-foreground">Body</div>
                  <pre className="overflow-auto rounded-md border border-border bg-muted/30 px-3 py-2 text-[11px]">{analysisDetailCase.body}</pre>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {headersOpen && (
        <Dialog open onOpenChange={(o) => { if (!o) setHeadersOpen(false); }}>
          <DialogContent className="w-[480px] max-w-[90vw]">
            <DialogHeader>
              <DialogTitle>기본 헤더 설정</DialogTitle>
            </DialogHeader>
            <p className="text-xs text-muted-foreground">모든 API 요청에 공통으로 적용할 헤더입니다. 케이스별 헤더가 있으면 케이스 헤더가 우선합니다.</p>
            <div className="mt-3 flex flex-col gap-1">
              {(data.apiHeaders ?? []).map((h, i) => (
                <div key={i} className="flex gap-1.5">
                  <input
                    placeholder="헤더 이름 (예: Authorization)"
                    value={h.key}
                    onChange={(e) => {
                      const next = [...(data.apiHeaders ?? [])];
                      next[i] = { ...next[i], key: e.target.value };
                      setApiHeaders(next);
                    }}
                    className="h-8 flex-1 rounded-md border border-input bg-background px-2 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <input
                    placeholder="헤더 값 (예: Bearer abc123)"
                    value={h.value}
                    onChange={(e) => {
                      const next = [...(data.apiHeaders ?? [])];
                      next[i] = { ...next[i], value: e.target.value };
                      setApiHeaders(next);
                    }}
                    className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2 text-destructive"
                    onClick={() => setApiHeaders((data.apiHeaders ?? []).filter((_, j) => j !== i))}
                  >✕</Button>
                </div>
              ))}
              {(data.apiHeaders ?? []).length === 0 && (
                <p className="rounded-md border border-dashed border-border py-3 text-center text-xs text-muted-foreground">헤더 없음</p>
              )}
            </div>
            <div className="mt-2 flex justify-between">
              <Button size="sm" variant="outline" onClick={() => setApiHeaders([...(data.apiHeaders ?? []), { key: '', value: '' }])}>
                + 헤더 추가
              </Button>
              <Button size="sm" onClick={() => setHeadersOpen(false)}>닫기</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {diffCase && (
        <DiffViewer
          open={!!diffCaseId}
          onClose={() => setDiffCaseId(null)}
          caseId={diffCase.id}
          method={diffCase.method}
          endpoint={diffCase.endpoint}
          expected={diffCase.expected}
          actual={diffResult?.actual || ''}
          notes={diffResult?.notes}
          pf={diffResult?.pf}
        />
      )}
    </div>
  );
}
