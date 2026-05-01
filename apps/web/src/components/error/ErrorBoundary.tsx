/* eslint-disable no-console */
import type { ErrorInfo, ReactNode } from 'react';
import { Component } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex items-center justify-center min-h-[200px] p-8">
          <div className="text-center max-w-sm">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-danger-bg mb-3">
              <span className="text-danger text-lg font-bold">!</span>
            </div>
            <p className="text-sm font-medium text-content-primary mb-1">
              Something went wrong
            </p>
            <p className="text-xs text-content-muted">
              {/* In production, hide the raw exception message — it can contain
                  internal field names or state that should not be user-visible.
                  Sentry captures the full error at componentDidCatch. */}
              {import.meta.env.PROD
                ? 'An unexpected error occurred.'
                : (this.state.error?.message ?? 'An unexpected error occurred.')}
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}