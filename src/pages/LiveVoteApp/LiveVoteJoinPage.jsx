import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { Building2, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import LiveVoteAppCore from './LiveVoteAppCore'

export default function LiveVoteJoinPage() {
  const { assembleaId } = useParams()
  const [cf, setCf] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  
  const [status, setStatus] = useState('start') // 'start' | 'waiting' | 'admitted' | 'rejected'
  const [personaId, setPersonaId] = useState(null)
  const [sessionId, setSessionId] = useState('')

  useEffect(() => {
    // Generiamo un session ID univoco per questo dispositivo alla prima apertura
    setSessionId(crypto.randomUUID())
  }, [])

  useEffect(() => {
    if (status !== 'waiting') return

    // Sottoscriviti ai cambiamenti in sala d'attesa per questo dispositivo
    const channel = supabase.channel(`attesa_${sessionId}`)
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'assemblee_sala_attesa', 
        filter: `session_id=eq.${sessionId}` 
      }, (payload) => {
        if (payload.new.stato === 'ammesso') {
          setStatus('admitted')
        } else if (payload.new.stato === 'rifiutato') {
          setStatus('rejected')
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [status, sessionId])

  const handleJoin = async (e) => {
    e.preventDefault()
    if (!cf) return
    
    setLoading(true)
    setError(null)
    try {
      // 1. Controlla il CF
      const { data: personaIdMatch, error: rpcError } = await supabase.rpc('check_cf_assemblea', {
        p_assemblea_id: assembleaId,
        p_cf: cf.trim().toUpperCase()
      })
      
      if (rpcError) throw rpcError
      if (!personaIdMatch) {
        throw new Error('Codice Fiscale non trovato in questo Condominio.')
      }

      setPersonaId(personaIdMatch)

      // 2. Inserisci nella sala d'attesa
      const { error: insertError } = await supabase.from('assemblee_sala_attesa').insert({
        assemblea_id: assembleaId,
        persona_id: personaIdMatch,
        codice_fiscale_richiedente: cf.trim().toUpperCase(),
        session_id: sessionId,
        stato: 'in_attesa'
      })

      if (insertError) throw insertError

      setStatus('waiting')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (status === 'admitted') {
    return <LiveVoteAppCore assembleaId={assembleaId} personaId={personaId} />
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
      {/* Header Pubblico */}
      <div style={{ background: '#1e293b', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12, color: '#fff' }}>
        <Building2 size={24} />
        <div>
          <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>CondoFAST Live</h1>
          <p style={{ margin: 0, fontSize: 11, color: '#94a3b8' }}>Accesso Assemblea in corso</p>
        </div>
      </div>

      <div style={{ flex: 1, padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: '#fff', padding: 32, borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.05)', width: '100%', maxWidth: 400 }}>
          
          {status === 'start' && (
            <form onSubmit={handleJoin}>
              <h2 style={{ margin: '0 0 8px', fontSize: 20, color: '#0f172a' }}>Accedi alla Sala</h2>
              <p style={{ margin: '0 0 24px', fontSize: 14, color: '#64748b' }}>Inserisci il tuo Codice Fiscale per essere riconosciuto.</p>
              
              {error && (
                <div style={{ background: '#fef2f2', color: '#ef4444', padding: 12, borderRadius: 8, fontSize: 13, marginBottom: 16, display: 'flex', gap: 8 }}>
                  <AlertCircle size={16} style={{ flexShrink: 0 }} /> {error}
                </div>
              )}

              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>Codice Fiscale</label>
                <input 
                  type="text" 
                  required 
                  value={cf}
                  onChange={e => setCf(e.target.value.toUpperCase())}
                  style={{ width: '100%', padding: '12px 16px', borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 16, fontFamily: 'monospace' }}
                  placeholder="RSSMRA80A01H501Z"
                />
              </div>

              <button 
                type="submit" 
                disabled={loading}
                style={{ 
                  width: '100%', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, 
                  padding: 14, fontSize: 15, fontWeight: 600, cursor: 'pointer', display: 'flex', justifyContent: 'center'
                }}
              >
                {loading ? <Loader2 className="spin" size={20} /> : 'Richiedi Accesso'}
              </button>
            </form>
          )}

          {status === 'waiting' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 64, height: 64, background: '#f1f5f9', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <Loader2 size={32} color="#3b82f6" className="spin" />
              </div>
              <h2 style={{ margin: '0 0 8px', fontSize: 20, color: '#0f172a' }}>In attesa dell'Amministratore</h2>
              <p style={{ margin: 0, fontSize: 14, color: '#64748b' }}>La tua richiesta è stata inviata. Attendi che l'amministratore confermi la tua presenza in sala per abilitare il voto.</p>
            </div>
          )}

          {status === 'rejected' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 64, height: 64, background: '#fef2f2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <AlertCircle size={32} color="#ef4444" />
              </div>
              <h2 style={{ margin: '0 0 8px', fontSize: 20, color: '#0f172a' }}>Accesso Negato</h2>
              <p style={{ margin: '0 0 24px', fontSize: 14, color: '#64748b' }}>L'amministratore ha rifiutato la tua richiesta. Rivolgiti al banco per maggiori informazioni.</p>
              <button 
                onClick={() => setStatus('start')}
                style={{ width: '100%', background: '#f1f5f9', color: '#334155', border: 'none', borderRadius: 8, padding: 14, fontSize: 15, fontWeight: 600, cursor: 'pointer' }}
              >
                Riprova
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
