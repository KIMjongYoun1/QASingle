import { useMemo } from 'react';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  createColumnHelper,
} from '@tanstack/react-table';
import type { Category, TestCase, TstExecution } from '../types/qa';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { cn } from '../lib/utils';

export type RowStatus = 'idle' | 'running' | 'done';

interface Row {
  c: TestCase;
  t?: TstExecution;
  status: RowStatus;
}

interface Props {
  cases: TestCase[];
  results: TstExecution[];
  cats: Category[];
  runningId: string | null;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  onUpdate: (id: string, patch: Partial<TestCase>) => void;
  onShowDiff: (id: string) => void;
}

const col = createColumnHelper<Row>();

export default function CaseTable({ cases, results, cats, runningId, selected, onToggle, onToggleAll, onUpdate, onShowDiff }: Props) {
  const rows = useMemo<Row[]>(
    () =>
      cases.map((c) => {
        const t = results.find((r) => r.id === c.id);
        const status: RowStatus = runningId === c.id ? 'running' : t?.actual ? 'done' : 'idle';
        return { c, t, status };
      }),
    [cases, results, runningId]
  );

  const columns = useMemo(
    () => [
      col.display({
        id: 'select',
        header: () => (
          <input type="checkbox" checked={selected.size === cases.length && cases.length > 0} onChange={onToggleAll} />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={selected.has(row.original.c.id)}
            onChange={() => onToggle(row.original.c.id)}
          />
        ),
      }),
      col.accessor((r) => r.c.id, {
        id: 'id',
        header: 'ID',
        cell: (info) => <span className="font-mono text-xs text-primary">{info.getValue()}</span>,
      }),
      col.accessor((r) => r.c.name, {
        id: 'name',
        header: '이름',
        cell: (info) => <span className="text-xs">{info.getValue()}</span>,
      }),
      col.display({
        id: 'category',
        header: '카테고리',
        cell: ({ row }) => {
          const cat = cats.find((x) => x.id === row.original.c.catId);
          if (!cat) return <span className="text-xs text-muted-foreground">-</span>;
          return (
            <Badge variant="outline" className="gap-1 text-xs">
              <span className="size-1.5 rounded-full" style={{ background: cat.color }} />
              {cat.name}
            </Badge>
          );
        },
      }),
      col.display({
        id: 'method',
        header: 'Method',
        cell: ({ row }) => (
          <Input
            value={row.original.c.method || ''}
            onChange={(e) => onUpdate(row.original.c.id, { method: e.target.value })}
            className="h-7 w-20 text-xs"
          />
        ),
      }),
      col.display({
        id: 'endpoint',
        header: 'Endpoint',
        cell: ({ row }) => (
          <Input
            value={row.original.c.endpoint || ''}
            onChange={(e) => onUpdate(row.original.c.id, { endpoint: e.target.value })}
            className="h-7 min-w-44 text-xs"
          />
        ),
      }),
      col.display({
        id: 'expectedStatus',
        header: '기대상태',
        cell: ({ row }) => (
          <Input
            value={row.original.c.expectedStatus ?? ''}
            onChange={(e) => onUpdate(row.original.c.id, { expectedStatus: Number(e.target.value) || undefined })}
            className="h-7 w-16 text-xs"
          />
        ),
      }),
      col.display({
        id: 'status',
        header: '결과',
        cell: ({ row }) => {
          const { status, t } = row.original;
          if (status === 'running') return <Badge className="border-warning/30 bg-warning/15 text-warning">실행 중</Badge>;
          if (status === 'idle') return <span className="text-xs text-muted-foreground">미실행</span>;
          const pass = t?.pf === 'Pass';
          return (
            <Badge
              className={cn(
                'cursor-pointer',
                pass ? 'border-success/30 bg-success/15 text-success' : 'border-destructive/30 bg-destructive/15 text-destructive'
              )}
              onClick={() => onShowDiff(row.original.c.id)}
            >
              {t?.pf} · 상세보기
            </Badge>
          );
        },
      }),
    ],
    [cases.length, cats, selected, onToggle, onToggleAll, onUpdate, onShowDiff]
  );

  const table = useReactTable({ data: rows, columns, getCoreRowModel: getCoreRowModel() });

  if (cases.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        규격서를 업로드하면 자동 생성된 케이스가 여기에 표시됩니다
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((hg) => (
          <TableRow key={hg.id}>
            {hg.headers.map((h) => (
              <TableHead key={h.id}>{flexRender(h.column.columnDef.header, h.getContext())}</TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.map((r) => (
          <TableRow key={r.id}>
            {r.getVisibleCells().map((cell) => (
              <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
