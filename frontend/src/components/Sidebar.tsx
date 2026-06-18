import { useEffect, useRef, useState } from 'react';
import { ChevronRight, ClipboardList, FileText, Folder, History, Plus, Rocket, BarChart2, GitCommitHorizontal, LayoutDashboard, Layers, Bell } from 'lucide-react';
import { toast } from 'sonner';
import type { Project, QAData, PF, DepPF } from '../types/qa';
import { listProjects, createProject } from '../api/projects';
import { loadQAData } from '../api/qa';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { cn } from '../lib/utils';

export type TabKey = 'mgr' | 'tst' | 'dep' | 'auto' | 'history' | 'analytics' | 'case-history' | 'suites' | 'notifications';

interface Props {
  tab: TabKey;
  onTabChange: (t: TabKey) => void;
  projectId: number | null;
  onProjectChange: (id: number | null) => void;
  onOpenExcelImport: () => void;
  onOpenAnalysis: () => void;
  onSelectCase: (tree: 'tst' | 'dep', caseId: string) => void;
  onOpenDashboard: () => void;
  data: QAData;
}

const GROUPS: { key: string; label: string; tabs: { key: TabKey; label: string; icon: React.ReactNode; tree?: 'tst' | 'dep' }[] }[] = [
  {
    key: 'suite',
    label: 'Test Suite',
    tabs: [
      { key: 'suites', label: 'Test Suite', icon: <Layers className="size-3.5" /> },
      { key: 'mgr', label: '케이스 관리', icon: <ClipboardList className="size-3.5" /> },
      { key: 'auto', label: '자동 실행', icon: <Rocket className="size-3.5" /> },
    ],
  },
  {
    key: 'results',
    label: 'Result / Logs',
    tabs: [
      { key: 'history', label: '실행 히스토리', icon: <History className="size-3.5" /> },
      { key: 'analytics', label: '실행 분석', icon: <BarChart2 className="size-3.5" /> },
      { key: 'case-history', label: '변경 이력', icon: <GitCommitHorizontal className="size-3.5" /> },
      { key: 'tst', label: '테스트결과서', icon: <FileText className="size-3.5" />, tree: 'tst' },
      { key: 'dep', label: '배포결과서', icon: <FileText className="size-3.5" />, tree: 'dep' },
    ],
  },
  {
    key: 'settings',
    label: 'Settings',
    tabs: [
      { key: 'notifications', label: '알림 설정', icon: <Bell className="size-3.5" /> },
    ],
  },
];

function statusDot(pf?: PF | DepPF) {
  if (pf === 'Pass' || pf === '완료') return 'bg-success';
  if (pf === 'Fail') return 'bg-destructive';
  if (pf === '스킵') return 'bg-warning';
  return 'bg-muted-foreground/40';
}

