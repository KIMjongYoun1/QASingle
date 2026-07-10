import { Fragment, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useQAStore } from '../store/useQAStore';
import { listRuns, getRun, type RunSummary } from '../api/runs';
import { listSuites, type TestSuite } from '../api/suites';
import { listPresets, type ProjectPreset, type PresetKind } from '../api/presets';
import { listEncryptionConfigs, type EncryptionConfig } from '../api/encryptionConfigs';
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
import { ChevronDown, ChevronUp } from 'lucide-react';

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
const STATUS_PRESETS = ['200', '201', '204', '400', '401', '403', '404', '409', '500'];

const METHOD_COLOR: Record<string, string> = {
  GET: 'bg-[#4f8cff]/15 text-[#4f8cff] border-[#4f8cff]/30',
  POST: 'bg-[#16a34a]/15 text-[#16a34a] border-[#16a34a]/30',
  PUT: 'bg-[#d97706]/15 text-[#d97706] border-[#d97706]/30',
  PATCH: 'bg-[#d97706]/15 text-[#d97706] border-[#d97706]/30',
  DELETE: 'bg-destructive/15 text-destructive border-destructive/30',
};

function bodyFieldCount(body?: string): number {
  if (!body || !body.trim()) return 0;
  try {
    const obj = JSON.parse(body);
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) return Object.keys(obj).length;
  } catch { /* not JSON */ }
  return 0;
}

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

function parseBodyValue(v: string): unknown {
  try { return JSON.parse(v); } catch { return v; }
}

function serializeBodyFields(rows: KV[]): string {
  if (rows.length === 0) return '';
  const obj: Record<string, unknown> = {};
  for (const r of rows) {
    if (!r.key) continue;
    obj[r.key] = parseBodyValue(r.value);
  }
  return JSON.stringify(obj, null, 2);
}

function parseBodyFields(bodyStr: string): KV[] {
  if (!bodyStr || !bodyStr.trim()) return [];
  try {
    const obj = JSON.parse(bodyStr);
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
      return Object.entries(obj).map(([key, value]) => ({
        key, value: typeof value === 'string' ? value : JSON.stringify(value),
      }));
    }
  } catch { /* not a flat JSON object — fall through */ }
  return [];
}

const OPERATORS_BY_TARGET: Record<Assertion['target'], Assertion['operator'][]> = {
  status_code: ['eq', 'gt', 'lt'],
  body_json: ['eq', 'contains', 'not_contains', 'exists', 'not_exists', 'gt', 'lt'],
  body_text: ['eq', 'contains', 'not_contains'],
  header: ['eq', 'contains', 'not_contains', 'exists', 'not_exists'],
};

function AssertionEditor({ rows, onChange, pathSuggestions }: { rows: Assertion[]; onChange: (rows: Assertion[]) => void; pathSuggestions?: string[] }) {
  const update = (idx: number, patch: Partial<Assertion>) => onChange(rows.map((r, i) => i === idx ? { ...r, ...patch } : r));
  const remove = (idx: number) => onChange(rows.filter((_, i) => i !== idx));
  const add = () => onChange([...rows, { target: 'status_code', operator: 'eq', value: '' }]);
  const needsPath = (t: Assertion['target']) => t === 'body_json' || t === 'header';
  const needsValue = (op: Assertion['operator']) => op !== 'exists' && op !== 'not_exists';
  const availableOperators = (t: Assertion['target']) =>
    ASSERTION_OPERATORS.filter((op) => OPERATORS_BY_TARGET[t].includes(op.value));
  const onTargetChange = (i: number, t: Assertion['target']) => {
    const allowed = OPERATORS_BY_TARGET[t];
    const currentOp = rows[i].operator;
    update(i, { target: t, path: '', ...(allowed.includes(currentOp) ? {} : { operator: allowed[0] }) });
  };

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
                onChange={(e) => onTargetChange(i, e.target.value as Assertion['target'])}
                className="h-7 rounded border border-input bg-background px-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {ASSERTION_TARGETS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              {needsPath(r.target) && (
                <>
                  <input
                    list={r.target === 'body_json' ? `assertionBodyPathSuggestions-${i}` : undefined}
                    placeholder={r.target === 'body_json' ? '예: code, message, data.status' : 'Content-Type'}
                    value={r.path || ''}
                    onChange={(e) => update(i, { path: e.target.value })}
                    className="h-7 w-32 rounded border border-input bg-background px-1.5 font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  {r.target === 'body_json' && (
                    <datalist id={`assertionBodyPathSuggestions-${i}`}>
                      {(pathSuggestions || [])
                        .filter((v, idx, arr) => arr.indexOf(v) === idx)
                        .map((v) => <option key={v} value={v} />)}
                    </datalist>
                  )}
                </>
              )}
              <select
                value={r.operator}
                onChange={(e) => update(i, { operator: e.target.value as Assertion['operator'] })}
                className="h-7 rounded border border-input bg-background px-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {availableOperators(r.target).map((op) => <option key={op.value} value={op.value}>{op.label}</option>)}
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

