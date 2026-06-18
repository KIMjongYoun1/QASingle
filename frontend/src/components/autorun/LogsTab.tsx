import type { RunStatus } from '../../api/runs';
import type { FlowRunItem } from './ResultsTab';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { cn } from '../../lib/utils';

type CaseLogEntry = { done: boolean; pass?: boolean; summary?: string };

interface Props {
  orderCaseIds: string[];
  flowRuns: FlowRunItem[];
  caseLogs: Record<string, CaseLogEntry>;
  headLog: string;
  tailLog: string;
  run: RunStatus | null;
}

export default function LogsTab({ orderCaseIds, flowRuns, caseLogs, headLog, tailLog, run }: Props) {
  const hasLogs = orderCaseIds.length > 0 || flowRuns.length > 0;

  return (
    <Tabs defaultValue="console-logs" className="flex min-h-0 flex-1 flex-col">
      <TabsList variant="line">
        <TabsTrigger value="console-logs">Logs</TabsTrigger>
        <TabsTrigger value="console-analysis">Analysis</TabsTrigger>
        <TabsTrigger value="console-suggestions">Suggestions</TabsTrigger>
      </TabsList>

      <TabsContent value="console-logs" className="mt-3 min-h-0 flex-1 overflow-auto">
        {!hasLogs ? (
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
            {orderCaseIds.length > 0 && (
              <div className="rounded-xl border border-border bg-card shadow-[var(--shadow-soft)]">
                <div className="flex items-center gap-2 border-b border-border px-3.5 py-2">
                  <span className="font-semibold text-foreground">개별 케이스</span>
                  <span className="text-[10px] text-muted-foreground">{orderCaseIds.length}건 · 병렬 실행</span>
                  <span className="ml-auto text-[10px] text-muted-foreground">
                    {orderCaseIds.filter((cid) => caseLogs[cid]?.done).length}/{orderCaseIds.length} 완료
                  </span>
                </div>
                <div className="flex flex-col divide-y divide-border/50">
                  {orderCaseIds.map((cid) => {
                    const entry = caseLogs[cid];
                    if (!entry) return null;
                    const icon = !entry.done ? '⏳' : entry.pass === false ? '✗' : '✓';
                    return (
                      <div
                        key={cid}
                        className={cn('px-3.5 py-2', entry.pass === false && 'bg-destructive/5', entry.pass === true && 'bg-success/5')}
                      >
                        <div className={cn('flex items-center gap-1.5',
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

            {/* 플로우 섹션 */}
            {flowRuns.map((flow) => {
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
                          <div className={cn('flex items-center gap-1.5',
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
  );
}
