'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let errorMessage = 'Ocorreu um erro inesperado.';
      try {
        errorMessage = this.state.error?.message || errorMessage;
      } catch (e) {
        errorMessage = 'Erro ao processar a mensagem de erro.';
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-surface p-6">
          <div className="bg-surface-container-lowest p-8 rounded-xl shadow-lg max-w-md w-full text-center">
            <div className="w-16 h-16 bg-error/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="text-error" size={40} />
            </div>
            <h2 className="text-2xl font-bold mb-4">Erro na Aplicação</h2>
            <p className="text-on-surface-variant mb-6">{errorMessage}</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-primary text-on-primary px-6 py-2 rounded-lg font-bold hover:bg-primary-container transition-colors"
            >
              Recarregar Aplicação
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
