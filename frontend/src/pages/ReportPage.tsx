import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useQAStore } from '../store/useQAStore';
import { listFlows } from '../api/flows';
import type { TestFlow } from '../types/qa';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { cn } from '../lib/utils';
import { exportJSON, exportExcel, exportMarkdown, parseJSONReport, parseExcelReport, parseMarkdownReport } from '../lib/reportExport';
import { DonutChart } from '../components/DonutChart';

interface Props {
  mode: 'tst' | 'dep';
  projectName?: string | null;
  focusCase?: { tree: 'tst' | 'dep'; id: string; nonce: number } | null;
}

export default function ReportPage({ mode, projectName, focusCase }: Props) {
  const data = useQAStore((s) => s.data);
  const updateExec = useQAStore((s) => s.updateExec);
  const updateCover = useQAStore((s) => s.updateCover);
  const restoreReport = useQAStore((s) => s.restoreReport);
  const mgrCases = data.mgr.cases;
  const section = data[mode];
  const cats = section.cats;
  const pfOptions = mode === 'tst' ? ['Pass', 'Fail', 'N/A'] : ['완료', '미완료', '스킵'];

  const isDone = (pf: string) => pf === 'Pass' || pf === '완료';
  const isFail = (pf: string) => pf === 'Fail' || pf === '미완료';
  const statusColor = (pf: string) => (isDone(pf) ? 'success' : isFail(pf) ? 'destructive' : 'warning');

  const tot = section.cases.length;
  const done = section.cases.filter((c) => isDone(c.pf)).length;
  const failN = section.cases.filter((c) => isFail(c.pf)).length;
  const rate = tot ? Math.round((done / tot) * 100) : 0;

  const cover = section.cover as unknown as Record<string, string>;

  const coverFields: [string, string][] = mode === 'tst'
    ? [['company', '회사/부서명'], ['project', '프로젝트명'], ['system', '시스템명'], ['version', '버전'], ['docNumber', '문서번호'], ['start', '시작일'], ['end', '종료일'], ['environment', '테스트 환경'], ['author', '작성자'], ['approver', '승인자'], ['date', '작성일']]
    : [['company', '회사/부서명'], ['project', '프로젝트명'], ['version', '배포 버전'], ['environment', '배포 환경'], ['docNumber', '문서번호'], ['deployType', '배포 유형'], ['start', '배포 시작'], ['end', '배포 완료'], ['deployer', '배포자'], ['approver', '승인자'], ['date', '작성일'], ['target', '대상 서버'], ['summary', '배포 내용 요약']];

  const projectId = useQAStore((s) => s.projectId);
  const [flows, setFlows] = useState<TestFlow[]>([]);
  useEffect(() => {
    if (projectId) listFlows(projectId).then(setFlows).catch(() => {});
  }, [projectId]);

  // 플로우에 속한 케이스 ID 집합
  const flowCaseIdSet = new Set(flows.flatMap((f) => f.steps.map((s) => s.case_id)));

  const caseRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const name = projectName || 'qa';

  const [statusFilter, setStatusFilter] = useState<'done' | 'fail' | null>(null);
  const [catFilter, setCatFilter] = useState<string | null>(null);
  const [flowFilter, setFlowFilter] = useState<number | null>(null);
  const toggleStatusFilter = (v: 'done' | 'fail') => setStatusFilter((p) => (p === v ? null : v));
  const toggleCatFilter = (id: string) => { setCatFilter((p) => (p === id ? null : id)); setFlowFilter(null); };
  const toggleFlowFilter = (id: number) => { setFlowFilter((p) => (p === id ? null : id)); setCatFilter(null); };
  const matchesCase = (c: { pf: string; catId?: string; id?: string }): boolean =>
    (statusFilter === null || (statusFilter === 'done' ? isDone(c.pf) : isFail(c.pf))) &&
    (catFilter === null || (catFilter === '__u__' ? !c.catId : c.catId === catFilter)) &&
    (flowFilter === null || !!flows.find((f) => f.id === flowFilter)?.steps.some((s) => s.case_id === c.id));
  const cardTone = (pf: string) =>
    isDone(pf)
      ? 'border-success/50 border-l-success bg-success/10'
      : isFail(pf)
        ? 'border-destructive/50 border-l-destructive bg-destructive/10'
        : 'border-border bg-card';
  const filterCats = cats.concat(section.cases.some((c) => !c.catId) ? [{ id: '__u__', name: '미분류', color: '#94a3b8' }] : []);
  const hasFilter = statusFilter || catFilter || flowFilter;

  const FilterBar = () => (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card px-3.5 py-3">
      {/* 행 1: 결과 상태 */}
      <div className="flex items-center gap-2">
        <span className="w-14 shrink-0 text-[10px] font-semibold text-muted-foreground">결과</span>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setStatusFilter(null)}
            className={cn('rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-colors',
              statusFilter === null ? 'border-foreground/40 bg-foreground/10 text-foreground' : 'border-border text-muted-foreground hover:bg-muted/50')}
          >전체</button>
          <button
            onClick={() => toggleStatusFilter('done')}
            className={cn('rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-colors',
              statusFilter === 'done' ? 'border-success bg-success text-success-foreground' : 'border-border text-muted-foreground hover:bg-muted/50')}
          >{mode === 'tst' ? 'PASS' : '완료'}</button>
          <button
            onClick={() => toggleStatusFilter('fail')}
            className={cn('rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-colors',
              statusFilter === 'fail' ? 'border-destructive bg-destructive text-destructive-foreground' : 'border-border text-muted-foreground hover:bg-muted/50')}
          >{mode === 'tst' ? 'FAIL' : '미완료'}</button>
        </div>
      </div>

      {/* 행 2: 카테고리 */}
      {filterCats.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="w-14 shrink-0 text-[10px] font-semibold text-muted-foreground">카테고리</span>
          <div className="flex flex-wrap gap-1.5">
            {filterCats.map((cat) => (
              <button
                key={cat.id}
                onClick={() => toggleCatFilter(cat.id)}
                className={cn('rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-colors', catFilter !== cat.id && 'border-border text-muted-foreground hover:bg-muted/50')}
                style={catFilter === cat.id ? { borderColor: cat.color, background: `color-mix(in oklch, ${cat.color} 14%, transparent)`, color: cat.color } : undefined}
              >{cat.name}</button>
            ))}
          </div>
        </div>
      )}

      {/* 행 3: 플로우 */}
      {flows.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="w-14 shrink-0 text-[10px] font-semibold text-muted-foreground">플로우</span>
          <div className="flex flex-wrap gap-1.5">
            {flows.map((f) => (
              <button
                key={f.id}
                onClick={() => toggleFlowFilter(f.id)}
                className={cn('rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-colors',
                  flowFilter === f.id ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted/50')}
              >{f.name}</button>
            ))}
          </div>
        </div>
      )}

      {/* 초기화 */}
      {hasFilter && (
        <div className="flex justify-end">
          <button onClick={() => { setStatusFilter(null); setCatFilter(null); setFlowFilter(null); }}
            className="text-[11px] text-muted-foreground underline hover:text-foreground">필터 초기화</button>
        </div>
      )}
    </div>
  );

  useEffect(() => {
    if (!focusCase) return;
    const el = caseRefs.current.get(focusCase.id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightId(focusCase.id);
    const t = setTimeout(() => setHighlightId(null), 1800);
    return () => clearTimeout(t);
  }, [focusCase]);

  const handleExport = (fn: () => void) => {
    try {
      fn();
      toast.success('다운로드를 시작했습니다');
    } catch (e) {
      console.error(e);
      toast.error('다운로드에 실패했습니다');
    }
  };

  const handleRestoreFile = async (file: File) => {
    try {
      const ext = file.name.split('.').pop()?.toLowerCase();
      let result;
      if (ext === 'json') result = await parseJSONReport(file);
      else if (ext === 'xlsx' || ext === 'xls') result = await parseExcelReport(file, mode);
      else if (ext === 'md') result = await parseMarkdownReport(file, mode);
      else throw new Error('지원하지 않는 파일 형식입니다 (json/xlsx/md)');
      restoreReport(mode, { cover: result.cover, cases: result.cases as any }, (result as any).catNames);
      toast.success('결과서를 복원했습니다');
    } catch (e: any) {
      toast.error(e?.message || '복원에 실패했습니다');
    }
  };

  return (
    <div className="grid h-full" style={{ gridTemplateColumns: 'clamp(240px,22vw,340px) 1fr' }}>
      <div className="flex flex-col gap-4 overflow-y-auto border-r border-border bg-card p-3.5">
        <div>
          <div className="mb-2.5 text-xs font-semibold text-warning">📋 {mode === 'tst' ? '표지 정보' : '배포 정보'}</div>
          {coverFields.map(([key, label]) => (
            <div key={key} className="mb-2">
              <label className="mb-1 block text-[11px] text-muted-foreground">{label}</label>
              {key === 'summary' ? (
                <Textarea rows={2} value={cover[key] || ''} onChange={(e) => updateCover(mode, { [key]: e.target.value })} className="text-xs" />
              ) : key === 'start' || key === 'end' || key === 'date' ? (
                <Input type="datetime-local" value={cover[key] || ''} onChange={(e) => updateCover(mode, { [key]: e.target.value })} className="h-8 text-xs" />
              ) : (
                <Input value={cover[key] || ''} onChange={(e) => updateCover(mode, { [key]: e.target.value })} className="h-8 text-xs" />
              )}
            </div>
          ))}
        </div>

        <div>
          <div className="mb-2.5 text-xs font-semibold text-warning">
            📊 항목 목록 ({section.cases.filter(matchesCase).length}/{section.cases.length}건)
          </div>
          <div className="mb-2.5">
            <FilterBar />
          </div>
          <div className="flex flex-col gap-1.5">
            {section.cases.filter(matchesCase).map((c) => {
              const mc = mgrCases.find((m) => m.id === c.id);
              const color = statusColor(c.pf);
              const belongsToFlow = flowCaseIdSet.has(c.id);
              const flowName = belongsToFlow ? flows.find((f) => f.steps.some((s) => s.case_id === c.id))?.name : null;
              return (
                <div key={c.id} className={cn('flex items-center gap-1.5 rounded-md border px-2 py-1.5', cardTone(c.pf))}>
                  <span className="font-mono text-[11px] text-primary">{c.id}</span>
                  <div className="flex flex-1 min-w-0 flex-col">
                    <span className="truncate text-xs">{mc?.name || c.id}</span>
                    {flowName && <span className="text-[10px] text-primary/70 truncate">↳ {flowName}</span>}
                  </div>
                  <Badge
                    className={cn(
                      'border-transparent font-bold shrink-0',
                      color === 'success' && 'bg-success text-success-foreground',
                      color === 'destructive' && 'bg-destructive text-destructive-foreground',
                      color === 'warning' && 'bg-warning text-warning-foreground'
                    )}
                  >
                    {c.pf}
                  </Badge>
                </div>
              );
            })}
            {section.cases.length === 0 && (
              <p className="py-1.5 text-center text-[11px] text-muted-foreground">케이스관리에서 케이스를 추가하세요</p>
            )}
            {section.cases.length > 0 && section.cases.filter(matchesCase).length === 0 && (
              <p className="py-1.5 text-center text-[11px] text-muted-foreground">필터에 해당하는 항목이 없습니다</p>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-y-auto p-5">
        <div className="mb-4 flex items-center justify-end gap-1.5">
          <input
            ref={fileRef}
            type="file"
            accept=".json,.xlsx,.xls,.md"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleRestoreFile(f);
              e.target.value = '';
            }}
          />
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>📂 복원</Button>
          <Button variant="outline" size="sm" onClick={() => handleExport(() => exportJSON(mode, data, name))}>JSON</Button>
          <Button variant="outline" size="sm" onClick={() => handleExport(() => exportExcel(mode, data, mgrCases, name, matchesCase))}>Excel</Button>
          <Button variant="outline" size="sm" onClick={() => handleExport(() => exportMarkdown(mode, data, mgrCases, name))}>MD</Button>
        </div>
        <div className="mb-3 flex items-stretch gap-3.5">
          <div className="flex flex-1 items-center justify-center rounded-lg border border-border bg-card py-3.5">
            <DonutChart
              segments={[
                { value: done, color: 'var(--success)' },
                { value: failN, color: 'var(--destructive)' },
              ]}
              total={tot}
              centerLabel={`${rate}%`}
              centerSub={mode === 'tst' ? '통과율' : '완료율'}
            />
          </div>
          {([
            ['전체 항목', tot, 'text-primary'],
            [mode === 'tst' ? 'PASS' : '완료', done, 'text-success'],
            [mode === 'tst' ? 'FAIL' : '미완료', failN, 'text-destructive'],
            [mode === 'tst' ? '통과율' : '완료율', `${rate}%`, 'text-primary'],
          ] as const).map(([label, val, color]) => (
            <div key={label} className="flex flex-1 flex-col items-center justify-center rounded-lg border border-border bg-card py-3.5 text-center">
              <div className={`text-2xl font-extrabold ${color}`}>{val}</div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">{label}</div>
            </div>
          ))}
        </div>
        <div className="mb-4">
          <FilterBar />
        </div>

        {/* 플로우 섹션 — 플로우에 속한 케이스를 업무 단위로 묶어 표시 */}
        {mode === 'tst' && flows.filter((f) => f.steps.some((s) => section.cases.find((c) => c.id === s.case_id))).map((flow) => {
          const sortedSteps = flow.steps.slice().sort((a, b) => a.order - b.order);
          const flowCases = sortedSteps
            .map((s) => section.cases.find((c) => c.id === s.case_id))
            .filter((c): c is typeof section.cases[number] => !!c && matchesCase(c));
          if (!flowCases.length) return null;
          const flowPass = flowCases.filter((c) => isDone(c.pf)).length;
          const flowFail = flowCases.filter((c) => isFail(c.pf)).length;
          return (
            <div key={flow.id} className="mb-6">
              <div className="mb-2.5 flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
                <span className="text-[0.95rem] font-bold text-primary">{flow.name}</span>
                <span className="text-xs text-muted-foreground">플로우 · {flow.steps.length}단계</span>
                <div className="ml-auto flex items-center gap-2 text-xs">
                  <span className="text-success font-medium">Pass {flowPass}</span>
                  <span className="text-destructive font-medium">Fail {flowFail}</span>
                </div>
              </div>
              {flowCases.map((c, idx) => {
                const mc = mgrCases.find((m) => m.id === c.id);
                return (
                  <div
                    key={c.id}
                    ref={(el) => { if (el) caseRefs.current.set(c.id, el); else caseRefs.current.delete(c.id); }}
                    className={cn('mb-2.5 rounded-lg border-2 transition-shadow', cardTone(c.pf), highlightId === c.id && 'ring-2 ring-primary border-primary')}
                  >
                    <div className="flex items-center gap-2 border-b border-border px-3.5 py-2.5">
                      <span className="text-[10px] text-muted-foreground w-5 text-center">{idx + 1}.</span>
                      <span className="font-mono text-xs font-bold text-primary">{c.id}</span>
                      <span className="flex-1 text-sm font-semibold">{mc?.name || c.id}</span>
                      <Badge className={cn('border-transparent font-bold', isDone(c.pf) && 'bg-success text-success-foreground', isFail(c.pf) && 'bg-destructive text-destructive-foreground', !isDone(c.pf) && !isFail(c.pf) && 'bg-warning text-warning-foreground')}>{c.pf}</Badge>
                    </div>
                    <div className="flex flex-col gap-2 px-3.5 py-2.5">
                      {mc?.input && <div className="text-sm"><span className="text-muted-foreground">입력값: </span>{mc.input}</div>}
                      <div className="text-sm"><span className="text-muted-foreground">기대 결과: </span>{mc?.expected || '-'}</div>
                      <div>
                        <label className="mb-1 block text-[11px] text-muted-foreground">실제 결과</label>
                        <Textarea rows={2} value={c.actual} onChange={(e) => updateExec(mode, c.id, 'actual', e.target.value)} className="text-xs" />
                      </div>
                      <div className="flex gap-1.5">
                        {pfOptions.map((opt) => {
                          const active = c.pf === opt;
                          const color = statusColor(opt);
                          return (
                            <button key={opt} onClick={() => updateExec(mode, c.id, 'pf', opt)}
                              className={cn('rounded-md border px-2.5 py-1 text-[11px] font-bold transition-colors', !active && 'border-border text-muted-foreground', active && color === 'success' && 'border-success bg-success text-success-foreground', active && color === 'destructive' && 'border-destructive bg-destructive text-destructive-foreground', active && color === 'warning' && 'border-warning bg-warning text-warning-foreground')}>
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <div><label className="mb-1 block text-[11px] text-muted-foreground">수행자</label><Input value={c.owner} onChange={(e) => updateExec(mode, c.id, 'owner', e.target.value)} className="h-8 text-xs" /></div>
                        <div><label className="mb-1 block text-[11px] text-muted-foreground">수행일자</label><Input type="datetime-local" value={c.date} onChange={(e) => updateExec(mode, c.id, 'date', e.target.value)} className="h-8 text-xs" /></div>
                      </div>
                      <div><label className="mb-1 block text-[11px] text-muted-foreground">비고</label><Textarea rows={1} value={c.notes} onChange={(e) => updateExec(mode, c.id, 'notes', e.target.value)} className="text-xs" /></div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}

        {/* 카테고리별 섹션 — 플로우에 속하지 않은 케이스만 표시 */}
        {filterCats.map((cat) => {
          const items = (cat.id === '__u__' ? section.cases.filter((c) => !c.catId) : section.cases.filter((c) => c.catId === cat.id)).filter((c) => !flowCaseIdSet.has(c.id)).filter(matchesCase);
          if (!items.length) return null;
          return (
            <div key={cat.id} className="mb-6">
              <div className="mb-2.5 flex items-center gap-2 border-l-[6px] pl-2.5" style={{ borderColor: cat.color }}>
                <span className="text-[0.95rem] font-bold">{cat.name}</span>
                <span className="text-xs text-muted-foreground">({items.length}건)</span>
              </div>
              {items.map((c) => {
                const mc = mgrCases.find((m) => m.id === c.id);
                return (
                  <div
                    key={c.id}
                    ref={(el) => { if (el) caseRefs.current.set(c.id, el); else caseRefs.current.delete(c.id); }}
                    className={cn(
                      'mb-2.5 rounded-lg border-2 transition-shadow',
                      cardTone(c.pf),
                      highlightId === c.id && 'ring-2 ring-primary border-primary'
                    )}
                  >
                    <div className="flex items-center gap-2 border-b border-border px-3.5 py-2.5">
                      <span className="font-mono text-xs font-bold text-primary">{c.id}</span>
                      <span className="flex-1 text-sm font-semibold">{mc?.name || c.id}</span>
                      <Badge
                        className={cn(
                          'border-transparent font-bold',
                          isDone(c.pf) && 'bg-success text-success-foreground',
                          isFail(c.pf) && 'bg-destructive text-destructive-foreground',
                          !isDone(c.pf) && !isFail(c.pf) && 'bg-warning text-warning-foreground'
                        )}
                      >
                        {c.pf}
                      </Badge>
                    </div>
                    <div className="flex flex-col gap-2 px-3.5 py-2.5">
                      {mc?.input && (
                        <div className="text-sm"><span className="text-muted-foreground">입력값: </span>{mc.input}</div>
                      )}
                      <div className="text-sm">
                        <span className="text-muted-foreground">{mode === 'tst' ? '기대 결과' : '확인 기준'}: </span>{mc?.expected || '-'}
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] text-muted-foreground">{mode === 'tst' ? '실제 결과' : '확인 결과'}</label>
                        <Textarea rows={2} value={c.actual} onChange={(e) => updateExec(mode, c.id, 'actual', e.target.value)} className="text-xs" />
                      </div>
                      <div className="flex gap-1.5">
                        {pfOptions.map((opt) => {
                          const active = c.pf === opt;
                          const color = statusColor(opt);
                          return (
                            <button
                              key={opt}
                              onClick={() => updateExec(mode, c.id, 'pf', opt)}
                              className={cn(
                                'rounded-md border px-2.5 py-1 text-[11px] font-bold transition-colors',
                                !active && 'border-border text-muted-foreground',
                                active && color === 'success' && 'border-success bg-success text-success-foreground',
                                active && color === 'destructive' && 'border-destructive bg-destructive text-destructive-foreground',
                                active && color === 'warning' && 'border-warning bg-warning text-warning-foreground'
                              )}
                            >
                              {opt}
                            </button>
                          );
                        })}
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <div>
                          <label className="mb-1 block text-[11px] text-muted-foreground">수행자</label>
                          <Input value={c.owner} onChange={(e) => updateExec(mode, c.id, 'owner', e.target.value)} className="h-8 text-xs" />
                        </div>
                        <div>
                          <label className="mb-1 block text-[11px] text-muted-foreground">수행일자</label>
                          <Input type="datetime-local" value={c.date} onChange={(e) => updateExec(mode, c.id, 'date', e.target.value)} className="h-8 text-xs" />
                        </div>
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] text-muted-foreground">비고</label>
                        <Textarea rows={1} value={c.notes} onChange={(e) => updateExec(mode, c.id, 'notes', e.target.value)} className="text-xs" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
        {section.cases.length === 0 && (
          <p className="py-11 text-center text-muted-foreground">케이스 관리에서 케이스를 추가해주세요</p>
        )}
        {section.cases.length > 0 && section.cases.filter(matchesCase).length === 0 && (
          <p className="py-11 text-center text-muted-foreground">필터에 해당하는 항목이 없습니다</p>
        )}
      </div>
    </div>
  );
}
