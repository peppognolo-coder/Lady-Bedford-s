import { Component, type ReactNode } from 'react'

/** Evita la schermata bianca: se qualcosa si rompe, mostra un messaggio e un pulsante per riprovare. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }
  static getDerivedStateFromError(error: Error) { return { error } }
  componentDidCatch(error: Error) { console.error(error) }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div role="alert" style={{ maxWidth: 460, margin: '12vh auto', padding: 24, fontFamily: 'Georgia, serif', textAlign: 'center' }}>
        <h1 style={{ fontSize: 22, margin: '0 0 8px' }}>Qualcosa non ha funzionato</h1>
        <p style={{ margin: '0 0 16px', color: '#555' }}>La pagina ha avuto un problema. Riprova: gli ordini non sono andati persi.</p>
        <p style={{ margin: '0 0 16px', fontSize: 12, color: '#888', wordBreak: 'break-word' }}>{this.state.error.message}</p>
        <button onClick={() => location.reload()} style={{ minHeight: 44, padding: '0 20px', fontSize: 16, cursor: 'pointer' }}>Ricarica</button>
      </div>
    )
  }
}
