// v32 P4-4 — 공용 오류 울타리. 전에는 저장소 전체에 ErrorBoundary 가
// 0개라 렌더 한 곳이 던지면 React 루트가 통째로 내려 흰 화면이 됐다
// (F5 만이 복구). 울타리는 그 패널만 접고, 서버 장부(client-error)에
// 자가 보고하며, 사람에게 다시 시도 단추를 준다.
import { Component, type ReactNode } from 'react';
import { reportClientError } from '../web/liveSync';

export class ErrorBoundary extends Component<
  { name: string; children: ReactNode },
  { err: string | null }
> {
  state = { err: null as string | null };

  static getDerivedStateFromError(e: unknown) {
    return { err: String((e as Error)?.message ?? e).slice(0, 200) };
  }

  componentDidCatch(e: unknown) {
    reportClientError(`render:${this.props.name}: ${String((e as Error)?.message ?? e)}`,
                      this.props.name, String((e as Error)?.stack ?? ''));
  }

  render() {
    if (this.state.err) {
      return (
        <div style={{ padding: 16, color: 'var(--text-muted, #8a8f99)' }}>
          이 판({this.props.name})이 그리다 넘어졌습니다 — {this.state.err}
          <button style={{ marginLeft: 8 }}
                  onClick={() => this.setState({ err: null })}>다시 시도</button>
        </div>
      );
    }
    return this.props.children;
  }
}
