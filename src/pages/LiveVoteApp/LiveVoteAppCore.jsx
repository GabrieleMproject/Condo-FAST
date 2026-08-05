import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { Check, X, Minus, Loader2, Building2 } from 'lucide-react'

export default function LiveVoteAppCore({ assembleaId, personaId }) {
  const [odg, setOdg] = useState([])
  const [mieiVoti, setMieiVoti] = useState([])
  const [presenza, setPresenza] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      // 1. Fetch OdG
      const { data: odgData } = await supabase.from('assemblee_odg').select('*').eq('assemblea_id', assembleaId).order('numero_ordine')
      setOdg(odgData || [])

      // 2. Fetch i miei voti
      const { data: votiData } = await supabase.from('assemblee_voti').select('*').eq('persona_id', personaId)
      setMieiVoti(votiData || [])

      // 3. Fetch mia presenza (per sapere la mia unita_id)
      const { data: presData } = await supabase.from('assemblee_presenze').select('unita_id').eq('assemblea_id', assembleaId).eq('persona_id', personaId).single()
      setPresenza(presData)
      
      setLoading(false)
    }
    load()

    // Realtime per cambiamenti OdG (apertura/chiusura votazioni)
    const channel = supabase.channel(`condomino_${personaId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'assemblee_odg', filter: `assemblea_id=eq.${assembleaId}` }, (payload) => {
        setOdg(prev => prev.map(o => o.id === payload.new.id ? payload.new : o))
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assemblee_voti', filter: `persona_id=eq.${personaId}` }, (payload) => {
        // Se qualcun altro (admin) modifica il mio voto, lo vedo aggiornato
        if (payload.eventType === 'INSERT') setMieiVoti(p => [...p, payload.new])
        if (payload.eventType === 'UPDATE') setMieiVoti(p => p.map(v => v.id === payload.new.id ? payload.new : v))
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [assembleaId, personaId])

  const inviaVoto = async (odgId, voto) => {
    if (!presenza) {
      alert("Errore: la tua presenza non è stata registrata su un'unità specifica.")
      return
    }

    const payload = {
      odg_id: odgId,
      unita_id: presenza.unita_id,
      persona_id: personaId,
      voto: voto
    }

    const exist = mieiVoti.find(v => v.odg_id === odgId)
    if (exist) {
      await supabase.from('assemblee_voti').update({ voto }).eq('id', exist.id)
    } else {
      await supabase.from('assemblee_voti').insert(payload)
    }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><Loader2 className="spin" /></div>

  const odgInCorso = odg.find(o => o.stato_votazione === 'in_corso')

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: '#1e293b', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12, color: '#fff', position: 'sticky', top: 0, zIndex: 10 }}>
        <Building2 size={24} />
        <div>
          <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>CondoFAST Live</h1>
          <p style={{ margin: 0, fontSize: 11, color: '#10b981', fontWeight: 600 }}>• CONNESSO</p>
        </div>
      </div>

      <div style={{ padding: 16, flex: 1, overflowY: 'auto' }}>
        
        {/* Banner Votazione Attiva */}
        {odgInCorso ? (
          <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 10px 25px rgba(37,99,235,0.1)', border: '2px solid #3b82f6', marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#3b82f6', fontSize: 12, fontWeight: 700, marginBottom: 12 }}>
              <span style={{ width: 8, height: 8, borderRadius: 4, background: '#3b82f6', display: 'inline-block' }}></span>
              VOTAZIONE APERTA
            </div>
            <h2 style={{ margin: '0 0 16px', fontSize: 20 }}>{odgInCorso.numero_ordine}. {odgInCorso.titolo}</h2>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <VotoBtn label="Sì" icon={Check} color="#10b981" active={mieiVoti.find(v=>v.odg_id===odgInCorso.id)?.voto === 'favorevole'} onClick={() => inviaVoto(odgInCorso.id, 'favorevole')} />
              <VotoBtn label="No" icon={X} color="#ef4444" active={mieiVoti.find(v=>v.odg_id===odgInCorso.id)?.voto === 'contrario'} onClick={() => inviaVoto(odgInCorso.id, 'contrario')} />
              <VotoBtn label="Ast." icon={Minus} color="#94a3b8" active={mieiVoti.find(v=>v.odg_id===odgInCorso.id)?.voto === 'astenuto'} onClick={() => inviaVoto(odgInCorso.id, 'astenuto')} />
            </div>
            {mieiVoti.find(v=>v.odg_id===odgInCorso.id) && (
              <p style={{ margin: '16px 0 0', fontSize: 12, textAlign: 'center', color: '#10b981', fontWeight: 600 }}>Il tuo voto è stato registrato.</p>
            )}
          </div>
        ) : (
          <div style={{ background: 'var(--card-bg)', borderRadius: 12, padding: 24, textAlign: 'center', marginBottom: 24, border: '1px solid var(--border-color)' }}>
            <h3 style={{ margin: '0 0 8px' }}>Nessuna votazione attiva</h3>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)' }}>Segui l'assemblea. I pulsanti di voto appariranno qui quando l'amministratore aprirà una votazione.</p>
          </div>
        )}

        {/* Lista OdG passati / futuri */}
        <h4 style={{ margin: '0 0 16px', fontSize: 14, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Ordine del Giorno</h4>
        <div style={{ display: 'grid', gap: 12 }}>
          {odg.map(o => {
            const mioVoto = mieiVoti.find(v => v.odg_id === o.id)
            return (
              <div key={o.id} style={{ background: '#fff', borderRadius: 12, padding: 16, border: '1px solid #e2e8f0', opacity: o.stato_votazione === 'in_corso' ? 0.5 : 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#334155', marginBottom: mioVoto ? 8 : 0 }}>
                  {o.numero_ordine}. {o.titolo}
                </div>
                {mioVoto && (
                  <div style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
                    Hai votato: 
                    <strong style={{ 
                      color: mioVoto.voto === 'favorevole' ? '#10b981' : mioVoto.voto === 'contrario' ? '#ef4444' : '#94a3b8',
                      textTransform: 'uppercase' 
                    }}>
                      {mioVoto.voto}
                    </strong>
                  </div>
                )}
              </div>
            )
          })}
        </div>

      </div>
    </div>
  )
}

function VotoBtn({ label, icon: Icon, color, active, onClick }) {
  return (
    <button 
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
        background: active ? color : '#f8fafc',
        color: active ? '#fff' : '#64748b',
        border: `2px solid ${active ? color : '#e2e8f0'}`,
        borderRadius: 12, padding: '16px 8px', cursor: 'pointer', transition: 'all 0.2s', fontWeight: 600
      }}
    >
      <Icon size={24} />
      {label}
    </button>
  )
}
