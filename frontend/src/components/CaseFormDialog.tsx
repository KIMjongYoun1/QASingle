import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useQAStore } from '../store/useQAStore';
import type { Assertion, CaseType, KV, PF, TestCase } from '../types/qa';
import { listPresets, type ProjectPreset, type PresetKind } from '../api/presets';
import { listEncryptionConfigs, type EncryptionConfig } from '../api/encryptionConfigs';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { cn } from '../lib/utils';
import { ChevronDown, ChevronUp } from 'lucide-react';

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
  id: '', name: '', type: 'Positive' as CaseType, method: '', endpoint: '', baseUrl: '',
  expectedStatus: '' as string, input: '', expected: '', actual: '', pf: 'Pass' as PF,
  owner: '', date: '', catId: '', headers: [] as KV[], queryParams: [] as KV[],
  body: '', assertions: [] as Assertion[],
};

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

function buildInput(method: string, endpoint: string) {
  return [method, endpoint].filter(Boolean).join(' ');
}

function KVEditor({ title, rows, onChange, presets }: { title: string; rows: KV[]; onChange: (rows: KV[]) => void; presets?: ProjectPreset[] }) {
  const update = (idx: number, patch: Partial<KV>) => {
    if (patch.key != null && patch.key !== '' && rows.some((r, i) => i !== idx && r.key === patch.key)) {
      toast.error(`이미 있는 키입니다: ${patch.key}`);
      return;
    }
    onChange(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };
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
          <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]" onClick={() => onChange([...rows, { key: '', value: '' }])}>+ 추가</Button>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-2 py-1.5 text-center text-[11px] text-muted-foreground">사용 안 함</p>
      ) : (
        <div className="flex flex-col gap-1">
          {rows.map((r, i) => (
            <div key={i} className="flex gap-1">
              <Input placeholder="key" value={r.key} onChange={(e) => update(i, { key: e.target.value })} className="h-7 flex-1 text-xs" />
              <Input placeholder="value" value={r.value} onChange={(e) => update(i, { value: e.target.value })} className="h-7 flex-1 text-xs" />
              <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive" onClick={() => onChange(rows.filter((_, j) => j !== i))}>✕</Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const OPERATORS_BY_TARGET: Record<Assertion['target'], Assertion['operator'][]> = {
  status_code: ['eq', 'gt', 'lt'],
  body_json: ['eq', 'contains', 'not_contains', 'exists', 'not_exists', 'gt', 'lt'],
  body_text: ['eq', 'contains', 'not_contains'],
  header: ['eq', 'contains', 'not_contains', 'exists', 'not_exists'],
};

function AssertionEditor({ rows, onChange, pathSuggestions }: { rows: Assertion[]; onChange: (rows: Assertion[]) => void; pathSuggestions?: string[] }) {
  const update = (idx: number, patch: Partial<Assertion>) => onChange(rows.map((r, i) => i === idx ? { ...r, ...patch } : r));
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
        <Button size="sm" variant="outline" className="h-6 px-2 text-[11px]" onClick={() => onChange([...rows, { target: 'status_code', operator: 'eq', value: '' }])}>+ 추가</Button>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-2 py-1.5 text-center text-[11px] text-muted-foreground">없음 — 성공 상태코드 일치 여부로만 판정</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {rows.map((r, i) => (
            <div key={i} className="flex flex-wrap items-center gap-1 rounded-md border border-border bg-muted/20 p-1.5">
              <select value={r.target} onChange={(e) => onTargetChange(i, e.target.value as Assertion['target'])} className="h-7 rounded border border-input bg-background px-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-ring">
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
              <select value={r.operator} onChange={(e) => update(i, { operator: e.target.value as Assertion['operator'] })} className="h-7 rounded border border-input bg-background px-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-ring">
                {availableOperators(r.target).map((op) => <option key={op.value} value={op.value}>{op.label}</option>)}
              </select>
              {needsValue(r.operator) && (
                <input placeholder="기대값" value={r.value || ''} onChange={(e) => update(i, { value: e.target.value })} className="h-7 min-w-0 flex-1 rounded border border-input bg-background px-1.5 font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-ring" />
              )}
              <button onClick={() => onChange(rows.filter((_, j) => j !== i))} className="ml-auto h-7 rounded px-2 text-[11px] text-destructive hover:bg-destructive/10">✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  editCase?: TestCase | null;
  onSaved?: (caseId: string) => void;
}

export default function CaseFormDialog({ open, onClose, editCase, onSaved }: Props) {
  const data = useQAStore((s) => s.data);
  const addCase = useQAStore((s) => s.addCase);
  const updateCase = useQAStore((s) => s.updateCase);
  const projectId = useQAStore((s) => s.projectId);

  const cats = data.mgr.cats;
  const cases = data.mgr.cases;

  const [presets, setPresets] = useState<ProjectPreset[]>([]);
  useEffect(() => {
    if (open && projectId) listPresets(projectId).then(setPresets).catch(() => setPresets([]));
  }, [open, projectId]);
  const presetsByKind = (kind: PresetKind) => presets.filter((p) => p.kind === kind);

  const [encryptionConfigs, setEncryptionConfigs] = useState<EncryptionConfig[]>([]);
  useEffect(() => {
    if (open && projectId) listEncryptionConfigs(projectId).then(setEncryptionConfigs).catch(() => setEncryptionConfigs([]));
  }, [open, projectId]);
  const [encrypted, setEncrypted] = useState(!!editCase?.encrypted);
  const [encryptionScope, setEncryptionScope] = useState<'body' | 'param'>(editCase?.encryptionScope || 'body');
  const [encryptionKeyBase64, setEncryptionKeyBase64] = useState(editCase?.encryptionKeyBase64 || '');
  const [encryptionMode, setEncryptionMode] = useState<'GCM' | 'CBC'>(editCase?.encryptionMode || 'GCM');
  const [encryptedFieldKeys, setEncryptedFieldKeys] = useState<string[]>(editCase?.encryptedFieldKeys || []);
  const toggleEncryptedField = (key: string) => setEncryptedFieldKeys((prev) =>
    prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
  );

  const nextId = () => {
    const nums = cases.map((c) => parseInt(c.id.replace(/\D/g, '')) || 0);
    return 'TC-' + String((nums.length ? Math.max(...nums) : 0) + 1).padStart(3, '0');
  };

  const [form, setForm] = useState(() =>
    editCase
      ? {
          ...emptyForm,
          ...editCase,
          method: editCase.method || '',
          endpoint: editCase.endpoint || '',
          baseUrl: editCase.baseUrl || '',
          expectedStatus: editCase.expectedStatus != null ? String(editCase.expectedStatus) : '',
          headers: editCase.headers ? editCase.headers.map((h) => ({ ...h })) : [],
          queryParams: editCase.queryParams ? editCase.queryParams.map((q) => ({ ...q })) : [],
          body: editCase.body || '',
          assertions: editCase.assertions ? editCase.assertions.map((a) => ({ ...a })) : [],
        }
      : emptyForm
  );
  const [showAdvanced, setShowAdvanced] = useState(
    !!(editCase?.baseUrl || editCase?.headers?.length || editCase?.queryParams?.length || editCase?.body || editCase?.assertions?.length)
  );
  const [bodyFields, setBodyFields] = useState<KV[]>(() => parseBodyFields(editCase?.body || ''));
  const [bodyRawText, setBodyRawText] = useState<string>(() => editCase?.body || '');
  const [confirming, setConfirming] = useState(false);
  const [entryMode, setEntryModeRaw] = useState<'category' | 'manual'>(editCase?.catId ? 'category' : 'manual');
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

  const buildPreview = () => {
    const qs = form.queryParams.filter((q) => q.key).map((q) => `${encodeURIComponent(q.key)}=${encodeURIComponent(q.value)}`).join('&');
    const effectiveEndpoint = encrypted ? `/secure${form.endpoint}` : form.endpoint;
    const url = `${form.baseUrl ? form.baseUrl.replace(/\/$/, '') : '[전역 URL]'}${effectiveEndpoint}${qs ? `?${qs}` : ''}`;
    const headers = Object.fromEntries(form.headers.filter((h) => h.key).map((h) => [h.key, h.value]));
    let body: unknown;
    if (entryMode === 'manual') {
      if (bodyRawText.trim()) { try { body = JSON.parse(bodyRawText); } catch { body = bodyRawText; } }
    } else {
      body = bodyFields.length > 0
        ? Object.fromEntries(bodyFields.filter((b) => b.key).map((b) => [b.key, parseBodyValue(b.value)]))
        : undefined;
    }
    return {
      method: form.method || '(미지정)',
      url,
      expectedStatus: form.expectedStatus || '(미지정 — 상태코드만으로 판정 안 함)',
      headers,
      body,
      assertions: form.assertions,
      ...(encrypted ? {
        암호화: `실제 전송 시 ${encryptionScope === 'body' ? '바디 전체' : `필드(${encryptedFieldKeys.join(', ') || '없음'})`}가 암호화되어 위 body 자리는 실제로 encData(또는 *_enc 필드)로 대체됩니다`,
      } : {}),
    };
  };

  const requestConfirm = () => {
    if (!form.name.trim()) { toast.error('테스트 이름을 입력하세요'); return; }
    setConfirming(true);
  };

  const submit = () => {
    const payload: TestCase = {
      ...form,
      id: editCase ? editCase.id : (form.id || nextId()),
      input: buildInput(form.method, form.endpoint),
      expectedStatus: form.expectedStatus ? Number(form.expectedStatus) : undefined,
      body: entryMode === 'manual' ? bodyRawText : serializeBodyFields(bodyFields),
      encrypted,
      encryptionScope: encrypted ? encryptionScope : undefined,
      encryptionKeyBase64: encrypted ? encryptionKeyBase64 : undefined,
      encryptionMode: encrypted ? encryptionMode : undefined,
      encryptedFieldKeys: encrypted && encryptionScope === 'param' ? encryptedFieldKeys : undefined,
    };
    if (encrypted && !encryptionKeyBase64) {
      toast.error('암호화 설정을 선택하세요');
      return;
    }
    if (editCase) {
      updateCase(editCase.id, payload);
      toast.success('케이스를 수정했습니다');
    } else {
      addCase(payload);
      toast.success('케이스를 추가했습니다');
    }
    onSaved?.(payload.id);
    setConfirming(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="flex max-h-[90vh] w-[560px] max-w-[95vw] flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{editCase ? '케이스 수정' : '새 케이스 추가'}</DialogTitle>
        </DialogHeader>

        {confirming ? (
          <div className="flex-1 overflow-y-auto pr-1">
            <p className="mb-2 text-xs text-muted-foreground">
              실제로 호출될 최종 요청 내용입니다. 확인 후 저장하세요.
            </p>
            <pre className="whitespace-pre-wrap break-all rounded-md border border-border bg-muted/30 p-3 font-mono text-[11px] text-foreground">
{JSON.stringify(buildPreview(), null, 2)}
            </pre>
          </div>
        ) : (
        <div className="flex-1 overflow-y-auto pr-1">
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

          {/* ID + 유형 */}
          <div className="mb-2 grid grid-cols-2 gap-1.5">
            <div>
              <label className="mb-1 block text-[11px] text-muted-foreground">케이스 ID</label>
              <Input placeholder={nextId()} value={form.id} disabled={!!editCase} onChange={(e) => setForm({ ...form, id: e.target.value })} className="h-8 text-xs" />
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

          {/* 이름 */}
          <div className="mb-2">
            <label className="mb-1 block text-[11px] text-muted-foreground">테스트 이름 — 어떤 케이스인지 설명</label>
            <Textarea rows={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="text-xs" />
          </div>

          {/* API 요청 설정 */}
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
                <Input list="endpointPathPresets" placeholder="/users/{id}" value={form.endpoint} onChange={(e) => setForm({ ...form, endpoint: e.target.value })} className="h-8 font-mono text-xs" />
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

            {/* 고급 설정 */}
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

          {/* 기대 결과 */}
          <div className="mb-2">
            <label className="mb-1 block rounded-md border-b-2 border-primary/40 bg-primary/10 px-2 py-1 text-[11px] font-semibold text-foreground">기대 결과 — 이 케이스에서 예상되는 동작</label>
            <Textarea rows={2} value={form.expected} onChange={(e) => setForm({ ...form, expected: e.target.value })} className="text-xs" />
          </div>

          {/* 카테고리 (자동 적용 이후에는 참고용으로만 다시 표시) */}
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
        </div>
        )}

        <div className="flex justify-end gap-2 border-t border-border pt-3">
          {confirming ? (
            <>
              <Button variant="outline" onClick={() => setConfirming(false)}>수정으로 돌아가기</Button>
              <Button onClick={submit}>{editCase ? '저장 확정' : '추가 확정'}</Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={onClose}>취소</Button>
              <Button onClick={requestConfirm}>{editCase ? '저장' : '추가'}</Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
