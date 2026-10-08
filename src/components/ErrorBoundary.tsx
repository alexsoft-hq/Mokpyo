import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/**
 * 렌더링 중 예외가 나도 흰 화면 대신 복구 안내를 보여준다.
 * 라우트 단위로 감싸 한 화면의 오류가 앱 전체를 죽이지 않게 한다.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-xl border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-semibold">화면을 표시하는 중 문제가 생겼습니다</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            데이터는 안전합니다. 새로고침하면 대부분 해결됩니다. 반복되면 문의해 주세요.
          </p>
          <details className="mt-4 text-left text-xs text-muted-foreground">
            <summary className="cursor-pointer">기술 정보</summary>
            <pre className="mt-2 max-h-40 overflow-auto rounded bg-muted p-2 whitespace-pre-wrap">{this.state.error.message}</pre>
          </details>
          <div className="mt-6 flex justify-center gap-2">
            <Button variant="outline" onClick={() => this.setState({ error: null })}>
              다시 시도
            </Button>
            <Button onClick={() => window.location.reload()}>
              <RotateCcw className="mr-2 h-4 w-4" />
              새로고침
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
