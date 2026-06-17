import * as XLSX from 'xlsx';
import * as XLSXStyle from 'xlsx-js-style';
import type { Category, DepExecution, QAData, TestCase, TstExecution } from '../types/qa';

type Mode = 'tst' | 'dep';
type Execution = TstExecution | DepExecution;

const COVER_FIELDS: Record<Mode, [string, string][]> = {
  tst: [['company', '회사/부서명'], ['project', '프로젝트명'], ['system', '시스템명'], ['version', '버전'], ['docNumber', '문서번호'], ['start', '시작일'], ['end', '종료일'], ['environment', '테스트 환경'], ['author', '작성자'], ['approver', '승인자'], ['date', '작성일']],
  dep: [['company', '회사/부서명'], ['project', '프로젝트명'], ['version', '배포 버전'], ['environment', '배포 환경'], ['docNumber', '문서번호'], ['deployType', '배포 유형'], ['start', '배포 시작'], ['end', '배포 완료'], ['deployer', '배포자'], ['approver', '승인자'], ['date', '작성일'], ['target', '대상 서버'], ['summary', '배포 내용 요약']],
};

const CASE_LABELS = (mode: Mode) => ({
  expected: mode === 'tst' ? '기대 결과' : '확인 기준',
  actual: mode === 'tst' ? '실제 결과' : '확인 결과',
});

