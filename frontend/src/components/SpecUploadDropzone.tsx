import { useRef, useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { cn } from '../lib/utils';

interface Props {
  onFile: (file: File) => void;
  loading: boolean;
}

export default function SpecUploadDropzone({ onFile, loading }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-12 text-center transition-colors',
        dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30'
      )}
    >
      <UploadCloud className="size-9 text-muted-foreground" />
      <div>
        <p className="text-sm font-medium text-foreground">
          {loading ? '분석 중...' : '연동규격서(OpenAPI) 파일을 드래그하거나 클릭해서 업로드'}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">JSON / YAML 형식 지원</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".json,.yaml,.yml"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}
