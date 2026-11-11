import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State {
  failed: boolean;
}

/**
 * Last line of defence: if a component throws while rendering, show a message and a way
 * out instead of the blank white page React would otherwise leave behind.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('The page failed to render.', error, info.componentStack);
  }

  render() {
    if (!this.state.failed) {
      return this.props.children;
    }

    return (
      <main className="container page-missing">
        <div className="alert alert--error" role="alert">
          <div className="alert__body">
            <p className="alert__title">Something went wrong on this page.</p>
            <p className="alert__sub" lang="bn">
              এই পাতায় একটি সমস্যা হয়েছে। পাতাটি আবার লোড করুন।
            </p>
            <p className="alert__detail">Your applications are safe on the server. Reload to continue.</p>
          </div>
          <button type="button" className="btn btn--primary" onClick={() => window.location.assign('/')}>
            Reload
          </button>
        </div>
      </main>
    );
  }
}
