import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { useQAStore } from '../store/useQAStore';
import { getCaseHistory, type CaseHistoryEntry } from '../api/analytics';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

const ACTION_META = {
  created: { label: '생성', icon: <Plus className="size-3" />,           color: 'text-success bg-success/10 border-success/20' },
  updated: { label: '수정', icon: <Pencil className="size-3" />,         color: 'text-blue-500 bg-blue-500/10 border-blue-500/20' },
  deleted: { label: '삭제', icon: <Trash2 className="size-3" />,         color: 'text-destructive bg-destructive/10 border-destructive/20' },
} as const;

const FIELD_LABELS: Record<string, string> = {
  name: '이름', method: '메서드', endpoint: '엔드포인트',
  expectedStatus: '기대 상태코드', catId: '카테고리 ID', type: '유형',
  headers: '헤더', queryParams: '쿼리 파라미터', body: '바디',
};
const TRACKED_FIELDS = Object.keys(FIELD_LABELS);

const DISPLAY_FIELDS = ['name', 'method', 'endpoint', 'expectedStatus', 'type', 'catId', 'body'];

function fmt(v: unknown): string {
  if (v === undefined || v === null || v === '') return '(없음)';
  if (Array.isArray(v)) return v.length === 0 ? '(없음)' : JSON.stringify(v);
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

// 케이스 단일 정보 테이블 (생성 / 삭제용)
function CaseInfoTable({ data, label, labelColor }: { data: Record<string, unknown>; label: string; labelColor: string }) {
  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-border">
      <div className={cn('px-3 py-1.5 text-[11px] font-semibold', labelColor)}>
        {label}
      </div>
      <table className="w-full text-xs">
        <tbody>
          {DISPLAY_FIELDS.map((f) => (
            <tr key={f} className="border-t border-border">
              <td className="w-32 px-3 py-1.5 font-medium text-muted-foreground">{FIELD_LABELS[f] ?? f}</td>
              <td className="px-3 py-1.5 font-mono text-foreground break-all">{fmt(data[f])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// 수정: before → after 비교 테이블
function DiffTable({ before, after }: { before: Record<string, unknown>; after: Record<string, unknown> }) {
  const diffs = TRACKED_FIELDS.filter((f) => JSON.stringify(before[f]) !== JSON.stringify(after[f]));
  if (diffs.length === 0) return <p className="mt-3 text-xs text-muted-foreground">변경된 필드 없음</p>;
  return (
    <div className="mt-3 overflow-hidden rounded-xl border border-border">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border bg-secondary/40">
            <th className="w-28 px-3 py-1.5 text-left text-[11px] font-semibold text-muted-foreground">필드</th>
            <th className="px-3 py-1.5 text-left text-[11px] font-semibold text-destructive/80">변경 전</th>
            <th className="px-3 py-1.5 text-left text-[11px] font-semibold text-success">변경 후</th>
          </tr>
        </thead>
        <tbody>
          {diffs.map((f) => (
            <tr key={f} className="border-t border-border">
              <td className="px-3 py-2 font-medium text-muted-foreground">{FIELD_LABELS[f] ?? f}</td>
              <td className="px-3 py-2 font-mono text-destructive/80 break-all line-through">{fmt(before[f])}</td>
              <td className="px-3 py-2 font-mono text-success break-all">{fmt(after[f])}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HistoryItem({ entry }: { entry: CaseHistoryEntry }) {
  const meta = ACTION_META[entry.action];
  const date = new Date(entry.changed_at);
  const dateStr = date.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
  const timeStr = date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

  const caseName =
    entry.action === 'deleted'
      ? (entry.before as Record<string, string> | null)?.name
      : (entry.after as Record<string, string> | null)?.name;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* 헤더 행 */}
      <div className="flex items-center gap-3 px-4 py-3">
        <span className={cn('flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium shrink-0', meta.color)}>
          {meta.icon}{meta.label}
        </span>
        <span className="font-mono text-xs font-semibold text-foreground">{entry.case_id}</span>
        {caseName && (
          <span className="truncate text-xs text-muted-foreground max-w-xs">{String(caseName)}</span>
        )}
        <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">{dateStr} {timeStr}</span>
      </div>

      {/* 상세 내용 — 항상 표시 */}
      <div className="border-t border-border bg-secondary/10 px-4 pb-4 pt-3">
        {entry.action === 'created' && entry.after && (
          <CaseInfoTable
            data={entry.after as Record<string, unknown>}
            label="생성된 케이스"
            labelColor="bg-success/10 text-success"
          />
        )}

        {entry.action === 'deleted' && entry.before && (
          <CaseInfoTable
            data={entry.before as Record<string, unknown>}
            label="삭제된 케이스"
            labelColor="bg-destructive/10 text-destructive"
          />
        )}

        {entry.action === 'updated' && entry.before && entry.after && (
          <DiffTable
            before={entry.before as Record<string, unknown>}
            after={entry.after as Record<string, unknown>}
          />
        )}
      </div>
    </div>
  );
}

export default function CaseHistoryPage() {
  const projectId = useQAStore((s) => s.projectId);
  const [entries, setEntries] = useState<CaseHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<'all' | 'created' | 'updated' | 'deleted'>('all');

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    getCaseHistory(projectId)
      .then(setEntries)
      .catch(() => toast.error('변경 이력을 불러오지 못했습니다'))
      .finally(() => setLoading(false));
  }, [projectId]);

  const filtered = entries.filter((e) => {
    if (actionFilter !== 'all' && e.action !== actionFilter) return false;
    if (search && !e.case_id.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (loading) return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">불러오는 중...</div>
  );

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-background">
      <div className="flex flex-col gap-4 p-6">

        {/* 필터 바 */}
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="케이스 ID 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-48 text-xs"
          />
          <div className="flex gap-1">
            {(['all', 'created', 'updated', 'deleted'] as const).map((a) => (
              <Button
                key={a}
                size="sm"
                variant={actionFilter === a ? 'default' : 'outline'}
                className="h-7 px-2.5 text-xs"
                onClick={() => setActionFilter(a)}
              >
                {a === 'all' ? `전체 (${entries.length})` : `${ACTION_META[a].label} (${entries.filter((e) => e.action === a).length})`}
              </Button>
            ))}
          </div>
          <span className="ml-auto text-xs text-muted-foreground">{filtered.length}건 표시</span>
        </div>

        {/* 이력 목록 */}
        {filtered.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
            {entries.length === 0 ? '아직 케이스 변경 이력이 없습니다' : '검색 결과가 없습니다'}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((e) => <HistoryItem key={e.id} entry={e} />)}
          </div>
        )}

      </div>
    </div>
  );
}
