import React from 'react'
import { logger } from '../lib/logger'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo })
    logger.error('Crash intercettato da ErrorBoundary React:', error, errorInfo)
  }

  handleReload = () => {
    window.location.reload()
  }

  handleGoHome = () => {
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-slate-800/80 border border-slate-700/60 backdrop-blur-xl rounded-2xl p-8 shadow-2xl text-center">
            <div className="w-16 h-16 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>

            <h2 className="text-2xl font-bold text-slate-100 mb-2">
              Si è verificato un problema
            </h2>

            <p className="text-slate-400 text-sm mb-6 leading-relaxed">
              Un errore imprevisto ha bloccato questa vista. Nessun dato è andato perso. Ricarica la pagina o torna alla schermata principale.
            </p>

            {import.meta.env.DEV && this.state.error && (
              <div className="mb-6 p-3 bg-slate-950/80 border border-slate-800 rounded-lg text-left text-xs font-mono text-red-300 overflow-auto max-h-32">
                {this.state.error.toString()}
              </div>
            )}

            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleReload}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-all shadow-lg shadow-blue-600/20"
              >
                <RefreshCw className="w-4 h-4" />
                Ricarica Pagina
              </button>

              <button
                onClick={this.handleGoHome}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium rounded-xl transition-all"
              >
                <Home className="w-4 h-4" />
                Torna alla Home
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
