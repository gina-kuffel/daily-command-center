import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    this.setState({ info });
    console.error('=== APP CRASH ===');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    console.error('Component stack:', info?.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 32, fontFamily: 'monospace', background: '#0f172a', minHeight: '100vh', color: '#f8fafc' }}>
          <h2 style={{ color: '#f87171', marginBottom: 16 }}>App crashed — debug info</h2>
          <pre style={{ background: '#1e293b', padding: 16, borderRadius: 8, overflow: 'auto', fontSize: 12, color: '#fbbf24', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {this.state.error?.message}\n\n{this.state.error?.stack}
          </pre>
          {this.state.info?.componentStack && (
            <>
              <h3 style={{ color: '#94a3b8', marginTop: 20, marginBottom: 8 }}>Component stack:</h3>
              <pre style={{ background: '#1e293b', padding: 16, borderRadius: 8, overflow: 'auto', fontSize: 12, color: '#7dd3fc', whiteSpace: 'pre-wrap' }}>
                {this.state.info.componentStack}
              </pre>
            </>
          )}
          <button
            onClick={() => this.setState({ hasError: false, error: null, info: null })}
            style={{ marginTop: 20, padding: '8px 16px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
