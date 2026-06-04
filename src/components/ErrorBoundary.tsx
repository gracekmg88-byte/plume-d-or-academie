import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: (reset: () => void, error: Error | null) => ReactNode;
  /** Reset boundary when this value changes (e.g. location.key) */
  resetKey?: string;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface State {
  error: Error | null;
  errorCount: number;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, errorCount: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary] Caught:", error, info);
    this.props.onError?.(error, info);
    this.setState((s) => ({ errorCount: s.errorCount + 1 }));
  }

  componentDidUpdate(prevProps: Props) {
    if (
      this.state.error &&
      prevProps.resetKey !== this.props.resetKey
    ) {
      this.reset();
    }
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.reset, this.state.error);
      }
      return <DefaultFallback reset={this.reset} error={this.state.error} />;
    }
    return this.props.children;
  }
}

function DefaultFallback({ reset, error }: { reset: () => void; error: Error | null }) {
  return (
    <div
      role="alert"
      className="min-h-[60vh] w-full flex items-center justify-center px-6 py-12"
    >
      <div className="max-w-md w-full text-center space-y-4">
        <h2 className="text-2xl font-semibold text-foreground">
          Une erreur est survenue
        </h2>
        <p className="text-sm text-muted-foreground">
          L'application a rencontré un problème. Vous pouvez réessayer sans recharger la page.
        </p>
        {error?.message && (
          <p className="text-xs text-muted-foreground/70 break-words font-mono">
            {error.message}
          </p>
        )}
        <div className="flex gap-3 justify-center pt-2">
          <button
            onClick={reset}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition"
          >
            Réessayer
          </button>
          <button
            onClick={() => {
              window.location.href = "/";
            }}
            className="px-4 py-2 rounded-md border border-border text-foreground hover:bg-muted transition"
          >
            Accueil
          </button>
        </div>
      </div>
    </div>
  );
}

export default ErrorBoundary;
