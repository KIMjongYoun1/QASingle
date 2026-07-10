import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useQAStore } from '../store/useQAStore';
import { createRun, getRun, listRuns, type RunStatus, type RunSummary } from '../api/runs';
import { parseOpenApi, type ParsedOpenApiCase } from '../api/openapi';
import { listFlows, createFlow, updateFlow, deleteFlow } from '../api/flows';
import type { TestFlow, FlowStep } from '../types/qa';
import DiffViewer from '../components/DiffViewer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Progress, ProgressTrack, ProgressIndicator } from '../components/ui/progress';

import SpecAnalysisTab from '../components/autorun/SpecAnalysisTab';
import CasesTab from '../components/autorun/CasesTab';
import ResultsTab, { type FlowRunItem } from '../components/autorun/ResultsTab';
import LogsTab from '../components/autorun/LogsTab';
import FlowFormDialog from '../components/autorun/FlowFormDialog';
import HistoryRestoreModal from '../components/autorun/HistoryRestoreModal';
import SuiteSelectModal from '../components/autorun/SuiteSelectModal';
import AnalysisDetailModal from '../components/autorun/AnalysisDetailModal';
import HeadersEditDialog from '../components/autorun/HeadersEditDialog';
import { parseNotes } from '../components/DiffViewer';
import type { TestSuite } from '../api/suites';

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

  // ── 실행 상태 ────────────────────────────────────────────────
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [baseUrl, setBaseUrl] = useState(data.apiBaseUrl || '');
  const [run, setRun] = useState<RunStatus | null>(null);
  const [headLog, setHeadLog] = useState('');
  const [tailLog, setTailLog] = useState('');
  const [caseLogs, setCaseLogs] = useState<Record<string, { done: boolean; pass?: boolean; summary?: string }>>({});
  const [resultFilter, setResultFilter] = useState<'all' | 'pass' | 'fail'>('all');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const orderRef = useRef<string[]>([]);
  const flowRunRef = useRef<FlowRunItem[]>([]);
  const doneCountRef = useRef(0);

  // ── UI 상태 ──────────────────────────────────────────────────
  const [tab, setTab] = useState('spec');
  const [diffCaseId, setDiffCaseId] = useState<string | null>(null);
  const [headersOpen, setHeadersOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [suiteModalOpen, setSuiteModalOpen] = useState(false);
  const [analysisDetailId, setAnalysisDetailId] = useState<string | null>(null);

  // ── 규격서 분석 ──────────────────────────────────────────────
  const [specFileName, setSpecFileName] = useState('');
  const [parsing, setParsing] = useState(false);
  const [analysis, setAnalysis] = useState<{ cases: ParsedOpenApiCase[]; categories: string[]; baseUrl: string; total: number } | null>(null);
  const [imported, setImported] = useState(false);

  // ── 플로우 ───────────────────────────────────────────────────
  const [flows, setFlows] = useState<TestFlow[]>([]);
  const [selectedFlowIds, setSelectedFlowIds] = useState<Set<number>>(new Set());
  const [flowEditing, setFlowEditing] = useState<TestFlow | null>(null);
  const [flowForm, setFlowForm] = useState<{ name: string; steps: FlowStep[] } | null>(null);

  // ── 히스토리 / Suite ─────────────────────────────────────────
  const [history, setHistory] = useState<RunSummary[]>([]);
  const [suiteList, setSuiteList] = useState<TestSuite[]>([]);

  // ── 파생 값 ──────────────────────────────────────────────────
  const allRunnable = useMemo(() => data.mgr.cases.filter((c) => c.endpoint), [data.mgr.cases]);
  const selectedFlowCaseIds = useMemo(() => {
    const ids = new Set<string>();
    flows.filter((f) => selectedFlowIds.has(f.id)).forEach((f) => f.steps.forEach((s) => ids.add(s.case_id)));
    return ids;
  }, [flows, selectedFlowIds]);
  const runnable = useMemo(() => allRunnable.filter((c) => !selectedFlowCaseIds.has(c.id)), [allRunnable, selectedFlowCaseIds]);
  const activeFlows = useMemo(() => flows.filter((f) => selectedFlowIds.has(f.id)), [flows, selectedFlowIds]);

  const isRunning = run?.status === 'running' || run?.status === 'pending';
  const runningId = isRunning ? orderRef.current[run!.done] ?? null : null;
  const progressPct = run && run.total ? Math.round((run.done / run.total) * 100) : 0;

  const flowCaseIds = new Set(flowRunRef.current.flatMap((f) => f.steps));
  const currentRunCaseIds = new Set([...orderRef.current, ...flowRunRef.current.flatMap((f) => f.steps)]);
  const executedResults = run
    ? data.tst.cases.filter((t) => t.actual && currentRunCaseIds.has(t.id) && allRunnable.some((c) => c.id === t.id))
    : [];
  const individualResults = executedResults.filter((t) => !flowCaseIds.has(t.id));

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
  const diffResult = diffCaseId ? data.tst.cases.find((c) => c.id === diffCaseId) : null;
  const analysisDetailCase = analysisDetailId ? analysis?.cases.find((c) => c.id === analysisDetailId) ?? null : null;

  // ── Effects ──────────────────────────────────────────────────
  useEffect(() => { setBaseUrl(data.apiBaseUrl || ''); }, [data.apiBaseUrl]);
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);
  useEffect(() => {
    if (projectId) listFlows(projectId).then(setFlows).catch(() => {});
  }, [projectId]);
  useEffect(() => {
    if (!pendingRunRestore) return;
    setSelected(new Set(pendingRunRestore.caseIds));
    setSelectedFlowIds(new Set(pendingRunRestore.flowIds.map(Number)));
    if (pendingRunRestore.baseUrl) setBaseUrl(pendingRunRestore.baseUrl);
    setPendingRunRestore(null);
    setTab('cases');
    toast.success(`${pendingRunRestore.sourceLabel ? `"${pendingRunRestore.sourceLabel}" ` : ''}히스토리 설정이 자동실행에 적용되었습니다.`);
  }, [pendingRunRestore]);
  useEffect(() => {
    if (selectedFlowCaseIds.size === 0) return;
    setSelected((prev) => {
      const next = new Set(prev);
      let changed = false;
      selectedFlowCaseIds.forEach((id) => { if (next.has(id)) { next.delete(id); changed = true; } });
      return changed ? next : prev;
    });
  }, [selectedFlowCaseIds]);

  // ── 핸들러 ───────────────────────────────────────────────────
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

  const confirmImport = async () => {
    if (!analysis) return;
    try {
      await importCases(analysis.cases, analysis.categories);
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || '임포트에 실패했습니다');
      return;
    }
    if (analysis.baseUrl) setApiBaseUrl(analysis.baseUrl);
    toast.success(`${analysis.total}개 케이스 임포트 완료${analysis.baseUrl ? ` (기본 URL: ${analysis.baseUrl})` : ''}`);
    setImported(true);
    setTab('cases');
  };

  const openCreateFlow = () => { setFlowEditing(null); setFlowForm({ name: '', steps: [] }); };
  const openEditFlow = (f: TestFlow) => {
    setFlowEditing(f);
    setFlowForm({ name: f.name, steps: [...f.steps].sort((a, b) => a.order - b.order) });
  };
  const closeFlowForm = () => { setFlowForm(null); setFlowEditing(null); };

  const saveFlow = async () => {
    if (!flowForm || !projectId) return;
    const steps = flowForm.steps.map((s, i) => ({ ...s, order: i }));
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
      closeFlowForm();
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
    const arr = [...flowForm.steps];
    const target = idx + dir;
    if (target < 0 || target >= arr.length) return;
    [arr[idx], arr[target]] = [arr[target], arr[idx]];
    setFlowForm({ ...flowForm, steps: arr });
  };

  const toggleFlowStep = (caseId: string) => {
    if (!flowForm) return;
    const exists = flowForm.steps.some((s) => s.case_id === caseId);
    const steps = exists
      ? flowForm.steps.filter((s) => s.case_id !== caseId)
      : [...flowForm.steps, { case_id: caseId, order: flowForm.steps.length }];
    setFlowForm({ ...flowForm, steps });
  };

  const updateStepExtract = (caseId: string, field: 'extract_path' | 'extract_var', value: string) => {
    if (!flowForm) return;
    setFlowForm({
      ...flowForm,
      steps: flowForm.steps.map((s) => (s.case_id === caseId ? { ...s, [field]: value } : s)),
    });
  };

  const toggleSelectedFlow = (flowId: number) => {
    setSelectedFlowIds((prev) => {
      const n = new Set(prev);
      n.has(flowId) ? n.delete(flowId) : n.add(flowId);
      return n;
    });
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

  const applySuite = (suite: TestSuite) => {
    setSelected(new Set(suite.case_ids));
    setSelectedFlowIds(new Set(suite.flow_ids));
    setSuiteModalOpen(false);
    setTab('cases');
    toast.success(`Suite "${suite.name}" 적용 — 케이스 ${suite.case_ids.length}건 · 플로우 ${suite.flow_ids.length}개`);
  };

  const restoreFromHistory = async (runId: number) => {
    const detail = await getRun(runId);
    setSelected(new Set(detail.case_ids ?? []));
    setSelectedFlowIds(new Set((detail.flow_ids ?? []).map(Number)));
    if (detail.base_url) setBaseUrl(detail.base_url);
    setHistoryModalOpen(false);
    setTab('cases');
    toast.success('이전 실행 설정을 불러왔습니다. 확인 후 실행하세요.');
  };

  const startRun = async () => {
    if (!projectId) return;
    if (selected.size === 0 && selectedFlowIds.size === 0) return;
    if (baseUrl.trim() && data.apiBaseUrl !== baseUrl) setApiBaseUrl(baseUrl);

    const flowIds = Array.from(selectedFlowIds);
    const selectedFlows = flows.filter((f) => selectedFlowIds.has(f.id));
    const flowCaseIdSet = new Set(selectedFlows.flatMap((f) => f.steps.map((s) => s.case_id)));

    orderRef.current = data.mgr.cases.filter((c) => selected.has(c.id) && c.endpoint && !flowCaseIdSet.has(c.id)).map((c) => c.id);
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
      try { status = await getRun(run_id); } catch (e) { console.error(e); return; }
      doneCountRef.current = status.done;

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
            orderRef.current.forEach((cid) => {
              const t = finalCases.find((c) => c.id === cid);
              const pass = t?.pf === 'Pass';
              const { reqLine, resBody } = parseNotes(t?.notes || '');
              const summary = `${reqLine || ''} → ${resBody ? resBody.split('\n')[0].slice(0, 100) : t?.actual || ''}`.trim();
              next[cid] = { done: true, pass, summary };
            });
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
          const pr = status.total ? Math.round(((status.total - status.fail) / status.total) * 100) : 0;
          setTailLog(`■ 실행 완료 — Pass율 ${pr}% (${status.total - status.fail}/${status.total})`);
          toast.success(`실행 완료 — Pass율 ${pr}% (${status.total - status.fail}/${status.total})`);
        } else {
          setTailLog(`■ 실행 실패: ${status.error}`);
          toast.error(`실행 실패: ${status.error}`);
        }
      }
    }, 1000);
  };

  // ── 렌더 ────────────────────────────────────────────────────
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
          <SpecAnalysisTab
            analysis={analysis}
            specFileName={specFileName}
            parsing={parsing}
            imported={imported}
            onFile={handleFile}
            onConfirmImport={confirmImport}
            onAnalysisDetail={setAnalysisDetailId}
          />
        </TabsContent>

        <TabsContent value="cases" className="mt-4 flex min-h-0 flex-1 flex-col gap-3 overflow-auto">
          <CasesTab
            flows={flows}
            selectedFlowIds={selectedFlowIds}
            activeFlows={activeFlows}
            runnable={runnable}
            allRunnable={allRunnable}
            selected={selected}
            baseUrl={baseUrl}
            headers={data.apiHeaders ?? []}
            isRunning={isRunning}
            runningId={runningId}
            results={data.tst.cases}
            cats={data.mgr.cats}
            onStartRun={startRun}
            onToggle={toggle}
            onToggleAll={toggleAll}
            onToggleFlow={toggleSelectedFlow}
            onOpenCreateFlow={openCreateFlow}
            onOpenEditFlow={openEditFlow}
            onDeleteFlow={handleDeleteFlow}
            onBaseUrlChange={setBaseUrl}
            onOpenHeaders={() => setHeadersOpen(true)}
            onOpenSuite={openSuiteModal}
            onOpenHistory={openHistoryModal}
            onShowDiff={setDiffCaseId}
            onUpdateCase={updateCase}
          />
        </TabsContent>

        <TabsContent value="results" className="mt-4 min-h-0 flex-1 overflow-auto">
          <ResultsTab
            totalExecutionCount={totalExecutionCount}
            passCount={passCount}
            failCount={failCount}
            skipCount={skipCount}
            passRate={passRate}
            individualResults={individualResults}
            filteredIndividual={filteredIndividual}
            flowRuns={flowRunRef.current}
            resultFilter={resultFilter}
            onResultFilterChange={setResultFilter}
            allRunnable={allRunnable}
            tstCases={data.tst.cases}
            run={run}
            onShowDiff={setDiffCaseId}
          />
        </TabsContent>

        <TabsContent value="logs" className="mt-4 flex min-h-0 flex-1 flex-col">
          <LogsTab
            orderCaseIds={orderRef.current}
            flowRuns={flowRunRef.current}
            caseLogs={caseLogs}
            headLog={headLog}
            tailLog={tailLog}
            run={run}
          />
        </TabsContent>
      </Tabs>

      {/* 모달들 */}
      {flowForm && (
        <FlowFormDialog
          flowForm={flowForm}
          flowEditing={flowEditing}
          allRunnable={allRunnable}
          onClose={closeFlowForm}
          onSave={saveFlow}
          onMoveStep={moveStep}
          onToggleStep={toggleFlowStep}
          onUpdateExtract={updateStepExtract}
          onNameChange={(name) => setFlowForm({ ...flowForm, name })}
        />
      )}
      {historyModalOpen && (
        <HistoryRestoreModal
          history={history}
          onRestore={restoreFromHistory}
          onGoHistory={onGoHistory}
          onClose={() => setHistoryModalOpen(false)}
        />
      )}
      {suiteModalOpen && (
        <SuiteSelectModal
          suiteList={suiteList}
          onApply={applySuite}
          onClose={() => setSuiteModalOpen(false)}
        />
      )}
      {analysisDetailCase && (
        <AnalysisDetailModal
          caseData={analysisDetailCase}
          onClose={() => setAnalysisDetailId(null)}
        />
      )}
      {headersOpen && (
        <HeadersEditDialog
          headers={data.apiHeaders ?? []}
          onChange={setApiHeaders}
          onClose={() => setHeadersOpen(false)}
        />
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
