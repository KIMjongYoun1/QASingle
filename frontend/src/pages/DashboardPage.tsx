import { useEffect, useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Legend,
} from 'recharts';
import { ChevronUp, ChevronDown, ArrowRight, Calendar, Search, X } from 'lucide-react';
import { listProjects } from '../api/projects';
import { getAnalytics, type ProjectAnalytics, type DateRange } from '../api/analytics';
import { getCaseHistory } from '../api/analytics';
import type { Project } from '../types/qa';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { cn } from '../lib/utils';

const PAGE_SIZE = 6;
const COLORS = ['#4f8cff', '#a78bfa', '#34d399', '#fb923c', '#f472b6', '#38bdf8', '#facc15', '#e879f9'];

// ── 기간 프리셋 ────────────────────────────────────────────────
const PRESETS = [
  { label: '전체', days: null },
  { label: '7일', days: 7 },
  { label: '30일', days: 30 },
  { label: '90일', days: 90 },
] as const;

function toDateStr(date: Date) {
  return date.toISOString().slice(0, 10);
}
function presetRange(days: number | null): DateRange {
  if (!days) return {};
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - days + 1);
  return { start: toDateStr(start), end: toDateStr(end) };
}

// ── 컴포넌트 ───────────────────────────────────────────────────
interface ProjectData {
  project: Project;
  analytics: ProjectAnalytics | null;
  historyCount: number;
  lastRunAt: string | null;
}

interface Props {
  onSelectProject: (id: number) => void;
}

