import { useState } from 'react';
import { toast } from 'sonner';
import { analyze, type AnalysisMode } from '../api/analysis';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import { cn } from '../lib/utils';

interface Props {
  projectId: number;
  onClose: () => void;
}

const MODES: { key: AnalysisMode; label: string }[] = [
  { key: 'testcase', label: '📝 테스트 결과 분석' },
  { key: 'deploy', label: '🚀 배포 분석' },
  { key: 'business', label: '💼 비즈니스 로직 분석' },
];

export default function AnalysisModal({ projectId, onClose }: Props) {
  const [mode, setMode] = useState<AnalysisMode>('testcase');
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    setLoading(true);
    setError('');
    setResult('');
    try {
      const res = await analyze(projectId, mode, question || undefined);
      setResult(res.result);
      toast.success('분석이 완료되었습니다');
    } catch (e: any) {
      const msg = e?.response?.data?.detail || 'LLM 분석 요청에 실패했습니다';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>🤖 AI 분석 (로컬 LLM)</DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap gap-1.5">
          {MODES.map((m) => {
            const active = mode === m.key;
            return (
              <button
                key={m.key}
                onClick={() => setMode(m.key)}
                className={cn(
                  'rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors',
                  !active && 'border-border text-muted-foreground'
                )}
                style={active ? {
                  borderColor: 'var(--primary)',
                  background: 'color-mix(in oklch, var(--primary) 10%, transparent)',
                  color: 'var(--primary)',
                } : undefined}
              >
                {m.label}
              </button>
            );
          })}
        </div>

        <div>
          <label className="mb-1 block text-[11px] text-muted-foreground">추가 질문 (선택)</label>
          <Textarea rows={2} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="예: 가장 위험한 영역이 어디인가요?" className="text-xs" />
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}
        {result && (
          <div className="max-h-80 overflow-y-auto whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-3.5 text-sm leading-relaxed">
            {result}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>닫기</Button>
          <Button onClick={run} disabled={loading}>
            {loading ? '분석 중...' : '분석 실행'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
