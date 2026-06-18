import { useEffect, useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from 'recharts';
import { useQAStore } from '../store/useQAStore';
import { getAnalytics, type ProjectAnalytics } from '../api/analytics';
import { cn } from '../lib/utils';

const PASS_COLOR = '#22c55e';
const FAIL_COLOR = '#ef4444';

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-bold text-foreground">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export default function AnalyticsPage() {
  const projectId = useQAStore((s) => s.projectId);
  const [data, setData] = useState<ProjectAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    getAnalytics(projectId)
      .then(setData)
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">분석 데이터 불러오는 중...</div>;
  }
  if (!data || data.total_runs === 0) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">실행 이력이 없습니다. 자동 실행을 먼저 진행해주세요.</div>;
  }

  const topFailing = data.case_stats.slice(0, 15);
  const trendData = data.trend.map((t) => ({
    ...t,
    name: t.label || `#${t.run_id}`,
    date: t.started_at ? new Date(t.started_at).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' }) : '',
  }));

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-background">
      <div className="flex flex-col gap-6 p-6">

        {/* 요약 카드 */}
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="전체 실행 횟수" value={data.total_runs} sub="완료된 실행 기준" />
          <StatCard label="전체 통과율" value={`${data.overall_pass_rate}%`} sub="fail=0 실행 비율" />
          <StatCard label="분석 케이스 수" value={data.case_stats.length} sub="실행된 고유 케이스" />
        </div>

        {/* 실행 추이 */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="mb-4 text-sm font-semibold text-foreground">최근 실행 Pass율 추이</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trendData} margin={{ left: -10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
              <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
              <Tooltip
                formatter={(v) => [`${v}%`, 'Pass율']}
                contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
              />
              <Line
                type="monotone" dataKey="pass_rate" stroke={PASS_COLOR}
                strokeWidth={2} dot={{ r: 3, fill: PASS_COLOR }} activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Pass / Fail 스택 바 */}
        <div className="rounded-2xl border border-border bg-card p-5">
          <h3 className="mb-4 text-sm font-semibold text-foreground">최근 실행별 Pass / Fail 건수</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={trendData} margin={{ left: -10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
              <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
              <Tooltip
                contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
              />
              <Bar dataKey="pass" name="Pass" stackId="a" fill={PASS_COLOR} radius={[0, 0, 0, 0]} />
              <Bar dataKey="fail" name="Fail" stackId="a" fill={FAIL_COLOR} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 케이스별 실패 순위 */}
        {topFailing.length > 0 && (
          <div className="rounded-2xl border border-border bg-card p-5">
            <h3 className="mb-4 text-sm font-semibold text-foreground">케이스별 실패 횟수 (많은 순)</h3>
            <ResponsiveContainer width="100%" height={Math.max(200, topFailing.length * 32)}>
              <BarChart data={topFailing} layout="vertical" margin={{ left: 8, right: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                <YAxis type="category" dataKey="case_id" width={90} tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                <Tooltip
                  formatter={(v, name) => [v, name === 'fail' ? '실패' : '통과']}
                  contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="pass" name="pass" stackId="a" fill={PASS_COLOR} />
                <Bar dataKey="fail" name="fail" stackId="a" fill={FAIL_COLOR} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>

            {/* 테이블 */}
            <div className="mt-4 overflow-hidden rounded-xl border border-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-secondary/40 text-left text-muted-foreground">
                    <th className="px-3 py-2 font-medium">케이스 ID</th>
                    <th className="px-3 py-2 text-right font-medium">실행</th>
                    <th className="px-3 py-2 text-right font-medium">통과</th>
                    <th className="px-3 py-2 text-right font-medium">실패</th>
                    <th className="px-3 py-2 text-right font-medium">Pass율</th>
                  </tr>
                </thead>
                <tbody>
                  {topFailing.map((c, i) => (
                    <tr key={c.case_id} className={cn('border-b border-border last:border-0', i % 2 === 0 ? '' : 'bg-secondary/20')}>
                      <td className="px-3 py-2 font-mono">{c.case_id}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground">{c.total}</td>
                      <td className="px-3 py-2 text-right text-success">{c.pass}</td>
                      <td className="px-3 py-2 text-right text-destructive">{c.fail}</td>
                      <td className={cn('px-3 py-2 text-right font-medium', c.pass_rate >= 80 ? 'text-success' : c.pass_rate >= 50 ? 'text-warning' : 'text-destructive')}>
                        {c.pass_rate}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
