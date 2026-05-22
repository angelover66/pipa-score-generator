'use client';
import React from 'react';

interface Props { children: React.ReactNode; }
interface State { hasError: boolean; error: string | null; }

export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error: error.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="max-w-md mx-auto py-20 text-center">
          <div className="text-6xl mb-6">💔</div>
          <h2 className="text-xl text-ink font-bold mb-4">出现错误</h2>
          <p className="text-ink-light mb-6">{this.state.error}</p>
          <button onClick={() => window.location.reload()}
            className="px-6 py-2 bg-vermilion text-white rounded-lg hover:bg-vermilion-dark transition-colors">
            刷新页面
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
