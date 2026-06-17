import { Moon, Sun } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { useTheme } from '../hooks/useTheme';

interface Props {
  projectName: string | null;
}

export default function Header({ projectName }: Props) {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="flex h-14 items-center gap-3 border-b border-border bg-card px-5">
      <span className="text-sm font-semibold text-foreground">
        {projectName ?? '프로젝트 미선택'}
      </span>
      {projectName && (
        <Badge variant="outline" className="text-success border-success/30 bg-success/10">
          연결됨
        </Badge>
      )}
      <div className="ml-auto">
        <Button variant="ghost" size="icon" onClick={toggleTheme} title="다크모드 전환">
          {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </Button>
      </div>
    </header>
  );
}
