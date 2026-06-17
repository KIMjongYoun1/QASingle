import { Badge } from './ui/badge';
import { cn } from '../lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

interface Props {
  open: boolean;
  onClose: () => void;
  caseId: string;
  method?: string;
  endpoint?: string;
  expected: string;
  actual: string;
  notes?: string;
  pf?: string;
}

export function parseNotes(notes: string) {
  const lines = notes.split('\n');
  const reqLine = lines.find((l) => l.startsWith('[Request]'))?.replace('[Request] ', '');
  const resLine = lines.find((l) => l.startsWith('[Response') || l.startsWith('[Error]'));
  const isError = resLine?.startsWith('[Error]') ?? false;
  const resBody = resLine?.replace(/^\[(Response \d+|Error)\]\s*/, '') ?? '';
  return { reqLine, resBody, isError };
}

export default function DiffViewer({ open, onClose, caseId, method, endpoint, expected, actual, notes, pf }: Props) {
  const { reqLine, resBody, isError } = parseNotes(notes || '');

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-2xl md:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="font-mono">{caseId}</span>
            {pf && (
              <Badge className={pf === 'Pass' ? 'border-success/30 bg-success/15 text-success' : 'border-destructive/30 bg-destructive/15 text-destructive'}>
                {pf}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div>
            <div className="mb-1.5 text-xs font-semibold text-muted-foreground">호출</div>
            <div className="rounded-md border border-border bg-muted/30 px-3 py-2 font-mono text-xs">
              {reqLine || `${method ?? ''} ${endpoint ?? ''}`.trim() || '(요청 정보 없음)'}
            </div>
          </div>

          <div>
            <div className="mb-1.5 text-xs font-semibold text-muted-foreground">응답</div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-md border border-border px-3 py-2">
                <div className="mb-1 text-[11px] text-muted-foreground">기대 결과</div>
                <div className="text-sm">{expected || '-'}</div>
              </div>
              <div
                className={cn(
                  'rounded-md border px-3 py-2',
                  isError ? 'border-destructive/30' : 'border-border'
                )}
              >
                <div className="mb-1 text-[11px] text-muted-foreground">실제 결과</div>
                <div className={cn('text-sm', isError && 'text-destructive')}>{actual || '-'}</div>
              </div>
            </div>
            {resBody && (
              <pre className="mt-2 max-h-[60vh] overflow-auto rounded-md border border-border bg-muted/30 px-3 py-2 text-xs whitespace-pre-wrap break-all">
                {resBody}
              </pre>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
