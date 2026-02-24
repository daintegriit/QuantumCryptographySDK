import React from "react";
import { useTheme } from "../../context/ThemeContext";

/**
 * AppErrorBoundary
 *
 * Global UI fault containment layer.
 *
 * Guarantees:
 * - No full-app crashes
 * - Deterministic fallback UI
 * - Audit-safe (no stack leakage)
 * - Production hardened
 *
 * This is the ONLY error boundary in the app.
 */
export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Log only — never expose stack to users
    console.error("[UI ERROR BOUNDARY]", error, info);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} />;
    }

    return this.props.children;
  }
}

// =====================================================
// Fallback UI (deterministic, executive-safe)
// =====================================================

function ErrorFallback({ error }) {
  const { theme } = useTheme();

  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className={`${theme.panel} p-8 rounded-xl max-w-lg`}>
        <h2 className="text-lg font-bold text-red-400 mb-3">
          Application Error
        </h2>

        <p className={theme.mutedText}>
          A critical interface error occurred. The system remains secure and
          operational, but this view could not be rendered.
        </p>

        <div className="mt-4 text-xs font-mono text-gray-500">
          Error Code: UI_RENDER_FAILURE
        </div>

        {/* DEV-only diagnostics */}
        {import.meta.env.DEV && error && (
          <pre className="mt-4 text-xs text-red-300 overflow-auto">
            {error.message}
          </pre>
        )}
      </div>
    </div>
  );
}