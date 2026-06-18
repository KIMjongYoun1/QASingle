import type { ParsedOpenApiCase } from '../../api/openapi';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';

interface Props {
  caseData: ParsedOpenApiCase;
  onClose: () => void;
}

function methodColor(m?: string) {
  switch ((m || '').toUpperCase()) {
    case 'GET':    return 'border-primary/30 bg-primary/15 text-primary';
    case 'POST':   return 'border-success/30 bg-success/15 text-success';
    case 'PUT':
    case 'PATCH':  return 'border-warning/30 bg-warning/15 text-warning';
    case 'DELETE': return 'border-destructive/30 bg-destructive/15 text-destructive';
    default:       return 'border-border bg-muted text-muted-foreground';
  }
}

export default function AnalysisDetailModal({ caseData: c, onClose }: Props) {
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="font-mono">{c.id}</span>
            <Badge className={c.type === 'Positive' ? 'border-success/30 bg-success/15 text-success' : 'border-destructive/30 bg-destructive/15 text-destructive'}>
              {c.type}
            </Badge>
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 text-sm">
          <div>
            <div className="mb-1 text-[11px] text-muted-foreground">테스트 항목명</div>
            <div>{c.name}</div>
          </div>
          <div>
            <div className="mb-1 text-[11px] text-muted-foreground">호출</div>
            <div className="rounded-md border border-border bg-muted/30 px-3 py-2 font-mono text-xs">
              <Badge className={cn('mr-1.5', methodColor(c.method))}>{c.method}</Badge>
              {c.endpoint}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-md border border-border px-3 py-2">
              <div className="mb-1 text-[11px] text-muted-foreground">카테고리</div>
              <div className="text-xs">{c.catName || '-'}</div>
            </div>
            <div className="rounded-md border border-border px-3 py-2">
              <div className="mb-1 text-[11px] text-muted-foreground">기대 상태코드</div>
              <div className="text-xs">{c.expectedStatus}</div>
            </div>
          </div>
          <div>
            <div className="mb-1 text-[11px] text-muted-foreground">기대 결과</div>
            <div className="rounded-md border border-border px-3 py-2 text-xs">{c.expected}</div>
          </div>
          {!!c.headers?.length && (
            <div>
              <div className="mb-1 text-[11px] text-muted-foreground">헤더 (Headers)</div>
              <div className="flex flex-col gap-1">
                {c.headers.map((h, i) => (
                  <div key={i} className="flex justify-between rounded-md bg-muted/40 px-2 py-1 font-mono text-[11px]">
                    <span className="text-foreground">{h.key}</span>
                    <span className="text-muted-foreground">{h.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {!!c.queryParams?.length && (
            <div>
              <div className="mb-1 text-[11px] text-muted-foreground">쿼리 파라미터 (Query Params)</div>
              <div className="flex flex-col gap-1">
                {c.queryParams.map((q, i) => (
                  <div key={i} className="flex justify-between rounded-md bg-muted/40 px-2 py-1 font-mono text-[11px]">
                    <span className="text-foreground">{q.key}</span>
                    <span className="text-muted-foreground">{q.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {!!c.body && (
            <div>
              <div className="mb-1 text-[11px] text-muted-foreground">Body</div>
              <pre className="overflow-auto rounded-md border border-border bg-muted/30 px-3 py-2 text-[11px]">{c.body}</pre>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
