import { Component, type ErrorInfo, type ReactNode } from 'react';

import MainApp from './app/MainApp';
import { ThemeProvider } from './app/theme/ThemeProvider';
import { I18nProvider, t } from './i18n';
import './App.css';
import './pathway.css';

type AppErrorBoundaryState = {
  hasError: boolean;
  message: string;
};

class AppErrorBoundary extends Component<{ children: ReactNode }, AppErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = {
      hasError: false,
      message: ''
    };
  }

  static getDerivedStateFromError(error: unknown): AppErrorBoundaryState {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : ''
    };
  }

  componentDidCatch(error: unknown, errorInfo: ErrorInfo) {
    console.error('[pathway-app-error-boundary]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="pathway-error-screen">
          <h2>{t('app.error.title')}</h2>
          <p>{t('app.error.copy')}</p>
          <pre>{this.state.message || t('app.error.noMessage')}</pre>
          <button onClick={() => window.location.reload()} type="button">
            {t('app.error.reload')}
          </button>
        </main>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  return (
    <I18nProvider>
      <ThemeProvider>
        <AppErrorBoundary>
          <MainApp />
        </AppErrorBoundary>
      </ThemeProvider>
    </I18nProvider>
  );
}