export default function Sidebar({ tab, onTabChange, projectId, onProjectChange, onOpenExcelImport, onOpenAnalysis, onSelectCase, onOpenDashboard, data }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [cache, setCache] = useState<Record<number, QAData>>({});
  const prevProjectId = useRef<number | null>(null);

  const refresh = () => listProjects().then(setProjects);
  useEffect(() => { refresh(); }, []);

  useEffect(() => {
    if (projectId) setOpen((prev) => {
      const next = new Set(prev);
      next.add(`p${projectId}`);
      next.add(`p${projectId}:suite`);
      next.add(`p${projectId}:results`);
      return next;
    });
  }, [projectId]);

  useEffect(() => {
    if (prevProjectId.current && prevProjectId.current !== projectId) {
      const leftId = prevProjectId.current;
      setCache((prev) => ({ ...prev, [leftId]: data }));
    }
    prevProjectId.current = projectId;
  }, [projectId]);

  const ensureLoaded = (id: number) => {
    if (id === projectId || cache[id]) return;
    loadQAData(id).then((d) => { if (d) setCache((prev) => ({ ...prev, [id]: d })); });
  };

  const toggleProjectOpen = (id: number) => {
    const key = `p${id}`;
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
        next.add(`${key}:suite`);
        next.add(`${key}:results`);
        ensureLoaded(id);
      }
      return next;
    });
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      const proj = await createProject(newName.trim());
      setNewName('');
      setCreating(false);
      await refresh();
      onProjectChange(proj.id);
      toast.success('프로젝트를 생성했습니다');
    } catch (e) {
      console.error(e);
      toast.error('프로젝트 생성에 실패했습니다');
    }
  };

  const toggle = (key: string) => {
    setOpen((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  return (
    <aside className="flex h-screen w-64 min-w-64 flex-col gap-3 border-r border-border bg-card p-3">
      <div className="flex items-start justify-between px-1">
        <div>
          <h1 className="text-base font-bold text-foreground">Single_QA_Tools</h1>
          <p className="mt-0.5 text-[11px] text-muted-foreground">⌘K 로 빠른 검색</p>
        </div>
        <button
          onClick={onOpenDashboard}
          title="전체 프로젝트 대시보드"
          className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
        >
          <LayoutDashboard className="size-4" />
        </button>
      </div>

      {creating ? (
        <div className="flex gap-1.5 px-1">
          <Input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setCreating(false); }}
            placeholder="프로젝트명"
            className="h-8 text-sm"
          />
          <Button size="sm" onClick={handleCreate}>추가</Button>
        </div>
      ) : (
        <Button variant="outline" size="sm" className="mx-1 justify-start gap-1.5 text-muted-foreground" onClick={() => setCreating(true)}>
          <Plus className="size-3.5" /> 신규 프로젝트
        </Button>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <ul className="flex flex-col gap-0.5 text-sm">
          {projects.map((p) => {
            const pKey = `p${p.id}`;
            const pOpen = open.has(pKey);
            const active = p.id === projectId;
            const treeData = p.id === projectId ? data : cache[p.id];
            return (
              <li key={p.id}>
                <div
                  className={cn(
                    'flex w-full items-center gap-1.5 rounded-xl px-2 py-1.5 text-left font-medium transition-all',
                    active
                      ? 'bg-[linear-gradient(310deg,var(--primary),var(--primary-2))] text-primary-foreground shadow-[0_2px_8px_-2px_color-mix(in_oklch,var(--primary)_55%,transparent)]'
                      : 'text-foreground hover:bg-secondary/60'
                  )}
                >
                  <button onClick={() => toggleProjectOpen(p.id)} className="shrink-0">
                    <ChevronRight className={cn('size-3.5 shrink-0 transition-transform', active ? 'text-primary-foreground' : 'text-muted-foreground', pOpen && 'rotate-90')} />
                  </button>
                  <button onClick={() => { onProjectChange(p.id); setOpen((prev) => { const next = new Set(prev); next.add(pKey); next.add(`${pKey}:suite`); next.add(`${pKey}:results`); return next; }); }} className="flex flex-1 items-center gap-1.5 overflow-hidden text-left">
                    <Folder className="size-3.5 shrink-0" />
                    <span className="truncate">{p.name}</span>
                  </button>
                </div>

                {pOpen && (
                  <ul className="ml-4 flex flex-col gap-0.5 border-l border-border pl-2">
                    {!treeData && (
                      <li className="px-2 py-1 text-[11px] text-muted-foreground">불러오는 중...</li>
                    )}
                    {treeData && GROUPS.map((g) => {
                      const gKey = `${pKey}:${g.key}`;
                      const gOpen = open.has(gKey);
                      return (
                        <li key={g.key}>
                          <button
                            onClick={() => toggle(gKey)}
                            className="flex w-full items-center gap-1 px-2 py-1 text-left"
                          >
                            <ChevronRight className={cn('size-3 shrink-0 text-muted-foreground/50 transition-transform', gOpen && 'rotate-90')} />
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">{g.label}</span>
                          </button>
                          {gOpen && (
                            <ul className="ml-2 flex flex-col gap-0.5">
                              {g.tabs.map((t) => {
                                const tKey = `${pKey}:${t.key}`;
                                const tOpen = open.has(tKey);
                                const tabActive = active && tab === t.key;
                                const cats = t.tree ? treeData[t.tree].cats : [];
                                const cases = t.tree ? treeData[t.tree].cases : [];
                                return (
                                  <li key={t.key}>
                                    <button
                                      onClick={() => {
                                        if (!active) onProjectChange(p.id);
                                        onTabChange(t.key);
                                        if (t.tree) toggle(tKey);
                                      }}
                                      className={cn(
                                        'flex w-full items-center gap-1.5 rounded-xl px-2 py-1.5 text-left text-xs font-medium transition-all',
                                        tabActive
                                          ? 'bg-[linear-gradient(310deg,var(--primary),var(--primary-2))] text-primary-foreground shadow-[0_2px_8px_-2px_color-mix(in_oklch,var(--primary)_55%,transparent)]'
                                          : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground'
                                      )}
                                    >
                                      {t.tree && (
                                        <ChevronRight className={cn('size-3 shrink-0 transition-transform', tOpen && 'rotate-90')} />
                                      )}
                                      {t.icon}
                                      <span className="truncate">{t.label}</span>
                                    </button>
                                    {t.tree && tOpen && (
                                      <ul className="ml-4 flex flex-col gap-0.5 border-l border-border pl-2">
                                        {cats.length === 0 && (
                                          <li className="px-2 py-1 text-[11px] text-muted-foreground">카테고리 없음</li>
                                        )}
                                        {cats.map((cat) => {
                                          const catKey = `${tKey}:${cat.id}`;
                                          const catOpen = open.has(catKey);
                                          const catCases = cases.filter((c) => c.catId === cat.id);
                                          return (
                                            <li key={cat.id}>
                                              <button
                                                onClick={() => toggle(catKey)}
                                                className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-[11px] font-medium text-foreground hover:bg-secondary/60"
                                              >
                                                <ChevronRight className={cn('size-3 shrink-0 text-muted-foreground transition-transform', catOpen && 'rotate-90')} />
                                                <span className="truncate">{cat.name}</span>
                                                <span className="ml-auto text-muted-foreground">{catCases.length}</span>
                                              </button>
                                              {catOpen && (
                                                <ul className="ml-4 flex flex-col gap-0.5 border-l border-border pl-2">
                                                  {catCases.map((c) => (
                                                    <li key={c.id}>
                                                      <button
                                                        onClick={() => {
                                                          if (!active) onProjectChange(p.id);
                                                          onSelectCase(t.tree!, c.id);
                                                        }}
                                                        className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-[11px] text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                                                      >
                                                        <span className={cn('size-1.5 shrink-0 rounded-full', statusDot(c.pf))} />
                                                        <span className="truncate font-mono">{c.id}</span>
                                                      </button>
                                                    </li>
                                                  ))}
                                                  {catCases.length === 0 && (
                                                    <li className="px-2 py-1 text-[11px] text-muted-foreground">케이스 없음</li>
                                                  )}
                                                </ul>
                                              )}
                                            </li>
                                          );
                                        })}
                                      </ul>
                                    )}
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex flex-col gap-2 border-t border-border pt-2">
        <Button variant="outline" size="sm" className="w-full justify-start" onClick={onOpenExcelImport} title="연동규격서 엑셀에서 케이스 생성">
          📥 엑셀 임포트
        </Button>
        <Button variant="outline" size="sm" className="w-full justify-start" onClick={onOpenAnalysis} title="LLM으로 분석">
          🤖 AI 분석
        </Button>
      </div>
    </aside>
  );
}
