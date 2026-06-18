import { useState } from 'react';
import { toast } from 'sonner';
import { analyze, type AnalysisMode, type LLMProvider } from '../api/analysis';
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

const PROVIDERS: { value: LLMProvider; label: string; desc: string }[] = [
  { value: 'local', label: 'Local (Ollama)', desc: '로컬 모델 — ollama serve 실행 필요' },
  { value: 'claude', label: 'Claude API',    desc: '외부 API — ANTHROPIC_API_KEY 필요' },
];

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
  const [provider, setProvider] = useState<LLMProvider>('local');
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    setLoading(true);
    setError('');
    setResult('');
    try {
      const res = await analyze(projectId, mode, question || undefined, provider);
      setResult(res.result);
      toast.success(`분석 완료 (${res.provider})`);
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
          <DialogTitle>🤖 AI 분석</DialogTitle>
        </DialogHeader>

        {/* LLM 프로바이더 선택 */}
        <div>
          <label className="mb-1.5 block text-[11px] text-muted-foreground">LLM 프로바이더</label>
          <div className="flex gap-2">
            {PROVIDERS.map((p) => (
              <button
                key={p.value}
                onClick={() => setProvider(p.value)}
                title={p.desc}
                className={cn(
                  'flex-1 rounded-md border px-3 py-2 text-left transition-colors',
                  provider === p.value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:bg-secondary/60'
                )}
              >
                <p className="text-xs font-semibold">{p.label}</p>
                <p className="mt-0.5 text-[10px] opacity-70">{p.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* 분석 모드 */}
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
