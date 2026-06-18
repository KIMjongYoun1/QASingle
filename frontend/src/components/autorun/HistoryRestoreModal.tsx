import type { RunSummary } from '../../api/runs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { cn } from '../../lib/utils';

interface Props {
  history: RunSummary[];
  onRestore: (runId: number) => void;
  onGoHistory?: () => void;
  onClose: () => void;
}

export default function HistoryRestoreModal({ history, onRestore, onGoHistory, onClose }: Props) {
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
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
                const date = r.finished_at
                  ? new Date(r.finished_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
                  : '-';
                return (
                  <button
                    key={r.id}
                    onClick={() => onRestore(r.id)}
                    className="flex w-full items-center gap-3 px-1 py-3 text-left transition-colors hover:bg-muted/40"
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
  );
}
