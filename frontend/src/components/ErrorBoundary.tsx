import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (error) {
      return (
        <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background text-foreground">
          <div className="text-4xl">⚠️</div>
          <h1 className="text-lg font-semibold">예기치 않은 오류가 발생했습니다</h1>
          <pre className="max-w-lg overflow-auto rounded-md border border-border bg-muted p-4 text-xs text-muted-foreground">
            {error.message}
          </pre>
          <button
            onClick={() => this.setState({ error: null })}
            className="rounded-md border border-border px-4 py-2 text-sm transition-colors hover:bg-muted"
          >
            다시 시도
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
