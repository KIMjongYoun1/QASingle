import { useState } from 'react';
import { toast } from 'sonner';
import { useQAStore } from '../store/useQAStore';
import { listRuns, getRun, type RunSummary } from '../api/runs';
import { listSuites, type TestSuite } from '../api/suites';
import type { Assertion, CaseType, KV, PF, TestCase } from '../types/qa';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Progress, ProgressTrack, ProgressIndicator } from '../components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { cn } from '../lib/utils';

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
const STATUS_PRESETS = ['200', '201', '204', '400', '401', '403', '404', '409', '500'];

const ASSERTION_TARGETS: { value: Assertion['target']; label: string }[] = [
  { value: 'status_code', label: '상태코드' },
  { value: 'body_json', label: '바디 JSON' },
  { value: 'body_text', label: '바디 텍스트' },
  { value: 'header', label: '헤더' },
];

const ASSERTION_OPERATORS: { value: Assertion['operator']; label: string }[] = [
  { value: 'eq', label: '=' },
  { value: 'contains', label: '포함' },
  { value: 'not_contains', label: '미포함' },
  { value: 'exists', label: '존재' },
  { value: 'not_exists', label: '미존재' },
  { value: 'gt', label: '>' },
  { value: 'lt', label: '<' },
];

const emptyForm = {
  id: '', name: '', type: 'Positive' as CaseType, method: '', endpoint: '', baseUrl: '', expectedStatus: '' as string,
  input: '', expected: '', actual: '', pf: 'Pass' as PF, owner: '', date: '', catId: '',
  headers: [] as KV[], queryParams: [] as KV[], body: '', assertions: [] as Assertion[],
};

function buildInput(method: string, endpoint: string) {
  return [method, endpoint].filter(Boolean).join(' ');
}

