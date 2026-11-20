import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'Terjadi kesalahan tampilan yang tidak terduga.',
    };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('ErrorBoundary caught error:', error, info);
  }

  private handleReload = () => {
    window.location.reload();
  };

  override render() {
    if (this.state.hasError) {
      let friendlyMsg = this.state.message;
      try {
        const parsed = JSON.parse(this.state.message) as { error?: string; operationType?: string };
        if (parsed && parsed.error) {
          friendlyMsg = `Gangguan sinkronisasi (${parsed.operationType || 'akses data'}): ${parsed.error}`;
        }
      } catch {
        // plain error message
      }

      return (
        <div
          className="min-h-screen flex items-center justify-center p-4"
          style={{
            backgroundColor: 'var(--app-canvas, #F6F9F6)',
            color: 'var(--app-text, #112015)',
          }}
        >
          <div
            className="max-w-md w-full rounded-xl border p-6 space-y-4 shadow-lg"
            style={{
              backgroundColor: 'var(--app-surface, #FFFFFF)',
              borderColor: 'var(--app-border, #D7E2D8)',
            }}
          >
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-500/15 text-rose-600 shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </span>
              <div className="space-y-1">
                <h1 className="text-base font-bold">Terjadi Gangguan Aplikasi</h1>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--app-text-muted, #4E6152)' }}>
                  {friendlyMsg}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={this.handleReload}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold cursor-pointer"
              style={{
                backgroundColor: 'var(--app-accent, #15803D)',
                color: '#FFFFFF',
              }}
            >
              <RotateCcw className="h-4 w-4" />
              Muat Ulang Aplikasi
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
