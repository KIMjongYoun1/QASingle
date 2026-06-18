import type { TestCase, TstExecution } from '../../types/qa';
import type { RunStatus } from '../../api/runs';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';

export interface FlowRunItem {
  flow_id: number;
  flow_name: string;
  steps: string[];
}

interface Props {
  totalExecutionCount: number;
  passCount: number;
  failCount: number;
  skipCount: number;
  passRate: number;
  individualResults: TstExecution[];
  filteredIndividual: TstExecution[];
  flowRuns: FlowRunItem[];
  resultFilter: 'all' | 'pass' | 'fail';
  onResultFilterChange: (f: 'all' | 'pass' | 'fail') => void;
  allRunnable: TestCase[];
  tstCases: TstExecution[];
  run: RunStatus | null;
  onShowDiff: (id: string) => void;
}

export default function ResultsTab({
  totalExecutionCount, passCount, failCount, skipCount, passRate,
  individualResults, filteredIndividual, flowRuns,
  resultFilter, onResultFilterChange,
  allRunnable, tstCases, run,
  onShowDiff,
}: Props) {
  if (totalExecutionCount === 0) {
    return <p className="py-16 text-center text-sm text-muted-foreground">아직 실행된 케이스가 없습니다</p>;
  }

  return (
    <div className="space-y-4">
      {/* 요약 카드 */}
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
          {flowRuns.map((flow) => {
            const fCases = flow.steps.map((cid) => tstCases.find((t) => t.id === cid)).filter(Boolean) as TstExecution[];
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
              onClick={() => onResultFilterChange(f.key)}
              className={cn('rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors', !active && 'border-border text-muted-foreground hover:bg-muted/50')}
              style={active ? { borderColor: 'var(--primary)', background: 'color-mix(in oklch, var(--primary) 10%, transparent)', color: 'var(--primary)' } : undefined}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* 플로우별 결과 */}
      {flowRuns.length > 0 && flowRuns.map((flow) => {
        const flowTstCases = flow.steps.map((cid) => tstCases.find((t) => t.id === cid)).filter(Boolean) as TstExecution[];
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
                    onClick={() => !skipped && onShowDiff(t.id)}
                    className={cn(
                      'flex w-full items-center gap-3 border-b border-border/50 px-3.5 py-2 text-left text-xs last:border-0',
                      !skipped && 'hover:bg-muted/50',
                      skipped && 'opacity-50 cursor-default'
                    )}
                  >
                    <span className="w-4 shrink-0 text-center text-[10px] text-muted-foreground">{idx + 1}</span>
                    <span className="font-mono text-primary">{t.id}</span>
                    <span className="flex-1 truncate text-foreground">{allRunnable.find((c) => c.id === t.id)?.name || t.id}</span>
                    <Badge className={cn('shrink-0 text-[10px]',
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
          {flowRuns.length > 0 && (
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
                  onClick={() => onShowDiff(t.id)}
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
  );
}