function AssertionEditor({ rows, onChange }: { rows: Assertion[]; onChange: (rows: Assertion[]) => void }) {
  const update = (idx: number, patch: Partial<Assertion>) => onChange(rows.map((r, i) => i === idx ? { ...r, ...patch } : r));
  const remove = (idx: number) => onChange(rows.filter((_, i) => i !== idx));
  const add = () => onChange([...rows, { target: 'status_code', operator: 'eq', value: '' }]);
  const needsPath = (t: Assertion['target']) => t === 'body_json' || t === 'header';
  const needsValue = (op: Assertion['operator']) => op !== 'exists' && op !== 'not_exists';

  return (
    <div className="mb-2">
      <div className="mb-1 flex items-center justify-between">
        <label className="text-[11px] text-muted-foreground">성공 판정 조건 — 응답이 이 조건을 모두 만족해야 통과</label>
        <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]" onClick={add}>+ 추가</Button>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-2 py-1.5 text-center text-[11px] text-muted-foreground">
          없음 — 성공 상태코드 일치 여부로만 판정
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {rows.map((r, i) => (
            <div key={i} className="flex flex-wrap items-center gap-1 rounded-md border border-border bg-muted/20 p-1.5">
              <select
                value={r.target}
                onChange={(e) => update(i, { target: e.target.value as Assertion['target'], path: '' })}
                className="h-7 rounded border border-input bg-background px-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {ASSERTION_TARGETS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              {needsPath(r.target) && (
                <input
                  placeholder={r.target === 'body_json' ? 'data.success' : 'Content-Type'}
                  value={r.path || ''}
                  onChange={(e) => update(i, { path: e.target.value })}
                  className="h-7 w-28 rounded border border-input bg-background px-1.5 font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-ring"
                />
              )}
              <select
                value={r.operator}
                onChange={(e) => update(i, { operator: e.target.value as Assertion['operator'] })}
                className="h-7 rounded border border-input bg-background px-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {ASSERTION_OPERATORS.map((op) => <option key={op.value} value={op.value}>{op.label}</option>)}
              </select>
              {needsValue(r.operator) && (
                <input
                  placeholder="기대값"
                  value={r.value || ''}
                  onChange={(e) => update(i, { value: e.target.value })}
                  className="h-7 min-w-0 flex-1 rounded border border-input bg-background px-1.5 font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-ring"
                />
              )}
              <button onClick={() => remove(i)} className="ml-auto h-7 rounded px-2 text-[11px] text-destructive hover:bg-destructive/10">✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function KVEditor({ title, rows, onChange }: { title: string; rows: KV[]; onChange: (rows: KV[]) => void }) {
  const update = (idx: number, patch: Partial<KV>) => onChange(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  const remove = (idx: number) => onChange(rows.filter((_, i) => i !== idx));
  const add = () => onChange([...rows, { key: '', value: '' }]);
  return (
    <div className="mb-2">
      <div className="mb-1 flex items-center justify-between">
        <label className="text-[11px] text-muted-foreground">{title}</label>
        <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]" onClick={add}>+ 추가</Button>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-2 py-1.5 text-center text-[11px] text-muted-foreground">사용 안 함</p>
      ) : (
        <div className="flex flex-col gap-1">
          {rows.map((r, i) => (
            <div key={i} className="flex gap-1">
              <Input placeholder="key" value={r.key} onChange={(e) => update(i, { key: e.target.value })} className="h-7 flex-1 text-xs" />
              <Input placeholder="value" value={r.value} onChange={(e) => update(i, { value: e.target.value })} className="h-7 flex-1 text-xs" />
              <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive" onClick={() => remove(i)}>✕</Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CaseManagerPage() {
  const data = useQAStore((s) => s.data);
  const projectId = useQAStore((s) => s.projectId);
  const setPendingRunRestore = useQAStore((s) => s.setPendingRunRestore);
  const addCase = useQAStore((s) => s.addCase);
  const updateCase = useQAStore((s) => s.updateCase);
  const deleteCase = useQAStore((s) => s.deleteCase);
  const clearAllCases = useQAStore((s) => s.clearAllCases);
  const addCategory = useQAStore((s) => s.addCategory);
  const deleteCategory = useQAStore((s) => s.deleteCategory);

  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [newCat, setNewCat] = useState('');
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterPF, setFilterPF] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [loadedSuites, setLoadedSuites] = useState<{ id: number; name: string; caseIds: string[] }[]>([]);
  const [loadedHistories, setLoadedHistories] = useState<{ runId: number; label: string; caseIds: string[] }[]>([]);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyRuns, setHistoryRuns] = useState<RunSummary[]>([]);
  const [suiteModalOpen, setSuiteModalOpen] = useState(false);
  const [suiteList, setSuiteList] = useState<TestSuite[]>([]);

  const openSuiteModal = async () => {
    if (!projectId) return;
    const list = await listSuites(projectId).catch(() => []);
    setSuiteList(list);
    setSuiteModalOpen(true);
  };

  const applySuite = (suite: TestSuite) => {
    setLoadedSuites((prev) => {
      if (prev.find((s) => s.id === suite.id)) {
        toast.info(`이미 불러온 Suite입니다: ${suite.name}`);
        return prev;
      }
      toast.success(`Suite "${suite.name}" 추가됨 — ${suite.case_ids.length}건`);
      return [...prev, { id: suite.id, name: suite.name, caseIds: suite.case_ids }];
    });
    setSuiteModalOpen(false);
  };

  const openHistoryModal = async () => {
    if (!projectId) return;
    try {
      const runs = await listRuns(projectId);
      setHistoryRuns(runs);
      setHistoryModalOpen(true);
    } catch {
      toast.error('히스토리를 불러오지 못했습니다');
    }
  };

  const applyHistoryFilter = async (run: RunSummary) => {
    try {
      const detail = await getRun(run.id);
      const label = run.label || `Run #${run.id}`;
      const caseIds = (detail.case_results ?? []).map((cr) => cr.case_id);
      setLoadedHistories((prev) => {
        if (prev.find((h) => h.runId === run.id)) {
          toast.info(`이미 불러온 히스토리입니다: ${label}`);
          return prev;
        }
        toast.success(`히스토리 추가됨: ${label} (${caseIds.length}건)`);
        return [...prev, { runId: run.id, label, caseIds }];
      });
      setPendingRunRestore({
        caseIds: detail.case_ids ?? [],
        flowIds: (detail.flow_ids ?? []).map(Number),
        baseUrl: detail.base_url,
        sourceLabel: label,
      });
      setHistoryModalOpen(false);
    } catch {
      toast.error('히스토리 상세 정보를 불러오지 못했습니다');
    }
  };

  const cases = data.mgr.cases;
  const cats = data.mgr.cats;
  const total = cases.length;
  const pass = cases.filter((c) => c.pf === 'Pass').length;
  const fail = cases.filter((c) => c.pf === 'Fail').length;
  const rate = total ? Math.round((pass / total) * 100) : 0;

  const nextId = () => {
    const nums = cases.map((c) => parseInt(c.id.replace(/\D/g, '')) || 0);
    return 'TC-' + String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3, '0');
  };

  const submit = () => {
    if (!form.name.trim()) return;
    const payload = {
      ...form,
      input: buildInput(form.method, form.endpoint),
      expectedStatus: form.expectedStatus ? Number(form.expectedStatus) : undefined,
    };
    if (editId) {
      updateCase(editId, { ...payload, id: editId });
      setEditId(null);
      setForm(emptyForm);
      toast.success('케이스를 수정했습니다');
    } else {
      const c: TestCase = { ...payload, id: form.id || nextId() };
      addCase(c);
      setForm(emptyForm);
      toast.success('케이스를 추가했습니다');
    }
  };

  const startEdit = (c: TestCase) => {
    setEditId(c.id);
    setForm({
      ...emptyForm,
      ...c,
      method: c.method || '',
      endpoint: c.endpoint || '',
      baseUrl: c.baseUrl || '',
      expectedStatus: c.expectedStatus != null ? String(c.expectedStatus) : '',
      headers: c.headers ? c.headers.map((h) => ({ ...h })) : [],
      queryParams: c.queryParams ? c.queryParams.map((q) => ({ ...q })) : [],
      body: c.body || '',
      assertions: c.assertions ? c.assertions.map((a) => ({ ...a })) : [],
    });
    setShowAdvanced(!!(c.baseUrl || c.headers?.length || c.queryParams?.length || c.body || c.assertions?.length));
  };
  const cancelEdit = () => { setEditId(null); setForm(emptyForm); setShowAdvanced(false); };

  const allLoadedIds: Set<string> | null = (() => {
    const all = [
      ...loadedSuites.flatMap((s) => s.caseIds),
      ...loadedHistories.flatMap((h) => h.caseIds),
    ];
    return all.length > 0 ? new Set(all) : null;
  })();

  const filtered = cases.filter((c) => {
    if (allLoadedIds && !allLoadedIds.has(c.id)) return false;
    if (search && !c.id.toLowerCase().includes(search.toLowerCase()) && !c.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterType && c.type !== filterType) return false;
    if (filterPF && c.pf !== filterPF) return false;
    return true;
  });

  return (
    <div className="grid h-full" style={{ gridTemplateColumns: 'clamp(240px,22vw,340px) 1fr' }}>
      <div className="flex flex-col gap-5 overflow-y-auto border-r border-border bg-card p-3.5">
        <div>
          <div className="mb-2.5 text-xs font-semibold text-warning">📝 케이스 {editId ? '수정' : '추가'}</div>
          <div className="mb-2 grid grid-cols-2 gap-1.5">
            <div>
              <label className="mb-1 block text-[11px] text-muted-foreground">케이스 ID</label>
              <Input placeholder={nextId()} value={form.id} disabled={!!editId} onChange={(e) => setForm({ ...form, id: e.target.value })} className="h-8 text-xs" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-muted-foreground">유형 — 정상/비정상 케이스</label>
              <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as CaseType })}>
                <SelectTrigger className="h-8 w-full text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Positive">Positive</SelectItem>
                  <SelectItem value="Negative">Negative</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mb-2">
            <label className="mb-1 block text-[11px] text-muted-foreground">테스트 이름 — 어떤 케이스인지 설명</label>
            <Textarea rows={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="text-xs" />
          </div>
          <div className="mb-2 rounded-md border border-border bg-muted/30 p-2">
            <div className="mb-1.5 text-[11px] font-semibold text-muted-foreground">API 요청 설정 — 실제 호출에 사용되는 정보</div>
            <div className="mb-1.5">
              <Input
                placeholder="서버 주소 (비워두면 전역 설정 사용)"
                value={form.baseUrl}
                onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
                className="h-8 font-mono text-xs"
              />
            </div>
            <div className="mb-1.5 grid grid-cols-[88px_1fr] gap-1.5">
              <Select value={form.method || '__none'} onValueChange={(v) => setForm({ ...form, method: !v || v === '__none' ? '' : v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Method" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">-- Method --</SelectItem>
                  {METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input
                placeholder="/users/{id}"
                value={form.endpoint}
                onChange={(e) => setForm({ ...form, endpoint: e.target.value })}
                className="h-8 font-mono text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <Select value={form.expectedStatus || '__none'} onValueChange={(v) => setForm({ ...form, expectedStatus: !v || v === '__none' ? '' : v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="기대 상태코드" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">-- 성공 상태코드 선택 --</SelectItem>
                  {STATUS_PRESETS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input
                placeholder="직접 입력 (선택)"
                value={STATUS_PRESETS.includes(form.expectedStatus) ? '' : form.expectedStatus}
                onChange={(e) => setForm({ ...form, expectedStatus: e.target.value.replace(/\D/g, '') })}
                className="h-8 text-xs"
              />
            </div>
            {(form.method || form.endpoint) && (
              <div className="mt-1.5 font-mono text-[11px] text-primary">
                {form.method && <span className="mr-1 text-muted-foreground">{form.method}</span>}
                {form.baseUrl ? form.baseUrl.replace(/\/$/, '') : <span className="text-muted-foreground/60">[전역URL]</span>}
                {form.endpoint}
              </div>
            )}

            <div className="mt-2.5 border-t border-border pt-2">
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="flex w-full items-center justify-between text-[11px] font-semibold text-muted-foreground hover:text-foreground"
              >
                <span>요청 세부 설정 — 헤더 · 파라미터 · 전송 데이터 · 성공 조건</span>
                <span>{showAdvanced ? '▲' : '▼'}</span>
              </button>
              {showAdvanced && (
                <div className="mt-2">
                  <KVEditor title="요청 헤더 — 인증 토큰 등 추가 정보" rows={form.headers} onChange={(rows) => setForm({ ...form, headers: rows })} />
                  <KVEditor title="URL 파라미터 — ?key=value 형태로 붙는 값" rows={form.queryParams} onChange={(rows) => setForm({ ...form, queryParams: rows })} />
                  <div className="mb-2">
                    <label className="mb-1 block text-[11px] text-muted-foreground">요청 바디 — API에 전송할 데이터 (JSON 형식)</label>
                    <Textarea
                      rows={3}
                      placeholder={'{\n  "key": "value"\n}'}
                      value={form.body}
                      onChange={(e) => setForm({ ...form, body: e.target.value })}
                      className="font-mono text-xs"
                    />
                  </div>
                  <AssertionEditor rows={form.assertions} onChange={(rows) => setForm({ ...form, assertions: rows })} />
                </div>
              )}
            </div>
          </div>
          <div className="mb-2">
            <label className="mb-1 block text-[11px] text-muted-foreground">기대 결과 — 이 케이스에서 예상되는 동작</label>
            <Textarea rows={2} value={form.expected} onChange={(e) => setForm({ ...form, expected: e.target.value })} className="text-xs" />
          </div>
          <div className="mb-2">
            <label className="mb-1 block text-[11px] text-muted-foreground">실행 결과 — 자동 실행 후 자동으로 채워짐</label>
            <Textarea rows={2} value={form.actual} onChange={(e) => setForm({ ...form, actual: e.target.value })} className="text-xs" />
          </div>
          <div className="mb-2">
            <label className="mb-1 block text-[11px] text-muted-foreground">수동 판정 — 직접 결과를 기록할 때 사용</label>
            <div className="flex gap-1">
              {(['Pass', 'Fail', 'N/A'] as PF[]).map((pfv) => {
                const active = form.pf === pfv;
                const c = pfv === 'Pass' ? 'success' : pfv === 'Fail' ? 'destructive' : 'warning';
                return (
                  <button
                    key={pfv}
                    onClick={() => setForm({ ...form, pf: pfv })}
                    className={cn(
                      'flex-1 rounded-md border px-1 py-1.5 text-[11px] font-bold transition-colors',
                      !active && 'border-border text-muted-foreground',
                      active && c === 'success' && 'border-success bg-success text-success-foreground',
                      active && c === 'destructive' && 'border-destructive bg-destructive text-destructive-foreground',
                      active && c === 'warning' && 'border-warning bg-warning text-warning-foreground'
                    )}
                  >
                    {pfv.toUpperCase()}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="mb-2">
            <label className="mb-1 block text-[11px] text-muted-foreground">카테고리</label>
            <Select value={form.catId || '__none'} onValueChange={(v) => setForm({ ...form, catId: !v || v === '__none' ? '' : v })}>
              <SelectTrigger className="h-8 w-full text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">-- 미분류 --</SelectItem>
                {cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="mb-2 grid grid-cols-2 gap-1.5">
            <div>
              <label className="mb-1 block text-[11px] text-muted-foreground">담당자</label>
              <Input value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} className="h-8 text-xs" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-muted-foreground">수행일자</label>
              <Input type="datetime-local" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="h-8 text-xs" />
            </div>
          </div>
          <Button onClick={submit} className="w-full">
            {editId ? '✔ 수정 완료' : '+ 케이스 추가'}
          </Button>
          {editId && <Button onClick={cancelEdit} variant="outline" className="mt-1 w-full">✕ 수정 취소</Button>}
        </div>

        <div>
          <div className="mb-2.5 text-xs font-semibold text-warning">📁 카테고리 관리</div>
          <div className="mb-2 flex flex-col gap-1.5">
            {cats.map((c) => (
              <div key={c.id} className="flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2.5 py-1.5">
                <div className="size-2 rounded-sm" style={{ background: c.color }} />
                <span className="flex-1 text-xs">{c.name}</span>
                <Button size="sm" variant="ghost" className="h-6 px-2 text-destructive" onClick={() => { deleteCategory(c.id); toast.success('카테고리를 삭제했습니다'); }}>✕</Button>
              </div>
            ))}
          </div>
          <div className="flex gap-1.5">
            <Input
              placeholder="카테고리 이름"
              value={newCat}
              onChange={(e) => setNewCat(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && newCat.trim()) { addCategory(newCat.trim()); setNewCat(''); toast.success('카테고리를 추가했습니다'); } }}
              className="h-8 text-xs"
            />
            <Button size="sm" onClick={() => { if (newCat.trim()) { addCategory(newCat.trim()); setNewCat(''); toast.success('카테고리를 추가했습니다'); } }}>추가</Button>
          </div>
        </div>

        <div>
          <div className="mb-2.5 text-xs font-semibold text-warning">📊 통계</div>
          <div className="mb-1.5 flex justify-between text-xs"><span className="text-muted-foreground">전체</span><span className="font-bold text-primary">{total}</span></div>
          <div className="mb-1.5 flex justify-between text-xs"><span className="text-muted-foreground">PASS</span><span className="font-bold text-success">{pass}</span></div>
          <div className="mb-1.5 flex justify-between text-xs"><span className="text-muted-foreground">FAIL</span><span className="font-bold text-destructive">{fail}</span></div>
          <Progress value={rate}>
            <ProgressTrack>
              <ProgressIndicator className="bg-success" />
            </ProgressTrack>
          </Progress>
          <div className="mt-1 text-right text-[11px] text-muted-foreground">통과율 {rate}%</div>
        </div>

      </div>

      <div className="overflow-y-auto p-5">
        <div className="mb-4 flex gap-3.5">
          {([['전체', total, 'text-primary'], ['PASS', pass, 'text-success'], ['FAIL', fail, 'text-destructive']] as const).map(([label, val, color]) => (
            <div key={label} className="min-w-[90px] rounded-lg border border-border bg-card px-5 py-3.5 text-center">
              <div className={`text-2xl font-extrabold ${color}`}>{val}</div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">{label}</div>
            </div>
          ))}
        </div>

        <div className="mb-3.5 flex flex-wrap items-center gap-2">
          <Input placeholder="🔍 ID 또는 항목명 검색" value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 w-52 text-xs" />
          <Select value={filterType || '__all'} onValueChange={(v) => setFilterType(!v || v === '__all' ? '' : v)}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">전체 구분</SelectItem>
              <SelectItem value="Positive">Positive</SelectItem>
              <SelectItem value="Negative">Negative</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterPF || '__all'} onValueChange={(v) => setFilterPF(!v || v === '__all' ? '' : v)}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">전체 P/F</SelectItem>
              <SelectItem value="Pass">Pass</SelectItem>
              <SelectItem value="Fail">Fail</SelectItem>
              <SelectItem value="N/A">N/A</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => { setSearch(''); setFilterType(''); setFilterPF(''); }}>✕ 초기화</Button>
          <div className="ml-auto flex gap-1.5">
            {checkedIds.size > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => {
                  if (confirm(`선택한 ${checkedIds.size}개 케이스를 삭제하시겠습니까?`)) {
                    checkedIds.forEach((id) => deleteCase(id));
                    setCheckedIds(new Set());
                    toast.success(`${checkedIds.size}개 케이스를 삭제했습니다`);
                  }
                }}
              >
                선택 삭제 ({checkedIds.size})
              </Button>
            )}
            {total > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => {
                  if (confirm(`케이스 ${total}개를 전부 삭제하시겠습니까?\n변경 이력과 Suite 설정은 유지됩니다.`)) {
                    clearAllCases();
                    cancelEdit();
                    setCheckedIds(new Set());
                    toast.success('전체 케이스를 삭제했습니다');
                  }
                }}
              >
                전체 삭제
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={openSuiteModal}>Suite 불러오기</Button>
            <Button variant="outline" size="sm" onClick={openHistoryModal}>히스토리에서 불러오기</Button>
          </div>
        </div>

        {(loadedSuites.length > 0 || loadedHistories.length > 0) && (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/8 px-3 py-2 text-xs">
            <span className="font-medium text-blue-600 dark:text-blue-400 shrink-0">불러온 필터</span>
            {loadedSuites.map((s) => (
              <span key={s.id} className="flex items-center gap-1 rounded bg-blue-500/15 px-2 py-0.5 text-[11px]">
                Suite: {s.name} ({s.caseIds.length}건)
                <button onClick={() => setLoadedSuites((prev) => prev.filter((x) => x.id !== s.id))} className="ml-1 text-muted-foreground hover:text-foreground">✕</button>
              </span>
            ))}
            {loadedHistories.map((h) => (
              <span key={h.runId} className="flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-[11px]">
                히스토리: {h.label} ({h.caseIds.length}건)
                <button onClick={() => setLoadedHistories((prev) => prev.filter((x) => x.runId !== h.runId))} className="ml-1 text-muted-foreground hover:text-foreground">✕</button>
              </span>
            ))}
            <span className="text-muted-foreground">→ 합산 {allLoadedIds?.size ?? 0}건 / {filtered.length}건 표시</span>
            <button onClick={() => { setLoadedSuites([]); setLoadedHistories([]); }} className="ml-auto shrink-0 text-muted-foreground hover:text-foreground">전체 해제</button>
          </div>
        )}

        {historyModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="flex w-[480px] max-h-[70vh] flex-col rounded-xl border border-border bg-card shadow-xl">
              <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
                <h3 className="text-sm font-semibold">히스토리에서 불러오기</h3>
                <button onClick={() => setHistoryModalOpen(false)} className="text-muted-foreground hover:text-foreground">✕</button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {historyRuns.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">저장된 실행 히스토리가 없습니다</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {historyRuns.map((r) => {
                      const rate = r.total ? Math.round(((r.total - r.fail) / r.total) * 100) : 0;
                      return (
                        <li key={r.id}>
                          <button
                            onClick={() => applyHistoryFilter(r)}
                            className="flex w-full flex-col gap-1 px-5 py-3 text-left hover:bg-muted/40"
                          >
                            <div className="flex items-center gap-2">
                              <span className={cn('text-xs font-bold', r.fail === 0 ? 'text-success' : rate >= 50 ? 'text-warning' : 'text-destructive')}>{rate}%</span>
                              <span className="flex-1 text-xs font-medium text-foreground">{r.label || `Run #${r.id}`}</span>
                              <span className="text-[10px] text-muted-foreground">{r.finished_at ? new Date(r.finished_at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}</span>
                            </div>
                            <div className="flex gap-2 text-[10px] text-muted-foreground">
                              <span>{r.total}건</span>
                              <span className="text-success">{r.total - r.fail}P</span>
                              <span className="text-destructive">{r.fail}F</span>
                              <span className="truncate">{r.base_url}</span>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        {suiteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="flex w-[440px] max-h-[60vh] flex-col rounded-xl border border-border bg-card shadow-xl">
              <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
                <h3 className="text-sm font-semibold">Suite 불러오기</h3>
                <button onClick={() => setSuiteModalOpen(false)} className="text-muted-foreground hover:text-foreground">✕</button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {suiteList.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">저장된 Suite가 없습니다</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {suiteList.map((s) => (
                      <li key={s.id}>
                        <button
                          onClick={() => applySuite(s)}
                          className="flex w-full flex-col gap-1 px-5 py-3 text-left hover:bg-muted/40"
                        >
                          <div className="flex items-center gap-2">
                            <span className="flex-1 text-xs font-medium text-foreground">{s.name}</span>
                            {s.is_default && <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">기본</span>}
                          </div>
                          <div className="flex gap-3 text-[10px] text-muted-foreground">
                            <span>케이스 {s.case_ids.length}건</span>
                            <span>플로우 {s.flow_ids.length}개</span>
                            {s.description && <span className="truncate">{s.description}</span>}
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">
                  <input
                    type="checkbox"
                    className="cursor-pointer accent-primary"
                    checked={filtered.length > 0 && filtered.every((c) => checkedIds.has(c.id))}
                    onChange={(e) => {
                      if (e.target.checked) setCheckedIds(new Set(filtered.map((c) => c.id)));
                      else setCheckedIds(new Set());
                    }}
                  />
                </TableHead>
                <TableHead>ID</TableHead><TableHead>테스트 항목명</TableHead><TableHead>구분</TableHead><TableHead>카테고리</TableHead>
                <TableHead>입력값</TableHead><TableHead>기대 결과</TableHead><TableHead>실제 결과</TableHead><TableHead>P/F</TableHead>
                <TableHead>담당자</TableHead><TableHead>수행일자</TableHead><TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={12} className="py-11 text-center text-muted-foreground">📋 테스트 케이스를 추가해주세요</TableCell></TableRow>
              )}
              {filtered.map((c) => {
                const cat = cats.find((x) => x.id === c.catId);
                const checked = checkedIds.has(c.id);
                return (
                  <TableRow key={c.id} className={checked ? 'bg-primary/5' : undefined}>
                    <TableCell>
                      <input
                        type="checkbox"
                        className="cursor-pointer accent-primary"
                        checked={checked}
                        onChange={(e) => {
                          setCheckedIds((prev) => {
                            const next = new Set(prev);
                            e.target.checked ? next.add(c.id) : next.delete(c.id);
                            return next;
                          });
                        }}
                      />
                    </TableCell>
                    <TableCell className="font-mono text-xs text-primary">{c.id}</TableCell>
                    <TableCell>{c.name}</TableCell>
                    <TableCell>
                      <Badge variant={c.type === 'Positive' ? 'default' : 'secondary'}>{c.type}</Badge>
                    </TableCell>
                    <TableCell>
                      {cat ? <span className="inline-flex items-center gap-1.5"><span className="size-2 rounded-sm" style={{ background: cat.color }} />{cat.name}</span> : '-'}
                    </TableCell>
                    <TableCell>{c.input || '-'}</TableCell>
                    <TableCell>{c.expected || '-'}</TableCell>
                    <TableCell>{c.actual || '-'}</TableCell>
                    <TableCell>
                      <Badge className={cn('border-transparent font-bold', c.pf === 'Pass' ? 'bg-success text-success-foreground' : c.pf === 'Fail' ? 'bg-destructive text-destructive-foreground' : 'bg-muted text-muted-foreground')}>
                        {c.pf}
                      </Badge>
                    </TableCell>
                    <TableCell>{c.owner || '-'}</TableCell>
                    <TableCell>{c.date || '-'}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" className="h-7 bg-warning px-2 text-warning-foreground hover:bg-warning/90" onClick={() => startEdit(c)}>수정</Button>
                        <Button size="sm" variant="outline" className="h-7 px-2 text-destructive" onClick={() => { deleteCase(c.id); setCheckedIds((p) => { const n = new Set(p); n.delete(c.id); return n; }); toast.success('케이스를 삭제했습니다'); }}>삭제</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
