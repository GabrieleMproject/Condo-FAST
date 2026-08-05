import { useState } from 'react'
import { useAssembleaLive } from '../hooks/useAssembleaLive'
import { ArrowLeft, Users, Loader2, CheckCircle2, Circle, Check, X, Minus } from 'lucide-react'

export default function AssembleaLiveConsole({ assembleaId, onClose }) {
  const { odg, presenze, voti, loading, error, togglePresenza, registraVoto, cambiaStatoOdg } = useAssembleaLive(assembleaId)
  
  // Per l'appello, avremmo bisogno della lista completa delle unità/persone del condominio, ma per semplificare 
  // nella Live Console mostriamo chi ha fatto check-in. In una versione completa qui ci sarebbe un hook `useUnita` per
  // elencare tutti e spuntare i presenti. 
  
  const [activeOdgTab, setActiveOdgTab] = useState(null)

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}><Loader2 size={24} className="spin" /></div>
  if (error) return <div style={{ color: '#ef4444' }}>Errore: {error}</div>

  // Calcolo presenze base
  const totaliPresenti = presenze.filter(p => p.presente).length
  // In futuro qui calcoliamo la somma dei millesimi per il quorum costitutivo

  return (
    <div style={{ background: 'var(--card-bg)', borderRadius: 16, border: '1px solid var(--border-color)', overflow: 'hidden', minHeight: 600, display: 'flex', flexDirection: 'column' }}>
      
      {/* Header Live */}
      <div style={{ background: '#1e293b', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#fff', borderBottom: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', borderRadius: 8, padding: 8, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <ArrowLeft size={16} />
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: 5, background: '#10b981', boxShadow: '0 0 10px #10b981' }}></span>
              <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#10b981' }}>Live Console</span>
            </div>
            <h3 style={{ margin: '4px 0 0', fontSize: 18 }}>Regia Assemblea</h3>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '6px 16px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 8, border: '1px solid rgba(255,255,255,0.1)' }}>
            <Users size={16} color="#94a3b8" />
            <span style={{ fontSize: 14 }}>
              <strong>{totaliPresenti}</strong> <span style={{ color: '#94a3b8' }}>Presenti</span>
            </span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1 }}>
        {/* Sidebar OdG */}
        <div style={{ width: 300, borderRight: '1px solid var(--border-color)', background: 'var(--app-bg)', padding: 16, overflowY: 'auto' }}>
          <h4 style={{ margin: '0 0 16px', color: 'var(--text-secondary)', fontSize: 13, textTransform: 'uppercase' }}>Ordine del Giorno</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {odg.map((item) => {
              const isActive = activeOdgTab === item.id
              return (
                <button 
                  key={item.id}
                  onClick={() => setActiveOdgTab(item.id)}
                  style={{
                    background: isActive ? 'rgba(37,99,235,0.1)' : 'var(--card-bg)',
                    border: `1px solid ${isActive ? '#3b82f6' : 'var(--border-color)'}`,
                    borderRadius: 8, padding: 12, textAlign: 'left', cursor: 'pointer',
                    display: 'flex', gap: 10, color: 'var(--text-primary)'
                  }}
                >
                  <span style={{ fontWeight: 700, color: isActive ? '#3b82f6' : 'var(--text-muted)' }}>{item.numero_ordine}.</span>
                  <div style={{ flex: 1, fontSize: 13, fontWeight: isActive ? 600 : 400 }}>
                    {item.titolo}
                    {item.stato_votazione === 'in_corso' && (
                      <div style={{ fontSize: 10, color: '#10b981', fontWeight: 700, marginTop: 4 }}>VOTAZIONE APERTA</div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Main Content Area */}
        <div style={{ flex: 1, padding: 24, background: 'var(--card-bg)' }}>
          {!activeOdgTab ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', color: 'var(--text-muted)' }}>
              <CheckCircle2 size={48} style={{ marginBottom: 16, opacity: 0.5 }} />
              <p style={{ fontSize: 16 }}>Seleziona un punto all'Ordine del Giorno a sinistra per iniziare.</p>
            </div>
          ) : (
            <RenderOdgLive 
              item={odg.find(o => o.id === activeOdgTab)} 
              voti={voti.filter(v => v.odg_id === activeOdgTab)}
              cambiaStatoOdg={cambiaStatoOdg}
              registraVoto={registraVoto}
              presenze={presenze}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function RenderOdgLive({ item, voti, cambiaStatoOdg, registraVoto, presenze }) {
  const inCorso = item.stato_votazione === 'in_corso'
  
  const favorevoli = voti.filter(v => v.voto === 'favorevole').length
  const contrari = voti.filter(v => v.voto === 'contrario').length
  const astenuti = voti.filter(v => v.voto === 'astenuto').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: '0 0 8px', color: 'var(--text-primary)', fontSize: 22 }}>
          {item.numero_ordine}. {item.titolo}
        </h2>
        {item.descrizione && <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 14 }}>{item.descrizione}</p>}
      </div>

      {/* Controlli Regia */}
      <div style={{ background: 'var(--app-bg)', padding: 16, borderRadius: 12, border: '1px solid var(--border-color)', marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: 4 }}>Stato Votazione</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: inCorso ? '#10b981' : '#94a3b8' }}>
            {inCorso ? 'APCL IN CORSO' : 'CHIUSA / IN ATTESA'}
          </div>
        </div>
        <button 
          onClick={() => cambiaStatoOdg(item.id, inCorso ? 'chiusa' : 'in_corso')}
          style={{
            background: inCorso ? '#ef4444' : '#10b981',
            color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            boxShadow: `0 4px 14px ${inCorso ? 'rgba(239,68,68,0.4)' : 'rgba(16,185,129,0.4)'}`
          }}
        >
          {inCorso ? 'CHIUDI VOTAZIONE' : 'APRI VOTAZIONE'}
        </button>
      </div>

      {/* Risultati Live */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 24 }}>
        <ResultCard label="Favorevoli" count={favorevoli} color="#10b981" icon={Check} />
        <ResultCard label="Contrari" count={contrari} color="#ef4444" icon={X} />
        <ResultCard label="Astenuti" count={astenuti} color="#94a3b8" icon={Minus} />
      </div>

      {/* Simulatore Inserimento Rapido Admin */}
      {inCorso && (
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 24 }}>
          <h4 style={{ margin: '0 0 16px', color: 'var(--text-primary)' }}>Registrazione Rapida Voti (In Sala)</h4>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
            L'amministratore può segnare rapidamente i voti di chi è presente in sala. I voti dei partecipanti da remoto appariranno automaticamente in alto via Realtime.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* Lista mockata di condomini presenti */}
            {presenze.filter(p => p.presente).map(p => {
              const userVoto = voti.find(v => v.unita_id === p.unita_id)?.voto
              return (
                <div key={p.id} style={{ background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 8, padding: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {p.persona?.nome} {p.persona?.cognome}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      Unità: {p.unita?.nome} {p.delegato_a_persona_id ? '(Delega)' : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => registraVoto(item.id, p.unita_id, p.persona_id, 'favorevole')} style={S.votoBtn(userVoto === 'favorevole', '#10b981')}>Sì</button>
                    <button onClick={() => registraVoto(item.id, p.unita_id, p.persona_id, 'contrario')} style={S.votoBtn(userVoto === 'contrario', '#ef4444')}>No</button>
                    <button onClick={() => registraVoto(item.id, p.unita_id, p.persona_id, 'astenuto')} style={S.votoBtn(userVoto === 'astenuto', '#94a3b8')}>Ast</button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function ResultCard({ label, count, color, icon: Icon }) {
  return (
    <div style={{ background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ width: 48, height: 48, borderRadius: 12, background: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: color }}>
        <Icon size={24} />
      </div>
      <div>
        <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>{count}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginTop: 4 }}>{label}</div>
      </div>
    </div>
  )
}

const S = {
  votoBtn: (active, color) => ({
    background: active ? color : 'transparent',
    color: active ? '#fff' : 'var(--text-secondary)',
    border: `1px solid ${active ? color : 'var(--border-color)'}`,
    borderRadius: 6, padding: '4px 8px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
    transition: 'all 0.2s'
  })
}
