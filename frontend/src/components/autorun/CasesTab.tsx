import type { TestCase, TestFlow, Category, KV, TstExecution } from '../../types/qa';
import CaseTable from '../CaseTable';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Play, Plus, Trash2, Pencil } from 'lucide-react';
import { cn } from '../../lib/utils';

interface Props {
  flows: TestFlow[];
  selectedFlowIds: Set<number>;
  activeFlows: TestFlow[];
  runnable: TestCase[];
  allRunnable: TestCase[];
  selected: Set<string>;
  baseUrl: string;
  headers: KV[];
  isRunning: boolean;
  runningId: string | null;
  results: TstExecution[];
  cats: Category[];
  onStartRun: () => void;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onToggleFlow: (flowId: number) => void;
  onOpenCreateFlow: () => void;
  onOpenEditFlow: (f: TestFlow) => void;
  onDeleteFlow: (flowId: number) => void;
  onBaseUrlChange: (url: string) => void;
  onOpenHeaders: () => void;
  onOpenSuite: () => void;
  onOpenHistory: () => void;
  onShowDiff: (id: string) => void;
  onUpdateCase: (id: string, patch: Partial<TestCase>) => void;
}

export default function CasesTab({
  flows, selectedFlowIds, activeFlows, runnable, allRunnable,
  selected, baseUrl, headers, isRunning, runningId,
  results, cats,
  onStartRun, onToggle, onToggleAll, onToggleFlow,
  onOpenCreateFlow, onOpenEditFlow, onDeleteFlow,
  onBaseUrlChange, onOpenHeaders, onOpenSuite, onOpenHistory,
  onShowDiff, onUpdateCase,
}: Props) {
  const headerCount = headers.filter((h) => h.key.trim()).length;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto">
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
          <Button variant="outline" size="sm" className="gap-1.5" onClick={onOpenSuite}>
            Suite 불러오기
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={onOpenHistory}>
            히스토리에서 불러오기
          </Button>
          <div className="h-4 w-px bg-border" />
          <Input
            value={baseUrl}
            onChange={(e) => onBaseUrlChange(e.target.value)}
            placeholder="대상 서버 URL (예: https://api.example.com)"
            className="h-8 w-52 text-xs"
          />
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={onOpenHeaders}>
            헤더{headerCount > 0 && (
              <span className="rounded-full bg-primary/15 px-1.5 text-[10px] font-semibold text-primary">
                {headerCount}
              </span>
            )}
          </Button>
          <Button
            onClick={onStartRun}
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
          <Button size="sm" variant="ghost" className="ml-auto gap-1 h-6 px-2 text-xs" onClick={onOpenCreateFlow}>
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
              const sortedSteps = [...f.steps].sort((a, b) => a.order - b.order);
              return (
                <div key={f.id} className={cn('px-4 py-3 transition-colors', active && 'bg-primary/5')}>
                  <div className="mb-2 flex items-center gap-2">
                    <button
                      onClick={() => onToggleFlow(f.id)}
                      className={cn('size-4 shrink-0 rounded border transition-colors', active ? 'border-primary bg-primary' : 'border-border')}
                    />
                    <span className={cn('text-sm font-medium', active ? 'text-foreground' : 'text-muted-foreground')}>{f.name}</span>
                    <span className="text-xs text-muted-foreground">{f.steps.length}단계</span>
                    <div className="ml-auto flex items-center gap-0.5">
                      <Button size="icon" variant="ghost" className="size-6" onClick={() => onOpenEditFlow(f)}>
                        <Pencil className="size-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="size-6 text-destructive hover:text-destructive" onClick={() => onDeleteFlow(f.id)}>
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
          results={results}
          cats={cats}
          runningId={runningId}
          selected={selected}
          onToggle={onToggle}
          onToggleAll={onToggleAll}
          onUpdate={onUpdateCase}
          onShowDiff={onShowDiff}
        />
      </div>
    </div>
  );
}
