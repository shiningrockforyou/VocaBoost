import React from 'react'
import ErrorFallback from './ErrorFallback'
import { logError } from '../utils/logError'

/**
 * APErrorBoundary - React Error Boundary for crash recovery
 * Catches render errors and displays a fallback UI
 */
class APErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
    }
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render shows the fallback UI
    return {
      hasError: true,
      error,
    }
  }

  componentDidCatch(error, errorInfo) {
    // Log the error with context
    logError('APErrorBoundary', {
      componentStack: errorInfo?.componentStack,
      location: window.location.pathname,
    }, error)
  }

  handleRetry = () => {
    // Reset the error state to retry rendering
    this.setState({
      hasError: false,
      error: null,
    })
  }

  render() {
    if (this.state.hasError) {
      // Render fallback UI
      return (
        <ErrorFallback
          error={this.state.error}
          onRetry={this.handleRetry}
        />
      )
    }

    // Render children normally
    return this.props.children
  }
}

export default APErrorBoundary
