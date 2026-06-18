import { useState } from 'react';
import { toast } from 'sonner';
import { previewHeaders, parseExcel } from '../api/excel';
import { createProject } from '../api/projects';
import { useQAStore } from '../store/useQAStore';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

interface Props {
  onClose: () => void;
  onImported?: () => void;
}

const NONE = '__none';

const FIELD_GUESSES: Record<string, string[]> = {
  idCol: ['케이스id', '케이스 id', 'id', 'caseid', 'case id', '번호'],
  nameCol: ['테스트 항목명', '항목명', '테스트명', '이름', 'name', '테스트 항목'],
  typeCol: ['구분', '타입', '유형', 'type', 'positive/negative'],
  inputCol: ['입력값', '입력', 'input', '파라미터', '요청값'],
  expectedCol: ['기대 결과', '기대결과', '예상결과', 'expected', '결과'],
  categoryCol: ['카테고리', '분류', 'category'],
};

function guessColumn(headers: string[], field: string): string {
  const norm = (s: string) => s.toLowerCase().replace(/\s/g, '');
  const candidates = FIELD_GUESSES[field] || [];
  for (const cand of candidates) {
    const hit = headers.find((h) => norm(h) === norm(cand));
    if (hit) return hit;
  }
  for (const cand of candidates) {
    const hit = headers.find((h) => norm(h).includes(norm(cand)));
    if (hit) return hit;
  }
  return '';
}

export default function ExcelImportModal({ onClose, onImported }: Props) {
  const importCases = useQAStore((s) => s.importCases);
  const setProjectId = useQAStore((s) => s.setProjectId);

  const [file, setFile] = useState<File | null>(null);
  const [sheets, setSheets] = useState<string[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [sheetName, setSheetName] = useState('');
  const [nameCol, setNameCol] = useState('');
  const [idCol, setIdCol] = useState('');
  const [typeCol, setTypeCol] = useState('');
  const [inputCol, setInputCol] = useState('');
  const [expectedCol, setExpectedCol] = useState('');
  const [categoryCol, setCategoryCol] = useState('');
  const [headerRow, setHeaderRow] = useState(1);
  const [error, setError] = useState('');
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [loadingParse, setLoadingParse] = useState(false);

  const handleFile = async (f: File) => {
    setFile(f);
    setError('');
    setPreviewCount(null);
    try {
      const res = await previewHeaders(f);
      setSheets(res.sheets);
      setHeaders(res.headers);
      setSheetName(res.sheets[0] || '');
      setNameCol(guessColumn(res.headers, 'nameCol'));
      setIdCol(guessColumn(res.headers, 'idCol'));
      setTypeCol(guessColumn(res.headers, 'typeCol'));
      setInputCol(guessColumn(res.headers, 'inputCol'));
      setExpectedCol(guessColumn(res.headers, 'expectedCol'));
      setCategoryCol(guessColumn(res.headers, 'categoryCol'));
    } catch (e: any) {
      const msg = e?.response?.data?.detail || '파일을 읽을 수 없습니다';
      setError(msg);
      toast.error(msg);
    }
  };

  const handleParse = async () => {
    if (!file || !nameCol) { setError('테스트 항목명 컬럼을 선택해주세요'); return; }
    setLoadingParse(true);
    setError('');
    try {
      const projectName = file.name.replace(/\.[^.]+$/, '');
      const proj = await createProject(projectName);
      const config = {
        name_col: nameCol, id_col: idCol, type_col: typeCol, input_col: inputCol,
        expected_col: expectedCol, category_col: categoryCol, sheet_name: sheetName, header_row: headerRow,
      };

      // Switching projectId triggers App's loadProject(proj.id) for the new (empty) project.
      // Wait for that load to actually run to completion before importing, otherwise the
      // load could overwrite the cases we're about to add.
      let sawLoadingStart = false;
      const unsubscribe = useQAStore.subscribe((state) => {
        if (state.projectId !== proj.id) return;
        if (state.loading) { sawLoadingStart = true; return; }
        if (!sawLoadingStart) return;
        unsubscribe();
        (async () => {
          try {
            const res = await parseExcel(file, config);
            await importCases(res.cases, res.categories);
            setPreviewCount(res.total);
            toast.success(`${res.total}건의 케이스가 추가되었습니다`);
            onImported?.();
            onClose();
          } catch (e: any) {
            const msg = e?.response?.data?.detail || '엑셀 파싱에 실패했습니다';
            setError(msg);
            toast.error(msg);
          } finally {
            setLoadingParse(false);
          }
        })();
      });
      setProjectId(proj.id);
    } catch (e: any) {
      const msg = e?.response?.data?.detail || '프로젝트 생성에 실패했습니다';
      setError(msg);
      toast.error(msg);
      setLoadingParse(false);
    }
  };

  const colSelect = (label: string, value: string, onChange: (v: string) => void, required?: boolean) => (
    <div>
      <label className="mb-1 block text-[11px] text-muted-foreground">{label}{required && ' *'}</label>
      <Select value={value || NONE} onValueChange={(v) => onChange(!v || v === NONE ? '' : v)}>
        <SelectTrigger className="h-8 w-full text-xs"><SelectValue placeholder="선택 안 함" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>선택 안 함</SelectItem>
          {headers.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>📥 연동규격서 엑셀 임포트</DialogTitle>
        </DialogHeader>

        <div>
          <label className="mb-1 block text-[11px] text-muted-foreground">엑셀 파일</label>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            className="block w-full text-xs text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-xs file:font-medium"
          />
          {file && <p className="mt-1 text-[11px] text-muted-foreground">"{file.name.replace(/\.[^.]+$/, '')}" 이름으로 새 프로젝트가 생성됩니다</p>}
        </div>

        {sheets.length > 0 && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-[11px] text-muted-foreground">시트 선택</label>
                <Select value={sheetName} onValueChange={(v) => setSheetName(v || '')}>
                  <SelectTrigger className="h-8 w-full text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {sheets.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-muted-foreground">헤더 행 번호</label>
                <Input type="number" min={1} value={headerRow} onChange={(e) => setHeaderRow(Number(e.target.value))} className="h-8 text-xs" />
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground">감지된 헤더(자동 매칭됨): {headers.join(', ') || '(없음)'}</p>

            <div className="grid grid-cols-2 gap-2">
              {colSelect('테스트 항목명 컬럼', nameCol, setNameCol, true)}
              {colSelect('케이스 ID 컬럼', idCol, setIdCol)}
              {colSelect('구분(Positive/Negative) 컬럼', typeCol, setTypeCol)}
              {colSelect('카테고리 컬럼', categoryCol, setCategoryCol)}
              {colSelect('입력값 컬럼', inputCol, setInputCol)}
              {colSelect('기대 결과 컬럼', expectedCol, setExpectedCol)}
            </div>
          </>
        )}

        {error && <p className="text-xs text-destructive">{error}</p>}
        {previewCount !== null && <p className="text-xs text-success">✓ {previewCount}건의 케이스가 추가되었습니다</p>}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>닫기</Button>
          <Button onClick={handleParse} disabled={!file || loadingParse}>
            {loadingParse ? '처리 중...' : '케이스 생성'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
