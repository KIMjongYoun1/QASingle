import { useMemo } from 'react';
import type { ParsedOpenApiCase } from '../../api/openapi';
import SpecUploadDropzone from '../SpecUploadDropzone';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';

interface Props {
  analysis: { cases: ParsedOpenApiCase[]; categories: string[]; baseUrl: string; total: number } | null;
  specFileName: string;
  parsing: boolean;
  imported: boolean;
  onFile: (file: File) => void;
  onConfirmImport: () => void;
  onAnalysisDetail: (id: string) => void;
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

export default function SpecAnalysisTab({ analysis, specFileName, parsing, imported, onFile, onConfirmImport, onAnalysisDetail }: Props) {
  const groupedAnalysis = useMemo(() => {
    if (!analysis) return [];
    const map = new Map<string, ParsedOpenApiCase[]>();
    analysis.cases.forEach((c) => {
      const key = `${c.method || ''} ${c.endpoint || ''}`.trim() || '(엔드포인트 없음)';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    });
    return Array.from(map.entries());
  }, [analysis]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto">
      <SpecUploadDropzone onFile={onFile} loading={parsing} />

      {analysis && (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/40 px-3.5 py-2.5">
            <div className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{specFileName}</span> 분석 결과 — 엔드포인트 {groupedAnalysis.length}개, 케이스 {analysis.total}개
              {analysis.baseUrl && <span> · 기본 URL: {analysis.baseUrl}</span>}
            </div>
            <Button size="sm" onClick={onConfirmImport} disabled={imported} className="gap-1.5">
              {imported ? '임포트 완료 ✓' : '케이스로 임포트'}
            </Button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {groupedAnalysis.map(([key, cases]) => {
                const [method, endpoint] = key.split(/ (.+)/);
                return (
                  <div key={key} className="rounded-xl border border-border bg-card p-3.5 shadow-[var(--shadow-soft)]">
                    <div className="mb-2 flex items-center gap-2">
                      <Badge className={methodColor(method)}>{method}</Badge>
                      <span className="truncate font-mono text-xs text-foreground">{endpoint}</span>
                      <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">{cases.length}건</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      {cases.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => onAnalysisDetail(c.id)}
                          className="flex w-full items-center gap-1.5 rounded-md bg-muted/40 px-2 py-1 text-left text-[11px] hover:bg-muted/70"
                        >
                          <span className="font-mono text-primary">{c.id}</span>
                          <span className="flex-1 truncate text-foreground">{c.name}</span>
                          <Badge className={cn('text-[10px]', c.type === 'Positive' ? 'border-success/30 bg-success/15 text-success' : 'border-destructive/30 bg-destructive/15 text-destructive')}>
                            {c.type}
                          </Badge>
                          <span className="shrink-0 text-[10px] text-muted-foreground">상세보기 →</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