function KVEditor({ title, rows, onChange, presets }: { title: string; rows: KV[]; onChange: (rows: KV[]) => void; presets?: ProjectPreset[] }) {
  const update = (idx: number, patch: Partial<KV>) => {
    if (patch.key != null && patch.key !== '' && rows.some((r, i) => i !== idx && r.key === patch.key)) {
      toast.error(`이미 있는 키입니다: ${patch.key}`);
      return;
    }
    onChange(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };
  const remove = (idx: number) => onChange(rows.filter((_, i) => i !== idx));
  const add = () => onChange([...rows, { key: '', value: '' }]);
  const addFromPreset = (p: ProjectPreset) => {
    if (rows.some((r) => r.key === p.key)) {
      toast.error(`이미 추가된 키입니다: ${p.key}`);
      return;
    }
    onChange([...rows, { key: p.key || '', value: p.value }]);
  };
  return (
    <div className="mb-2">
      <label className="mb-1 block text-[11px] text-muted-foreground">{title}</label>
      <div className="mb-1 flex flex-wrap items-center justify-end gap-1.5">
        {presets && presets.length > 0 && (
          <select
            value=""
            onChange={(e) => {
              const p = presets.find((x) => String(x.id) === e.target.value);
              if (p) addFromPreset(p);
            }}
            className="h-6 min-w-0 flex-1 rounded border border-input bg-background px-1 text-[11px] text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">저장된 값에서 추가</option>
            {presets.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        )}
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

  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [bodyFields, setBodyFields] = useState<KV[]>([]);
  const [bodyRawText, setBodyRawText] = useState('');
  const [presets, setPresets] = useState<ProjectPreset[]>([]);
  useEffect(() => {
    if (projectId) listPresets(projectId).then(setPresets).catch(() => setPresets([]));
  }, [projectId]);
  const presetsByKind = (kind: PresetKind) => presets.filter((p) => p.kind === kind);

  const [encryptionConfigs, setEncryptionConfigs] = useState<EncryptionConfig[]>([]);
  useEffect(() => {
    if (projectId) listEncryptionConfigs(projectId).then(setEncryptionConfigs).catch(() => setEncryptionConfigs([]));
  }, [projectId]);
  const [encrypted, setEncrypted] = useState(false);
  const [encryptionScope, setEncryptionScope] = useState<'body' | 'param'>('body');
  const [encryptionKeyBase64, setEncryptionKeyBase64] = useState('');
  const [encryptionMode, setEncryptionMode] = useState<'GCM' | 'CBC'>('GCM');
  const [encryptedFieldKeys, setEncryptedFieldKeys] = useState<string[]>([]);
  const toggleEncryptedField = (key: string) => setEncryptedFieldKeys((prev) =>
    prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
  );

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterPF, setFilterPF] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [entryMode, setEntryModeRaw] = useState<'category' | 'manual'>('manual');
  const setEntryMode = (mode: 'category' | 'manual') => {
    if (mode === entryMode) return;
    // 방금 있던 모드에서 수정한 내용을 그대로 반영해서 넘어감 (이전 값이 남아있지 않도록 무조건 덮어씀)
    if (mode === 'manual') setBodyRawText(serializeBodyFields(bodyFields));
    if (mode === 'category') setBodyFields(parseBodyFields(bodyRawText));
    setEntryModeRaw(mode);
  };

  // 직전에 카테고리 자동 적용으로 채워넣은 헤더/파라미터 key, baseUrl 자동 적용 여부를 기억해뒀다가
  // 다른 카테고리로 바꾸면 그 전 카테고리가 넣어준 값만 지우고 새 카테고리 값으로 교체한다.
  const lastAppliedRef = useRef<{ headerKeys: string[]; paramKeys: string[]; bodyKeys: string[]; baseUrlApplied: boolean }>({
    headerKeys: [], paramKeys: [], bodyKeys: [], baseUrlApplied: false,
  });

  const applyCategory = (v: string) => {
    const catId = !v || v === '__none' ? '' : v;
    const catPresets = presets.filter((p) => p.category_id === catId);
    if (catPresets.some((p) => p.kind === 'header' || p.kind === 'param' || p.kind === 'body')) setShowAdvanced(true);

    const prevApplied = lastAppliedRef.current;
    const headerPresets = catPresets.filter((p) => p.kind === 'header');
    const paramPresets = catPresets.filter((p) => p.kind === 'param');
    const bodyPresets = catPresets.filter((p) => p.kind === 'body');
    const urlPreset = catPresets.find((p) => p.kind === 'url');

    setForm((prev) => {
      const headersWithoutPrevAuto = prev.headers.filter((h) => !prevApplied.headerKeys.includes(h.key));
      const paramsWithoutPrevAuto = prev.queryParams.filter((q) => !prevApplied.paramKeys.includes(q.key));
      const headerAdds = headerPresets
        .filter((p) => !headersWithoutPrevAuto.some((h) => h.key === p.key))
        .map((p) => ({ key: p.key || '', value: p.value }));
      const paramAdds = paramPresets
        .filter((p) => !paramsWithoutPrevAuto.some((q) => q.key === p.key))
        .map((p) => ({ key: p.key || '', value: p.value }));
      const baseUrlWasAuto = prevApplied.baseUrlApplied;
      const nextBaseUrl = (prev.baseUrl === '' || baseUrlWasAuto)
        ? (urlPreset ? urlPreset.value : '')
        : prev.baseUrl;

      return {
        ...prev,
        catId,
        headers: [...headersWithoutPrevAuto, ...headerAdds],
        queryParams: [...paramsWithoutPrevAuto, ...paramAdds],
        baseUrl: nextBaseUrl,
      };
    });

    setBodyFields((prev) => {
      const withoutPrevAuto = prev.filter((b) => !prevApplied.bodyKeys.includes(b.key));
      const bodyAdds = bodyPresets
        .filter((p) => !withoutPrevAuto.some((b) => b.key === p.key))
        .map((p) => ({ key: p.key || '', value: p.value }));
      return [...withoutPrevAuto, ...bodyAdds];
    });

    lastAppliedRef.current = {
      headerKeys: headerPresets.map((p) => p.key || ''),
      paramKeys: paramPresets.map((p) => p.key || ''),
      bodyKeys: bodyPresets.map((p) => p.key || ''),
      baseUrlApplied: !!urlPreset,
    };
  };

  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const toggleExpanded = (id: string) => setExpandedIds((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
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
    if (encrypted && !encryptionKeyBase64) { toast.error('암호화 설정을 선택하세요'); return; }
    const payload = {
      ...form,
      input: buildInput(form.method, form.endpoint),
      expectedStatus: form.expectedStatus ? Number(form.expectedStatus) : undefined,
      body: entryMode === 'manual' ? bodyRawText : serializeBodyFields(bodyFields),
      encrypted,
      encryptionScope: encrypted ? encryptionScope : undefined,
      encryptionKeyBase64: encrypted ? encryptionKeyBase64 : undefined,
      encryptionMode: encrypted ? encryptionMode : undefined,
      encryptedFieldKeys: encrypted && encryptionScope === 'param' ? encryptedFieldKeys : undefined,
    };
    const resetEncryption = () => {
      setEncrypted(false); setEncryptionScope('body'); setEncryptionKeyBase64(''); setEncryptionMode('GCM'); setEncryptedFieldKeys([]);
    };
    if (editId) {
      updateCase(editId, { ...payload, id: editId });
      setEditId(null);
      setForm(emptyForm);
      setBodyFields([]);
      setBodyRawText('');
      resetEncryption();
      toast.success('케이스를 수정했습니다');
    } else {
      const c: TestCase = { ...payload, id: form.id || nextId() };
      addCase(c);
      setForm(emptyForm);
      setBodyFields([]);
      setBodyRawText('');
      resetEncryption();
      toast.success('케이스를 추가했습니다');
    }
  };

  const startEdit = (c: TestCase) => {
    setEditId(c.id);
    setBodyFields(parseBodyFields(c.body || ''));
    setBodyRawText(c.body || '');
    setEntryMode(c.catId ? 'category' : 'manual');
    setEncrypted(!!c.encrypted);
    setEncryptionScope(c.encryptionScope || 'body');
    setEncryptionKeyBase64(c.encryptionKeyBase64 || '');
    setEncryptionMode(c.encryptionMode || 'GCM');
    setEncryptedFieldKeys(c.encryptedFieldKeys || []);
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
  const cancelEdit = () => {
    setEditId(null); setForm(emptyForm); setBodyFields([]); setBodyRawText(''); setShowAdvanced(false);
    setEncrypted(false); setEncryptionScope('body'); setEncryptionKeyBase64(''); setEncryptionMode('GCM'); setEncryptedFieldKeys([]);
  };

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

          {/* 시작 방식 선택 */}
          <div className="mb-2.5 rounded-md border border-border bg-muted/30 p-2">
            <div className="mb-1.5 flex gap-1.5">
              <button
                type="button"
                onClick={() => setEntryMode('category')}
                className={cn(
                  'flex-1 rounded-lg border py-1.5 text-xs font-medium transition-all',
                  entryMode === 'category' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-secondary/60'
                )}
              >
                카테고리로 선택하기
              </button>
              <button
                type="button"
                onClick={() => setEntryMode('manual')}
                className={cn(
                  'flex-1 rounded-lg border py-1.5 text-xs font-medium transition-all',
                  entryMode === 'manual' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-secondary/60'
                )}
              >
                직접입력
              </button>
            </div>
            {entryMode === 'category' && (
              <>
                <label className="mb-1 block text-[11px] text-muted-foreground">
                  카테고리를 고르면 그 카테고리에 등록된 헤더 · 파라미터 · 서버주소가 자동으로 채워집니다
                </label>
                <Select
                  value={form.catId || '__none'}
                  onValueChange={applyCategory}
                  items={[{ value: '__none', label: '-- 카테고리 선택 --' }, ...cats.map((c) => ({ value: c.id, label: c.name }))]}
                >
                  <SelectTrigger className="h-8 w-full text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">-- 카테고리 선택 --</SelectItem>
                    {cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </>
            )}
          </div>

          <div className="mb-2 grid grid-cols-2 gap-1.5">
            <div>
              <label className="mb-1 block text-[11px] text-muted-foreground">케이스 ID</label>
              <Input placeholder={nextId()} value={form.id} disabled={!!editId} onChange={(e) => setForm({ ...form, id: e.target.value })} className="h-8 text-xs" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-muted-foreground">유형 — 정상/비정상 케이스</label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm({ ...form, type: v as CaseType })}
                items={[{ value: 'Positive', label: 'Positive' }, { value: 'Negative', label: 'Negative' }]}
              >
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
            <div className="mb-1.5 -mx-2 -mt-2 rounded-t-md border-b-2 border-primary/40 bg-primary/10 px-2.5 py-1.5 text-[11px] font-semibold text-foreground">API 요청 설정 — 실제 호출에 사용되는 정보</div>
            <div className="mb-1.5">
              <label className="mb-0.5 block text-[10px] text-muted-foreground">서버 주소 — 비워두면 전역 설정 사용, 저장된 값이 있으면 입력 중 목록에 표시됨</label>
              <input
                list="baseUrlPresets"
                placeholder="예: http://localhost:8090"
                value={form.baseUrl}
                onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
                className="h-8 w-full rounded-md border border-input bg-background px-2.5 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <datalist id="baseUrlPresets">
                {presetsByKind('url').map((p) => <option key={p.id} value={p.value}>{p.label}</option>)}
              </datalist>
            </div>

            <div className="mb-0.5 grid grid-cols-[88px_1fr] gap-1.5">
              <label className="block text-[10px] text-muted-foreground">메서드</label>
              <label className="block text-[10px] text-muted-foreground">엔드포인트 경로 — 예: /users/{'{id}'}</label>
            </div>
            <div className="mb-1.5 grid grid-cols-[88px_1fr] gap-1.5">
              <Select
                value={form.method || '__none'}
                onValueChange={(v) => setForm({ ...form, method: !v || v === '__none' ? '' : v })}
                items={[{ value: '__none', label: '-- Method --' }, ...METHODS.map((m) => ({ value: m, label: m }))]}
              >
                <SelectTrigger className="h-8 w-full text-xs"><SelectValue placeholder="Method" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">-- Method --</SelectItem>
                  {METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="min-w-0">
                <Input
                  list="endpointPathPresets"
                  placeholder="/users/{id}"
                  value={form.endpoint}
                  onChange={(e) => setForm({ ...form, endpoint: e.target.value })}
                  className="h-8 font-mono text-xs"
                />
                <datalist id="endpointPathPresets">
                  {presetsByKind('path').map((p) => <option key={p.id} value={p.value}>{p.label}</option>)}
                </datalist>
              </div>
            </div>

            <div>
              <label className="mb-0.5 block text-[10px] text-muted-foreground">성공 상태코드 — 목록에서 고르거나 직접 숫자 입력</label>
              <input
                list="expectedStatusPresets"
                inputMode="numeric"
                placeholder="예: 200"
                value={form.expectedStatus}
                onChange={(e) => setForm({ ...form, expectedStatus: e.target.value.replace(/\D/g, '') })}
                className="h-8 w-full rounded-md border border-input bg-background px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <datalist id="expectedStatusPresets">
                {STATUS_PRESETS.map((s) => <option key={s} value={s} />)}
              </datalist>
            </div>
            {(form.method || form.endpoint) && (
              <div className="mt-1.5 font-mono text-[11px] text-primary">
                {form.method && <span className="mr-1 text-muted-foreground">{form.method}</span>}
                {form.baseUrl ? form.baseUrl.replace(/\/$/, '') : <span className="text-muted-foreground/60">[전역URL]</span>}
                {form.endpoint}
              </div>
            )}

            <div className="mt-3 border-t-2 border-primary/40 pt-2">
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="flex w-full items-center justify-between rounded-md bg-primary/10 px-2.5 py-1.5 text-[11px] font-semibold text-foreground hover:bg-primary/15"
              >
                <span>요청 세부 설정 — 헤더 · 파라미터 · 전송 데이터 · 성공 조건</span>
                {showAdvanced ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
              </button>
              {showAdvanced && (
                <div className="mt-2 rounded-md border-l-2 border-primary/40 bg-background/60 pl-2.5 py-1">
                  <KVEditor title="요청 헤더 — 인증 토큰 등 추가 정보" rows={form.headers} onChange={(rows) => setForm({ ...form, headers: rows })} presets={presetsByKind('header')} />
                  <KVEditor title="URL 파라미터 — ?key=value 형태로 붙는 값" rows={form.queryParams} onChange={(rows) => setForm({ ...form, queryParams: rows })} presets={presetsByKind('param')} />
                  {entryMode === 'category' ? (
                    <KVEditor title="요청 바디 — API에 전송할 JSON 필드" rows={bodyFields} onChange={setBodyFields} presets={presetsByKind('body')} />
                  ) : (
                    <div className="mb-2">
                      <label className="mb-1 block text-[11px] text-muted-foreground">요청 바디 — JSON 직접 입력</label>
                      <Textarea
                        rows={4}
                        placeholder={'{\n  "key": "value"\n}'}
                        value={bodyRawText}
                        onChange={(e) => setBodyRawText(e.target.value)}
                        className="font-mono text-xs"
                      />
                    </div>
                  )}

                  <div className="mb-2 rounded-md border border-border bg-muted/30 p-2">
                    <label className="flex cursor-pointer items-center gap-2 text-[11px] font-semibold text-foreground">
                      <input type="checkbox" checked={encrypted} onChange={(e) => setEncrypted(e.target.checked)} className="size-3.5 accent-primary" />
                      암호화 호출 — 요청을 암호화해서 보내고 응답을 복호화해서 판정
                    </label>
                    {encrypted && (
                      <div className="mt-2 flex flex-col gap-2">
                        <div>
                          <label className="mb-1 block text-[10px] text-muted-foreground">암호화 설정 선택</label>
                          <select
                            value=""
                            onChange={(e) => {
                              const cfg = encryptionConfigs.find((c) => String(c.id) === e.target.value);
                              if (cfg) { setEncryptionKeyBase64(cfg.key_base64); setEncryptionMode(cfg.mode); }
                            }}
                            className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                          >
                            <option value="">
                              {encryptionKeyBase64 ? `선택됨: ${encryptionMode} 키 ...${encryptionKeyBase64.slice(-8)}` : '-- 암호화 설정 선택 --'}
                            </option>
                            {encryptionConfigs.map((c) => <option key={c.id} value={c.id}>{c.label} ({c.mode})</option>)}
                          </select>
                          {encryptionConfigs.length === 0 && (
                            <p className="mt-1 text-[10px] text-muted-foreground">등록된 암호화 설정이 없습니다 — 사이드바 "암호화 설정" 메뉴에서 먼저 등록하세요.</p>
                          )}
                        </div>

                        <div>
                          <label className="mb-1 block text-[10px] text-muted-foreground">암호화 범위</label>
                          <div className="flex gap-1.5">
                            <button type="button" onClick={() => setEncryptionScope('body')} className={cn('flex-1 rounded-lg border py-1.5 text-xs font-medium transition-all', encryptionScope === 'body' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-secondary/60')}>바디 전체</button>
                            <button type="button" onClick={() => setEncryptionScope('param')} className={cn('flex-1 rounded-lg border py-1.5 text-xs font-medium transition-all', encryptionScope === 'param' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-secondary/60')}>파라미터 단위</button>
                          </div>
                        </div>

                        {encryptionScope === 'param' && (
                          <div>
                            <label className="mb-1 block text-[10px] text-muted-foreground">암호화할 필드 선택 (체크한 필드만 개별 암호화, 나머지는 평문)</label>
                            {bodyFields.length === 0 ? (
                              <p className="text-[11px] text-muted-foreground">바디 필드가 없습니다 — 먼저 바디에 필드를 추가하세요.</p>
                            ) : (
                              <div className="flex flex-col gap-1 rounded-md border border-border bg-background/60 p-1.5">
                                {bodyFields.map((f) => (
                                  <label key={f.key} className="flex cursor-pointer items-center gap-2 text-[11px]">
                                    <input type="checkbox" checked={encryptedFieldKeys.includes(f.key)} onChange={() => toggleEncryptedField(f.key)} className="size-3.5 accent-primary" />
                                    <span className="font-mono">{f.key}</span>
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <AssertionEditor rows={form.assertions} onChange={(rows) => setForm({ ...form, assertions: rows })} pathSuggestions={presetsByKind('assertion_path').map((p) => p.value)} />
                </div>
              )}
            </div>
          </div>
          <div className="mb-2">
            <label className="mb-1 block rounded-md border-b-2 border-primary/40 bg-primary/10 px-2 py-1 text-[11px] font-semibold text-foreground">기대 결과 — 이 케이스에서 예상되는 동작</label>
            <Textarea rows={2} value={form.expected} onChange={(e) => setForm({ ...form, expected: e.target.value })} className="text-xs" />
          </div>
          <div className="mb-2">
            <label className="mb-1 block rounded-md border-b-2 border-primary/40 bg-primary/10 px-2 py-1 text-[11px] font-semibold text-foreground">실행 결과 — 자동 실행 후 자동으로 채워짐</label>
            <Textarea rows={2} value={form.actual} onChange={(e) => setForm({ ...form, actual: e.target.value })} className="text-xs" />
          </div>
          <div className="mb-2">
            <label className="mb-1 block rounded-md border-b-2 border-primary/40 bg-primary/10 px-2 py-1 text-[11px] font-semibold text-foreground">수동 판정 — 직접 결과를 기록할 때 사용</label>
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
            <label className="mb-1 block rounded-md border-b-2 border-primary/40 bg-primary/10 px-2 py-1 text-[11px] font-semibold text-foreground">카테고리</label>
            <Select
              value={form.catId || '__none'}
              onValueChange={applyCategory}
              items={[{ value: '__none', label: '-- 미분류 --' }, ...cats.map((c) => ({ value: c.id, label: c.name }))]}
            >
              <SelectTrigger className="h-8 w-full text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">-- 미분류 --</SelectItem>
                {cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="mb-2 grid grid-cols-2 gap-1.5">
            <div>
              <label className="mb-1 block rounded-md border-b-2 border-primary/40 bg-primary/10 px-2 py-1 text-[11px] font-semibold text-foreground">담당자</label>
              <Input value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} className="h-8 text-xs" />
            </div>
            <div>
              <label className="mb-1 block rounded-md border-b-2 border-primary/40 bg-primary/10 px-2 py-1 text-[11px] font-semibold text-foreground">수행일자</label>
              <Input type="datetime-local" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="h-8 text-xs" />
            </div>
          </div>
          <Button onClick={submit} className="w-full">
            {editId ? '✔ 수정 완료' : '+ 케이스 추가'}
          </Button>
          {editId && <Button onClick={cancelEdit} variant="outline" className="mt-1 w-full">✕ 수정 취소</Button>}
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
          <Select
            value={filterType || '__all'}
            onValueChange={(v) => setFilterType(!v || v === '__all' ? '' : v)}
            items={[{ value: '__all', label: '전체 구분' }, { value: 'Positive', label: 'Positive' }, { value: 'Negative', label: 'Negative' }]}
          >
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">전체 구분</SelectItem>
              <SelectItem value="Positive">Positive</SelectItem>
              <SelectItem value="Negative">Negative</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={filterPF || '__all'}
            onValueChange={(v) => setFilterPF(!v || v === '__all' ? '' : v)}
            items={[{ value: '__all', label: '전체 P/F' }, { value: 'Pass', label: 'Pass' }, { value: 'Fail', label: 'Fail' }, { value: 'N/A', label: 'N/A' }]}
          >
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
                <TableHead>요청</TableHead><TableHead>설정값</TableHead><TableHead>P/F</TableHead><TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={9} className="py-11 text-center text-muted-foreground">📋 테스트 케이스를 추가해주세요</TableCell></TableRow>
              )}
              {filtered.map((c) => {
                const cat = cats.find((x) => x.id === c.catId);
                const checked = checkedIds.has(c.id);
                const expanded = expandedIds.has(c.id);
                const headerCount = c.headers?.length || 0;
                const paramCount = c.queryParams?.length || 0;
                const bodyCount = bodyFieldCount(c.body);
                const assertionCount = c.assertions?.length || 0;
                return (
                  <Fragment key={c.id}>
                  <TableRow className={checked ? 'bg-primary/5' : undefined}>
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
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {c.method && (
                          <span className={cn('rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold', METHOD_COLOR[c.method] || 'bg-muted text-muted-foreground border-border')}>
                            {c.method}
                          </span>
                        )}
                        <span className="font-mono text-xs">{c.endpoint || c.input || '-'}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <button
                        onClick={() => toggleExpanded(c.id)}
                        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                        title="요청 상세 보기"
                      >
                        <span className="rounded bg-secondary px-1.5 py-0.5">헤더 {headerCount}</span>
                        <span className="rounded bg-secondary px-1.5 py-0.5">파라미터 {paramCount}</span>
                        <span className="rounded bg-secondary px-1.5 py-0.5">바디 {bodyCount}</span>
                        <span className="rounded bg-secondary px-1.5 py-0.5">조건 {assertionCount}</span>
                        {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                      </button>
                    </TableCell>
                    <TableCell>
                      <Badge className={cn('border-transparent font-bold', c.pf === 'Pass' ? 'bg-success text-success-foreground' : c.pf === 'Fail' ? 'bg-destructive text-destructive-foreground' : 'bg-muted text-muted-foreground')}>
                        {c.pf}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" className="h-7 bg-warning px-2 text-warning-foreground hover:bg-warning/90" onClick={() => startEdit(c)}>수정</Button>
                        <Button size="sm" variant="outline" className="h-7 px-2 text-destructive" onClick={() => { deleteCase(c.id); setCheckedIds((p) => { const n = new Set(p); n.delete(c.id); return n; }); toast.success('케이스를 삭제했습니다'); }}>삭제</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  {expanded && (
                    <TableRow key={`${c.id}-detail`}>
                      <TableCell colSpan={9} className="bg-muted/20">
                        <div className="grid grid-cols-2 gap-x-6 gap-y-2 p-2 text-xs">
                          <div>
                            <div className="mb-1 font-semibold text-muted-foreground">서버 주소</div>
                            <div className="font-mono">{c.baseUrl || '[전역 URL]'}</div>
                          </div>
                          <div>
                            <div className="mb-1 font-semibold text-muted-foreground">성공 상태코드</div>
                            <div className="font-mono">{c.expectedStatus ?? '-'}</div>
                          </div>
                          <div>
                            <div className="mb-1 font-semibold text-muted-foreground">헤더</div>
                            {c.headers?.length ? c.headers.map((h, i) => (
                              <div key={i} className="font-mono"><span className="font-bold text-foreground">{h.key}</span> <span className="text-muted-foreground">=</span> {h.value}</div>
                            )) : <div className="text-muted-foreground">없음</div>}
                          </div>
                          <div>
                            <div className="mb-1 font-semibold text-muted-foreground">URL 파라미터</div>
                            {c.queryParams?.length ? c.queryParams.map((q, i) => (
                              <div key={i} className="font-mono"><span className="font-bold text-foreground">{q.key}</span> <span className="text-muted-foreground">=</span> {q.value}</div>
                            )) : <div className="text-muted-foreground">없음</div>}
                          </div>
                          <div className="col-span-2">
                            <div className="mb-1 font-semibold text-muted-foreground">요청 바디</div>
                            {c.body ? (
                              parseBodyFields(c.body).length > 0 ? (
                                parseBodyFields(c.body).map((b, i) => (
                                  <div key={i} className="font-mono"><span className="font-bold text-foreground">{b.key}</span> <span className="text-muted-foreground">=</span> {b.value}</div>
                                ))
                              ) : (
                                <pre className="whitespace-pre-wrap font-mono">{c.body}</pre>
                              )
                            ) : <div className="text-muted-foreground">없음</div>}
                          </div>
                          <div className="col-span-2">
                            <div className="mb-1 font-semibold text-muted-foreground">성공 판정 조건</div>
                            {c.assertions?.length ? c.assertions.map((a, i) => (
                              <div key={i} className="font-mono">{a.target} {a.operator} {a.value ?? ''}</div>
                            )) : <div className="text-muted-foreground">없음 — 상태코드 일치 여부로만 판정</div>}
                          </div>
                          <div>
                            <div className="mb-1 font-semibold text-muted-foreground">기대 결과 / 실제 결과</div>
                            <div>{c.expected || '-'} / {c.actual || '-'}</div>
                          </div>
                          <div>
                            <div className="mb-1 font-semibold text-muted-foreground">담당자 / 수행일자</div>
                            <div>{c.owner || '-'} / {c.date || '-'}</div>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
