import { useState } from 'react';
import { toast } from 'sonner';
import { useQAStore } from '../store/useQAStore';
import type { Assertion, CaseType, KV, PF, TestCase } from '../types/qa';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

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

function buildInput(method: string, endpoint: string) {
  return [method, endpoint].filter(Boolean).join(' ');
}

function KVEditor({ title, rows, onChange }: { title: string; rows: KV[]; onChange: (rows: KV[]) => void }) {
  const update = (idx: number, patch: Partial<KV>) => onChange(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  return (
    <div className="mb-2">
      <div className="mb-1 flex items-center justify-between">
        <label className="text-[11px] text-muted-foreground">{title}</label>
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

function AssertionEditor({ rows, onChange }: { rows: Assertion[]; onChange: (rows: Assertion[]) => void }) {
  const update = (idx: number, patch: Partial<Assertion>) => onChange(rows.map((r, i) => i === idx ? { ...r, ...patch } : r));
  const needsPath = (t: Assertion['target']) => t === 'body_json' || t === 'header';
  const needsValue = (op: Assertion['operator']) => op !== 'exists' && op !== 'not_exists';
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
              <select value={r.target} onChange={(e) => update(i, { target: e.target.value as Assertion['target'], path: '' })} className="h-7 rounded border border-input bg-background px-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-ring">
                {ASSERTION_TARGETS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              {needsPath(r.target) && (
                <input placeholder={r.target === 'body_json' ? 'data.success' : 'Content-Type'} value={r.path || ''} onChange={(e) => update(i, { path: e.target.value })} className="h-7 w-28 rounded border border-input bg-background px-1.5 font-mono text-[11px] focus:outline-none focus:ring-1 focus:ring-ring" />
              )}
              <select value={r.operator} onChange={(e) => update(i, { operator: e.target.value as Assertion['operator'] })} className="h-7 rounded border border-input bg-background px-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-ring">
                {ASSERTION_OPERATORS.map((op) => <option key={op.value} value={op.value}>{op.label}</option>)}
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

  const cats = data.mgr.cats;
  const cases = data.mgr.cases;

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

  const submit = () => {
    if (!form.name.trim()) { toast.error('테스트 이름을 입력하세요'); return; }
    const payload: TestCase = {
      ...form,
      id: editCase ? editCase.id : (form.id || nextId()),
      input: buildInput(form.method, form.endpoint),
      expectedStatus: form.expectedStatus ? Number(form.expectedStatus) : undefined,
    };
    if (editCase) {
      updateCase(editCase.id, payload);
      toast.success('케이스를 수정했습니다');
    } else {
      addCase(payload);
      toast.success('케이스를 추가했습니다');
    }
    onSaved?.(payload.id);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="flex max-h-[90vh] w-[560px] max-w-[95vw] flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{editCase ? '케이스 수정' : '새 케이스 추가'}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-1">
          {/* ID + 유형 */}
          <div className="mb-2 grid grid-cols-2 gap-1.5">
            <div>
              <label className="mb-1 block text-[11px] text-muted-foreground">케이스 ID</label>
              <Input placeholder={nextId()} value={form.id} disabled={!!editCase} onChange={(e) => setForm({ ...form, id: e.target.value })} className="h-8 text-xs" />
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

          {/* 이름 */}
          <div className="mb-2">
            <label className="mb-1 block text-[11px] text-muted-foreground">테스트 이름 — 어떤 케이스인지 설명</label>
            <Textarea rows={2} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="text-xs" />
          </div>

          {/* API 요청 설정 */}
          <div className="mb-2 rounded-md border border-border bg-muted/30 p-2">
            <div className="mb-1.5 text-[11px] font-semibold text-muted-foreground">API 요청 설정 — 실제 호출에 사용되는 정보</div>
            <div className="mb-1.5">
              <Input placeholder="서버 주소 (비워두면 전역 설정 사용)" value={form.baseUrl} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} className="h-8 font-mono text-xs" />
            </div>
            <div className="mb-1.5 grid grid-cols-[88px_1fr] gap-1.5">
              <Select value={form.method || '__none'} onValueChange={(v) => setForm({ ...form, method: !v || v === '__none' ? '' : v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Method" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">-- Method --</SelectItem>
                  {METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input placeholder="/users/{id}" value={form.endpoint} onChange={(e) => setForm({ ...form, endpoint: e.target.value })} className="h-8 font-mono text-xs" />
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <Select value={form.expectedStatus || '__none'} onValueChange={(v) => setForm({ ...form, expectedStatus: !v || v === '__none' ? '' : v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="성공 상태코드 선택" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">-- 성공 상태코드 선택 --</SelectItem>
                  {STATUS_PRESETS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input placeholder="직접 입력 (선택)" value={STATUS_PRESETS.includes(form.expectedStatus) ? '' : form.expectedStatus} onChange={(e) => setForm({ ...form, expectedStatus: e.target.value.replace(/\D/g, '') })} className="h-8 text-xs" />
            </div>
            {(form.method || form.endpoint) && (
              <div className="mt-1.5 font-mono text-[11px] text-primary">
                {form.method && <span className="mr-1 text-muted-foreground">{form.method}</span>}
                {form.baseUrl ? form.baseUrl.replace(/\/$/, '') : <span className="text-muted-foreground/60">[전역URL]</span>}
                {form.endpoint}
              </div>
            )}

            {/* 고급 설정 */}
            <div className="mt-2.5 border-t border-border pt-2">
              <button type="button" onClick={() => setShowAdvanced((v) => !v)} className="flex w-full items-center justify-between text-[11px] font-semibold text-muted-foreground hover:text-foreground">
                <span>요청 세부 설정 — 헤더 · 파라미터 · 전송 데이터 · 성공 조건</span>
                <span>{showAdvanced ? '▲' : '▼'}</span>
              </button>
              {showAdvanced && (
                <div className="mt-2">
                  <KVEditor title="요청 헤더 — 인증 토큰 등 추가 정보" rows={form.headers} onChange={(rows) => setForm({ ...form, headers: rows })} />
                  <KVEditor title="URL 파라미터 — ?key=value 형태로 붙는 값" rows={form.queryParams} onChange={(rows) => setForm({ ...form, queryParams: rows })} />
                  <div className="mb-2">
                    <label className="mb-1 block text-[11px] text-muted-foreground">요청 바디 — API에 전송할 데이터 (JSON 형식)</label>
                    <Textarea rows={3} placeholder={'{\n  "key": "value"\n}'} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} className="font-mono text-xs" />
                  </div>
                  <AssertionEditor rows={form.assertions} onChange={(rows) => setForm({ ...form, assertions: rows })} />
                </div>
              )}
            </div>
          </div>

          {/* 기대 결과 */}
          <div className="mb-2">
            <label className="mb-1 block text-[11px] text-muted-foreground">기대 결과 — 이 케이스에서 예상되는 동작</label>
            <Textarea rows={2} value={form.expected} onChange={(e) => setForm({ ...form, expected: e.target.value })} className="text-xs" />
          </div>

          {/* 카테고리 */}
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
        </div>

        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button onClick={submit}>{editCase ? '저장' : '추가'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