function PassBar({ rate }: { rate: number }) {
  const color = rate >= 80 ? 'bg-success' : rate >= 50 ? 'bg-warning' : 'bg-destructive';
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
      <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${rate}%` }} />
    </div>
  );
}

function ProjectCard({ row, color, onClick }: { row: ProjectData; color: string; onClick: () => void }) {
  const a = row.analytics;
  const lastRun = row.lastRunAt
    ? new Date(row.lastRunAt).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <button
      onClick={onClick}
      className="group relative flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 text-left transition-all hover:border-primary/40 hover:shadow-md hover:shadow-primary/5"
    >
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="size-2.5 shrink-0 rounded-full" style={{ background: color }} />
          <span className="truncate text-sm font-semibold text-foreground">{row.project.name}</span>
        </div>
        <ArrowRight className="size-3.5 shrink-0 text-muted-foreground/40 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
      </div>

      {/* 스탯 */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-[11px] text-muted-foreground">실행 횟수</p>
          <p className="mt-0.5 text-xl font-bold text-foreground">{a?.total_runs ?? 0}</p>
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground">통과율</p>
          <p className={cn('mt-0.5 text-xl font-bold',
            !a || a.total_runs === 0 ? 'text-muted-foreground'
              : a.overall_pass_rate >= 80 ? 'text-success'
              : a.overall_pass_rate >= 50 ? 'text-warning'
              : 'text-destructive'
          )}>
            {a && a.total_runs > 0 ? `${a.overall_pass_rate}%` : '—'}
          </p>
        </div>
        <div>
          <p className="text-[11px] text-muted-foreground">변경 이력</p>
          <p className="mt-0.5 text-xl font-bold text-foreground">{row.historyCount}</p>
        </div>
      </div>

      {/* Pass 바 */}
      {a && a.total_runs > 0 && <PassBar rate={a.overall_pass_rate} />}

      {/* 마지막 실행 */}
      <p className="text-[11px] text-muted-foreground">
        {lastRun ? `마지막 실행: ${lastRun}` : '실행 이력 없음'}
      </p>
    </button>
  );
}

export default function DashboardPage({ onSelectProject }: Props) {
  const [rows, setRows] = useState<ProjectData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [search, setSearch] = useState('');
  const [preset, setPreset] = useState<number | null>(null);        // null = 전체
  const [customRange, setCustomRange] = useState<DateRange>({});
  const [showCustom, setShowCustom] = useState(false);
  const [range, setRange] = useState<DateRange>({});

  // 기간 적용
  const applyPreset = (days: number | null) => {
    setPreset(days);
    setShowCustom(false);
    setRange(presetRange(days));
  };
  const applyCustom = () => {
    setPreset(-1);         // -1 = 직접설정 활성
    setRange(customRange);
  };

  // 데이터 로드 (range 바뀔 때마다 재조회)
  useEffect(() => {
    setLoading(true);
    (async () => {
      const projects = await listProjects();
      const all = await Promise.all(
        projects.map(async (p) => {
          const [analyticsRes, historyRes] = await Promise.allSettled([
            getAnalytics(p.id, range),
            getCaseHistory(p.id),
          ]);
          const analytics = analyticsRes.status === 'fulfilled' ? analyticsRes.value : null;
          return {
            project: p,
            analytics,
            historyCount: historyRes.status === 'fulfilled' ? historyRes.value.length : 0,
            lastRunAt: analytics?.last_run_at ?? null,
          };
        })
      );
      // 정렬: ① 최근 실행일 내림차순 → ② 실행 없는 것 뒤로 → ③ 가나다순
      all.sort((a, b) => {
        if (a.lastRunAt && b.lastRunAt) {
          const diff = b.lastRunAt.localeCompare(a.lastRunAt);
          if (diff !== 0) return diff;
        }
        if (a.lastRunAt && !b.lastRunAt) return -1;
        if (!a.lastRunAt && b.lastRunAt) return 1;
        return a.project.name.localeCompare(b.project.name, 'ko');
      });
      setRows(all);
      setLoading(false);
    })();
  }, [range]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.trim().toLowerCase();
    return rows.filter((r) => r.project.name.toLowerCase().includes(q));
  }, [rows, search]);

  const visible = showAll ? filtered : filtered.slice(0, PAGE_SIZE);
  const hasRuns = rows.some((r) => r.analytics && r.analytics.total_runs > 0);

  // 비교 차트 데이터
  const compareData = rows
    .filter((r) => r.analytics && r.analytics.total_runs > 0)
    .map((r, i) => ({
      name: r.project.name,
      pass_rate: r.analytics!.overall_pass_rate,
      total_runs: r.analytics!.total_runs,
      color: COLORS[i % COLORS.length],
    }));

  const allCaseIds = useMemo(() =>
    Array.from(new Set(rows.flatMap((r) => (r.analytics?.case_stats ?? []).map((c) => c.case_id)))).slice(0, 8),
    [rows]
  );
  const radarData = allCaseIds.map((cid) => {
    const entry: Record<string, string | number> = { case_id: cid };
    rows.forEach((r) => {
      const stat = r.analytics?.case_stats.find((c) => c.case_id === cid);
      entry[r.project.name] = stat ? stat.pass_rate : 100;
    });
    return entry;
  });

  const rangeLabel = preset === null ? '전체 기간'
    : preset === -1 ? `${customRange.start ?? ''} ~ ${customRange.end ?? ''}`
    : `최근 ${preset}일`;

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-background">
      <div className="flex flex-col gap-6 p-6">

        {/* 헤더 */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground">프로젝트 대시보드</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {search ? `${filtered.length} / ${rows.length}개 프로젝트` : `${rows.length}개 프로젝트`}
              {' · '}{rangeLabel}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* 검색창 */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setShowAll(false); }}
                placeholder="프로젝트 검색..."
                className="h-8 w-48 pl-8 pr-7 text-xs"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="size-3.5" />
                </button>
              )}
            </div>

          </div>
        </div>

        {/* 기간 필터 버튼 */}
        <div className="flex flex-wrap items-center gap-1.5">
          {PRESETS.map((p) => (
            <Button
              key={String(p.days)}
              size="sm"
              variant={preset === p.days && !showCustom ? 'default' : 'outline'}
              className="h-7 px-3 text-xs"
              onClick={() => applyPreset(p.days)}
            >
              {p.label}
            </Button>
          ))}
          <Button
            size="sm"
            variant={showCustom || preset === -1 ? 'default' : 'outline'}
            className="h-7 gap-1 px-3 text-xs"
            onClick={() => setShowCustom((v) => !v)}
          >
            <Calendar className="size-3" />
            직접 설정
          </Button>
        </div>

        {/* 직접 기간 설정 */}
        {showCustom && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-4">
            <span className="text-xs text-muted-foreground">시작</span>
            <Input type="date" value={customRange.start ?? ''} onChange={(e) => setCustomRange((v) => ({ ...v, start: e.target.value }))} className="h-8 w-36 text-xs" />
            <span className="text-xs text-muted-foreground">~</span>
            <Input type="date" value={customRange.end ?? ''} onChange={(e) => setCustomRange((v) => ({ ...v, end: e.target.value }))} className="h-8 w-36 text-xs" />
            <Button size="sm" className="h-8 px-4 text-xs" onClick={applyCustom}>적용</Button>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-44 animate-pulse rounded-2xl border border-border bg-card" />
            ))}
          </div>
        ) : (
          <>
            {/* 프로젝트 카드 그리드 */}
            <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
              {visible.map((r, i) => (
                <ProjectCard
                  key={r.project.id}
                  row={r}
                  color={COLORS[i % COLORS.length]}
                  onClick={() => onSelectProject(r.project.id)}
                />
              ))}
            </div>

            {/* 전체 펼치기 / 접기 */}
            {filtered.length > PAGE_SIZE && (
              <button
                onClick={() => setShowAll((v) => !v)}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-border py-3 text-xs text-muted-foreground transition-colors hover:bg-secondary/40 hover:text-foreground"
              >
                {showAll ? (
                  <><ChevronUp className="size-3.5" />접기</>
                ) : (
                  <><ChevronDown className="size-3.5" />전체 펼치기 ({filtered.length - PAGE_SIZE}개 더보기)</>
                )}
              </button>
            )}

            {/* 전체 비교 차트들 */}
            {hasRuns && compareData.length > 1 && (
              <>
                {/* Pass율 비교 */}
                <div className="rounded-2xl border border-border bg-card p-5">
                  <h3 className="mb-1 text-sm font-semibold text-foreground">프로젝트별 Pass율 비교</h3>
                  <p className="mb-4 text-[11px] text-muted-foreground">{rangeLabel}</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={compareData} margin={{ left: -10, right: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                      <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                      <Tooltip formatter={(v: number) => [`${v}%`, 'Pass율']} contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                      <Bar dataKey="pass_rate" name="Pass율" radius={[6, 6, 0, 0]}>
                        {compareData.map((d, i) => <rect key={i} fill={d.color} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* 실행 횟수 비교 */}
                <div className="rounded-2xl border border-border bg-card p-5">
                  <h3 className="mb-1 text-sm font-semibold text-foreground">프로젝트별 실행 횟수</h3>
                  <p className="mb-4 text-[11px] text-muted-foreground">{rangeLabel}</p>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={compareData} margin={{ left: -10, right: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                      <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                      <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                      <Bar dataKey="total_runs" name="실행 횟수" radius={[6, 6, 0, 0]}>
                        {compareData.map((d, i) => <rect key={i} fill={d.color} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* 레이더 — 케이스별 Pass율 비교 */}
                {radarData.length > 0 && (
                  <div className="rounded-2xl border border-border bg-card p-5">
                    <h3 className="mb-1 text-sm font-semibold text-foreground">케이스별 Pass율 비교 (레이더)</h3>
                    <p className="mb-4 text-[11px] text-muted-foreground">공통 실행 케이스 기준 · {rangeLabel}</p>
                    <ResponsiveContainer width="100%" height={280}>
                      <RadarChart data={radarData}>
                        <PolarGrid stroke="var(--border)" />
                        <PolarAngleAxis dataKey="case_id" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                        <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 9 }} stroke="var(--muted-foreground)" />
                        {rows.filter((r) => r.analytics && r.analytics.total_runs > 0).map((r, i) => (
                          <Radar key={r.project.id} name={r.project.name} dataKey={r.project.name}
                            stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]} fillOpacity={0.15} />
                        ))}
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Tooltip formatter={(v: number, name: string) => [`${v}%`, name]} contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </>
            )}
          </>
        )}

      </div>
    </div>
  );
}