function download(filename: string, content: string | Blob, mime?: string) {
  const blob = typeof content === 'string' ? new Blob([content], { type: mime }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const isDone = (pf: string) => pf === 'Pass' || pf === '완료';
const isFail = (pf: string) => pf === 'Fail' || pf === '미완료';

function caseRows(mode: Mode, section: { cats: Category[]; cases: Execution[] }, mgrCases: TestCase[], filterFn?: (c: Execution) => boolean) {
  const cases = filterFn ? section.cases.filter(filterFn) : section.cases;
  return cases.map((c) => {
    const mc = mgrCases.find((m) => m.id === c.id);
    const cat = section.cats.find((k) => k.id === c.catId);
    return {
      ID: c.id,
      카테고리: cat?.name || '',
      항목명: mc?.name || '',
      구분: mc?.type || '',
      입력값: mc?.input || '',
      [CASE_LABELS(mode).expected]: mc?.expected || '',
      [CASE_LABELS(mode).actual]: c.actual,
      결과: c.pf,
      수행자: c.owner,
      수행일자: c.date,
      비고: c.notes,
    };
  });
}

// ---------- JSON ----------

export function exportJSON(mode: Mode, data: QAData, projectName: string) {
  const payload = { mode, cover: data[mode].cover, cats: data[mode].cats, cases: data[mode].cases };
  download(`${projectName}_${mode}_report.json`, JSON.stringify(payload, null, 2), 'application/json');
}

export async function parseJSONReport(file: File): Promise<{ cover: Record<string, string>; cats: Category[]; cases: Execution[] }> {
  const payload = JSON.parse(await file.text());
  if (!Array.isArray(payload?.cases)) throw new Error('잘못된 JSON 형식입니다');
  return { cover: payload.cover || {}, cats: payload.cats || [], cases: payload.cases };
}

// ---------- Excel ----------

const FILL_SUCCESS = { fgColor: { rgb: 'C6EFCE' } };
const FILL_FAIL = { fgColor: { rgb: 'FFC7CE' } };
const FONT_SUCCESS = { color: { rgb: '006100' }, bold: true };
const FONT_FAIL = { color: { rgb: '9C0006' }, bold: true };

export function exportExcel(mode: Mode, data: QAData, mgrCases: TestCase[], projectName: string, filterFn?: (c: Execution) => boolean) {
  const section = data[mode];
  const filtered = filterFn ? section.cases.filter(filterFn) : section.cases;
  const tot = filtered.length;
  const done = filtered.filter((c) => isDone(c.pf)).length;
  const fail = filtered.filter((c) => isFail(c.pf)).length;
  const rate = tot ? Math.round((done / tot) * 100) : 0;

  const wb = XLSXStyle.utils.book_new();
  const coverRows = COVER_FIELDS[mode].map(([key, label]) => ({ 항목: label, 값: (section.cover as any)[key] || '' }));
  XLSXStyle.utils.book_append_sheet(wb, XLSXStyle.utils.json_to_sheet(coverRows), '표지');

  const summaryRows = [
    { 항목: '전체 항목', 값: tot },
    { 항목: mode === 'tst' ? 'PASS' : '완료', 값: done },
    { 항목: mode === 'tst' ? 'FAIL' : '미완료', 값: fail },
    { 항목: mode === 'tst' ? '통과율' : '완료율', 값: `${rate}%` },
  ];
  XLSXStyle.utils.book_append_sheet(wb, XLSXStyle.utils.json_to_sheet(summaryRows), '요약');

  const rows = caseRows(mode, section, mgrCases, filterFn);
  const caseSheet = XLSXStyle.utils.json_to_sheet(rows);
  const resultCol = Object.keys(rows[0] || {}).indexOf('결과');
  if (resultCol >= 0) {
    rows.forEach((r, i) => {
      const addr = XLSXStyle.utils.encode_cell({ r: i + 1, c: resultCol });
      const cell = caseSheet[addr];
      if (!cell) return;
      if (isDone(r.결과)) cell.s = { fill: FILL_SUCCESS, font: FONT_SUCCESS };
      else if (isFail(r.결과)) cell.s = { fill: FILL_FAIL, font: FONT_FAIL };
    });
  }
  XLSXStyle.utils.book_append_sheet(wb, caseSheet, '케이스');
  XLSXStyle.writeFile(wb, `${projectName}_${mode}_report.xlsx`);
}

export async function parseExcelReport(file: File, mode: Mode): Promise<{ cover: Record<string, string>; cases: Pick<Execution, 'id' | 'actual' | 'pf' | 'owner' | 'date' | 'notes'>[]; catNames: Record<string, string> }> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const cover: Record<string, string> = {};
  const coverSheet = wb.Sheets['표지'];
  if (coverSheet) {
    const rows: any[] = XLSX.utils.sheet_to_json(coverSheet);
    const labelToKey = new Map(COVER_FIELDS[mode].map(([key, label]) => [label, key]));
    rows.forEach((r) => {
      const key = labelToKey.get(r['항목']);
      if (key) cover[key] = String(r['값'] ?? '');
    });
  }
  const caseSheet = wb.Sheets['케이스'];
  const cases: any[] = [];
  const catNames: Record<string, string> = {};
  if (caseSheet) {
    const rows: any[] = XLSX.utils.sheet_to_json(caseSheet);
    const actualKey = CASE_LABELS(mode).actual;
    rows.forEach((r) => {
      const id = String(r['ID'] ?? '').trim();
      if (!id) return;
      if (r['카테고리']) catNames[id] = String(r['카테고리']);
      cases.push({
        id,
        actual: String(r[actualKey] ?? ''),
        pf: String(r['결과'] ?? ''),
        owner: String(r['수행자'] ?? ''),
        date: String(r['수행일자'] ?? ''),
        notes: String(r['비고'] ?? ''),
      });
    });
  }
  return { cover, cases, catNames };
}

// ---------- Markdown ----------

export function exportMarkdown(mode: Mode, data: QAData, mgrCases: TestCase[], projectName: string) {
  const section = data[mode];
  const lines: string[] = [];
  lines.push(`# ${projectName} ${mode === 'tst' ? '테스트결과서' : '배포결과서'}`, '');
  lines.push('## 표지 정보');
  COVER_FIELDS[mode].forEach(([key, label]) => lines.push(`- ${label}: ${(section.cover as any)[key] || ''}`));
  lines.push('');

  const labels = CASE_LABELS(mode);
  const buckets = section.cats.concat(section.cases.some((c) => !c.catId) ? [{ id: '__u__', name: '미분류', color: '' }] : []);
  buckets.forEach((cat) => {
    const items = cat.id === '__u__' ? section.cases.filter((c) => !c.catId) : section.cases.filter((c) => c.catId === cat.id);
    if (!items.length) return;
    lines.push(`## ${cat.name} (${items.length}건)`, '');
    items.forEach((c) => {
      const mc = mgrCases.find((m) => m.id === c.id);
      lines.push(`### ${c.id} ${mc?.name || ''} — ${c.pf}`);
      if (mc?.input) lines.push(`- 입력값: ${mc.input}`);
      lines.push(`- ${labels.expected}: ${mc?.expected || ''}`);
      lines.push(`- ${labels.actual}: ${c.actual}`);
      lines.push(`- 수행자: ${c.owner}`);
      lines.push(`- 수행일자: ${c.date}`);
      lines.push(`- 비고: ${c.notes}`);
      lines.push('');
    });
  });

  download(`${projectName}_${mode}_report.md`, lines.join('\n'), 'text/markdown');
}

export async function parseMarkdownReport(file: File, mode: Mode): Promise<{ cover: Record<string, string>; cases: Pick<Execution, 'id' | 'actual' | 'pf' | 'owner' | 'date' | 'notes'>[]; catNames: Record<string, string> }> {
  const text = await file.text();
  const lines = text.split('\n');
  const cover: Record<string, string> = {};
  const labelToKey = new Map(COVER_FIELDS[mode].map(([key, label]) => [label, key]));
  const labels = CASE_LABELS(mode);

  const cases: any[] = [];
  const catNames: Record<string, string> = {};
  let currentCat = '';
  let current: any = null;

  const flush = () => { if (current?.id) cases.push(current); current = null; };

  for (const raw of lines) {
    const line = raw.trim();
    const catMatch = line.match(/^##\s+(.+?)\s+\(\d+건\)$/);
    if (catMatch) { flush(); currentCat = catMatch[1]; continue; }
    const caseMatch = line.match(/^###\s+(\S+)\s+(.*?)\s+—\s+(.+)$/);
    if (caseMatch) {
      flush();
      const [, id, , pf] = caseMatch;
      current = { id, actual: '', pf, owner: '', date: '', notes: '' };
      catNames[id] = currentCat;
      continue;
    }
    const bulletMatch = line.match(/^-\s+([^:]+):\s*(.*)$/);
    if (bulletMatch && current) {
      const [, label, value] = bulletMatch;
      if (label === labels.actual) current.actual = value;
      else if (label === '수행자') current.owner = value;
      else if (label === '수행일자') current.date = value;
      else if (label === '비고') current.notes = value;
      continue;
    }
    if (bulletMatch && !current) {
      const [, label, value] = bulletMatch;
      const key = labelToKey.get(label.trim());
      if (key) cover[key] = value;
    }
  }
  flush();

  return { cover, cases, catNames };
}
