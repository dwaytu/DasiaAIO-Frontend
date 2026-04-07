import { Component, ErrorInfo, ReactNode } from 'react'
import { logError } from '../utils/logger'

interface ErrorBoundaryProps {
  children: ReactNode
  sectionLabel: string
  onRetry?: () => void
}

interface ErrorBoundaryState {
  hasError: boolean
  errorMessage: string
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      errorMessage: '',
    }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'Unexpected rendering error',
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    logError(`[ErrorBoundary] ${this.props.sectionLabel}`, error)
    if (errorInfo.componentStack) {
      console.error(errorInfo.componentStack)
    }
  }

  private handleRetry = (): void => {
    this.setState({
      hasError: false,
      errorMessage: '',
    })

    if (this.props.onRetry) {
      this.props.onRetry()
    }
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <main id="maincontent" className="flex h-full items-center justify-center p-4" tabIndex={-1}>
        <section className="w-full max-w-lg rounded border border-danger-border bg-surface p-6 shadow-xl" role="alert" aria-live="assertive">
          <h2 className="text-2xl font-bold text-text-primary">Section error detected</h2>
          <p className="mt-3 text-sm text-text-secondary">
            SENTINEL could not render the {this.props.sectionLabel.toLowerCase()}. Reload this section to recover.
          </p>
          {this.state.errorMessage ? (
            <p className="mt-3 rounded-md border border-danger-border bg-danger-bg p-2 text-xs text-danger-text">
              {this.state.errorMessage}
            </p>
          ) : null}
          <button
            type="button"
            onClick={this.handleRetry}
            className="mt-5 min-h-11 rounded-md bg-info px-4 py-2 text-sm font-semibold text-white"
          >
            Reload section
          </button>
        </section>
      </main>
    )
  }
}

export default ErrorBoundary
