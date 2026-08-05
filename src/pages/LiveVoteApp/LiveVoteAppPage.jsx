import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { Loader2, AlertCircle } from 'lucide-react'
import LiveVoteAppCore from './LiveVoteAppCore'

export default function LiveVoteAppPage() {
  const { token } = useParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  const [sessionInfo, setSessionInfo] = useState(null)

  useEffect(() => {
    async function validateToken() {
      try {
        // Verifica il token nella tabella assemblee_token_accesso
        const { data, error: fetchError } = await supabase
          .from('assemblee_token_accesso')
          .select('*')
          .eq('token', token)
          .single()

        if (fetchError || !data) {
          throw new Error("Token non valido o scaduto.")
        }

        // Segna come utilizzato (opzionale, o usiamo un last_login)
        await supabase.from('assemblee_token_accesso').update({ utilizzato_il: new Date().toISOString() }).eq('id', data.id)

        setSessionInfo({
          assembleaId: data.assemblea_id,
          personaId: data.persona_id
        })

      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    validateToken()
  }, [token])

  if (loading) {
    return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Loader2 size={32} color="#3b82f6" className="spin" /></div>
  }

  if (error) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: 24 }}>
        <div style={{ background: '#fff', padding: 32, borderRadius: 16, textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
          <div style={{ width: 64, height: 64, background: '#fef2f2', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <AlertCircle size={32} color="#ef4444" />
          </div>
          <h2 style={{ margin: '0 0 8px', fontSize: 20, color: '#0f172a' }}>Accesso Negato</h2>
          <p style={{ margin: 0, fontSize: 14, color: '#64748b' }}>{error}</p>
        </div>
      </div>
    )
  }

  return (
    <LiveVoteAppCore assembleaId={sessionInfo.assembleaId} personaId={sessionInfo.personaId} />
  )
}
