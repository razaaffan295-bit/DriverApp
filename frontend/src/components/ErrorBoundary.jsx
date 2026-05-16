import React from 'react'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          background: '#F9FAFB',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '64px', marginBottom: '16px' }}>
            😔
          </div>
          <h1 style={{
            fontSize: '24px',
            fontWeight: '700',
            color: '#111827',
            marginBottom: '8px',
          }}>
            Kuch galat ho gaya
          </h1>
          <p style={{
            color: '#6B7280',
            fontSize: '14px',
            marginBottom: '24px',
            maxWidth: '320px',
          }}>
            Sorry, app mein koi problem aa gayi. 
            Refresh karke try karein.
          </p>
          <button
            type="button"
            onClick={this.handleReset}
            style={{
              background: '#1D4ED8',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              padding: '12px 32px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            Home Page pe Jao
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              background: 'none',
              color: '#6B7280',
              border: 'none',
              marginTop: '12px',
              fontSize: '13px',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            Page Refresh karein
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
