import { useEffect, useState } from 'react';
import { ClipboardList, FileText, Rocket } from 'lucide-react';
import type { Project } from '../types/qa';
import type { TabKey } from './Sidebar';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from './ui/command';

interface Props {
  projects: Project[];
  onSelectProject: (id: number) => void;
  onSelectTab: (tab: TabKey) => void;
}

const TAB_ITEMS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'mgr', label: '케이스 관리', icon: <ClipboardList className="size-4" /> },
  { key: 'auto', label: '자동 실행', icon: <Rocket className="size-4" /> },
  { key: 'tst', label: '테스트결과서', icon: <FileText className="size-4" /> },
  { key: 'dep', label: '배포결과서', icon: <FileText className="size-4" /> },
];

export default function CommandPalette({ projects, onSelectProject, onSelectTab }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="프로젝트나 메뉴를 검색하세요..." />
      <CommandList>
        <CommandEmpty>검색 결과가 없습니다</CommandEmpty>
        <CommandGroup heading="프로젝트">
          {projects.map((p) => (
            <CommandItem
              key={p.id}
              value={p.name}
              onSelect={() => { onSelectProject(p.id); setOpen(false); }}
            >
              {p.name}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="메뉴">
          {TAB_ITEMS.map((t) => (
            <CommandItem
              key={t.key}
              value={t.label}
              onSelect={() => { onSelectTab(t.key); setOpen(false); }}
            >
              {t.icon}
              {t.label}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
