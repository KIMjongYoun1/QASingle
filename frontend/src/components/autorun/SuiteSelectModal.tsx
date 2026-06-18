import type { TestSuite } from '../../api/suites';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';

interface Props {
  suiteList: TestSuite[];
  onApply: (suite: TestSuite) => void;
  onClose: () => void;
}

export default function SuiteSelectModal({ suiteList, onApply, onClose }: Props) {
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
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
                  onClick={() => onApply(s)}
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
  );
}
