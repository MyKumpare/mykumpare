import React from "react";

/**
 * A simple error boundary that catches render errors in its children and
 * shows a fallback message instead of letting the error propagate up and
 * blank the whole app. Used around the enrichment panel and other crash-prone
 * surfaces so a single bad payload can't take down the entire dialog.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const { fallback } = this.props;
      if (typeof fallback === "function") {
        return fallback(this.state.error, () => this.setState({ hasError: false, error: null }));
      }
      return (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-2">
          <p className="text-sm font-medium text-red-600">
            {this.props.title || "Something went wrong"}
          </p>
          <p className="text-xs text-gray-600">
            {this.state.error?.message || "An unexpected error occurred."}
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            className="text-xs text-red-600 hover:text-red-700 underline"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}