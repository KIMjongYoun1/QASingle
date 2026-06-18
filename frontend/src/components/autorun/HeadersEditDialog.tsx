import type { KV } from '../../types/qa';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';

interface Props {
  headers: KV[];
  onChange: (headers: KV[]) => void;
  onClose: () => void;
}

export default function HeadersEditDialog({ headers, onChange, onClose }: Props) {
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="w-[480px] max-w-[90vw]">
        <DialogHeader>
          <DialogTitle>기본 헤더 설정</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">모든 API 요청에 공통으로 적용할 헤더입니다. 케이스별 헤더가 있으면 케이스 헤더가 우선합니다.</p>
        <div className="mt-3 flex flex-col gap-1">
          {headers.map((h, i) => (
            <div key={i} className="flex gap-1.5">
              <input
                placeholder="헤더 이름 (예: Authorization)"
                value={h.key}
                onChange={(e) => {
                  const next = [...headers];
                  next[i] = { ...next[i], key: e.target.value };
                  onChange(next);
                }}
                className="h-8 flex-1 rounded-md border border-input bg-background px-2 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <input
                placeholder="헤더 값 (예: Bearer abc123)"
                value={h.value}
                onChange={(e) => {
                  const next = [...headers];
                  next[i] = { ...next[i], value: e.target.value };
                  onChange(next);
                }}
                className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <Button
                size="sm"
                variant="ghost"
                className="h-8 px-2 text-destructive"
                onClick={() => onChange(headers.filter((_, j) => j !== i))}
              >✕</Button>
            </div>
          ))}
          {headers.length === 0 && (
            <p className="rounded-md border border-dashed border-border py-3 text-center text-xs text-muted-foreground">헤더 없음</p>
          )}
        </div>
        <div className="mt-2 flex justify-between">
          <Button size="sm" variant="outline" onClick={() => onChange([...headers, { key: '', value: '' }])}>
            + 헤더 추가
          </Button>
          <Button size="sm" onClick={onClose}>닫기</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
