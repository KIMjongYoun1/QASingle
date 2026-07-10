import type { TestCase, TestFlow, FlowStep } from '../../types/qa';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';

interface Props {
  flowForm: { name: string; steps: FlowStep[] };
  flowEditing: TestFlow | null;
  allRunnable: TestCase[];
  onClose: () => void;
  onSave: () => void;
  onMoveStep: (idx: number, dir: -1 | 1) => void;
  onToggleStep: (caseId: string) => void;
  onUpdateExtract: (caseId: string, field: 'extract_path' | 'extract_var', value: string) => void;
  onNameChange: (name: string) => void;
}

export default function FlowFormDialog({ flowForm, flowEditing, allRunnable, onClose, onSave, onMoveStep, onToggleStep, onUpdateExtract, onNameChange }: Props) {
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="w-[90vw] max-w-[90vw]">
        <DialogHeader>
          <DialogTitle>{flowEditing ? '플로우 편집' : '새 플로우 만들기'}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div>
            <div className="mb-1 text-xs text-muted-foreground">플로우 이름</div>
            <Input
              value={flowForm.name}
              onChange={(e) => onNameChange(e.target.value)}
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
                  const included = flowForm.steps.some((s) => s.case_id === c.id);
                  return (
                    <button
                      key={c.id}
                      onClick={() => onToggleStep(c.id)}
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
                {flowForm.steps.length === 0 ? (
                  <div className="flex h-full items-center justify-center py-8 text-xs text-muted-foreground">왼쪽에서 케이스를 선택하세요</div>
                ) : (
                  flowForm.steps.map((step, idx) => {
                    const c = allRunnable.find((r) => r.id === step.case_id);
                    return (
                      <div key={step.case_id} className="border-b border-border/50 px-2 py-1.5 last:border-0">
                        <div className="flex items-center gap-1.5">
                          <span className="w-4 shrink-0 text-center text-[10px] text-muted-foreground">{idx + 1}</span>
                          <span className="flex-1 break-keep text-xs text-foreground">{c?.name || step.case_id}</span>
                          <div className="flex shrink-0 flex-col">
                            <button onClick={() => onMoveStep(idx, -1)} disabled={idx === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                              <ChevronUp className="size-3" />
                            </button>
                            <button onClick={() => onMoveStep(idx, 1)} disabled={idx === flowForm.steps.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30">
                              <ChevronDown className="size-3" />
                            </button>
                          </div>
                        </div>
                        {idx < flowForm.steps.length - 1 && (
                          <div className="mt-1 flex items-center gap-1 pl-5">
                            <Input
                              value={step.extract_path ?? ''}
                              onChange={(e) => onUpdateExtract(step.case_id, 'extract_path', e.target.value)}
                              placeholder="추출 JSON path (예: data.cards[0].cardId)"
                              className="h-6 flex-1 text-[10px]"
                            />
                            <Input
                              value={step.extract_var ?? ''}
                              onChange={(e) => onUpdateExtract(step.case_id, 'extract_var', e.target.value)}
                              placeholder="변수명 (예: cardId)"
                              className="h-6 w-28 shrink-0 text-[10px]"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
              <div className="mt-1 text-[10px] text-muted-foreground">
                이 스텝 응답에서 값을 뽑아 이후 스텝의 endpoint/헤더/바디에 <code>{'{{변수명}}'}</code>으로 사용할 수 있습니다.
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>취소</Button>
            <Button size="sm" onClick={onSave} disabled={!flowForm.name.trim() || flowForm.steps.length === 0}>저장</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
