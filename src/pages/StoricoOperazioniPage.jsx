import { useEffect, useState } from 'react'
import { useAuditLog } from '../hooks/useAuditLog'
import { supabase } from '../lib/supabaseClient'

const CATEGORIE = ['anagrafica', 'spese', 'ripartizioni', 'documenti', 'esercizi', 'millesimi', 'altro']
const AZIONI = ['INSERT', 'UPDATE', 'DELETE']

const CATEGORIA_ICONS = {
  anagrafica: '👤', spese: '💸', ripartizioni: '📊',
  documenti: '📄', esercizi: '📅', millesimi: '🔢', altro: '📁'
}
const AZIONE_COLORI = {
  INSERT: { bg: '#10b98122', color: '#10b981', label: 'Creazione' },
  UPDATE: { bg: '#3b82f622', color: '#60a5fa', label: 'Modifica' },
  DELETE: { bg: '#ef444422', color: '#f87171', label: 'Eliminazione' },
}

// ✅ Rinominato: ArchivioPage → StoricoOperazioniPage
export default function StoricoOperazioniPage() {
  const { log, loading, totale, fetch } = useAuditLog()
  const [condomini, setCondomini] = useState([])
  const [filtri, setFiltri] = useState({
    condominioId: '', categoria: '', azione: '',
    dataDal: '', dataAl: '', cerca: '', pagina: 0
  })
  const [expandedId, setExpandedId] = useState(null)
  const PER_PAGINA = 50

  useEffect(() => {
    supabase.from('condomini').select('id, nome').then(({ data }) => setCondomini(data || []))
  }, [])

  useEffect(() => {
    fetch({
      condominioId: filtri.condominioId || null,
      categoria:    filtri.categoria    || null,
      azione:       filtri.azione       || null,
      dataDal:      filtri.dataDal      || null,
      dataAl:       filtri.dataAl       || null,
      cerca:        filtri.cerca,
      pagina:       filtri.pagina,
      perPagina:    PER_PAGINA,
    })
  }, [filtri])

  const setFiltro = (k, v) => setFiltri(f => ({ ...f, [k]: v, pagina: 0 }))

  const inputStyle = {
    background: '#1e293b', color: '#f1f5f9', border: '1px solid #334155',
    borderRadius: 8, padding: '8px 12px', fontSize: 13, fontFamily: 'Sora, sans-serif'
  }

  const renderDiff = (prima, dopo) => {
    if (!prima && dopo) {
      return (
        <div style={{ fontSize: 12, color: '#64748b' }}>
          <div style={{ color: '#10b981', marginBottom: 4, fontWeight: 600 }}>Dati creati:</div>
          {Object.entries(dopo).filter(([k]) => !['id','created_at','updated_at'].includes(k)).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', gap: 8, marginBottom: 2 }}>
              <span style={{ color: '#475569', minWidth: 140 }}>{k}:</span>
              <span style={{ color: '#94a3b8' }}>{JSON.stringify(v)}</span>
            </div>
          ))}
        </div>
      )
    }
    if (prima && !dopo) {
      return (
        <div style={{ fontSize: 12, color: '#f87171' }}>
          Record eliminato. Dati rimossi: {Object.keys(prima).filter(k => !['id','created_at'].includes(k)).join(', ')}
        </div>
      )
    }
    if (prima && dopo) {
      const cambiati = Object.keys({ ...prima, ...dopo }).filter(k => {
        if (['updated_at'].includes(k)) return false
        return JSON.stringify(prima[k]) !== JSON.stringify(dopo[k])
      })
      if (!cambiati.length) return <div style={{ fontSize: 12, color: '#64748b' }}>Nessuna variazione rilevata.</div>
      return (
        <div style={{ fontSize: 12 }}>
          <div style={{ color: '#60a5fa', marginBottom: 6, fontWeight: 600 }}>Campi modificati:</div>
          {cambiati.map(k => (
            <div key={k} style={{ marginBottom: 6, background: '#0f172a', borderRadius: 6, padding: '6px 10px' }}>
              <div style={{ color: '#64748b', marginBottom: 4 }}>{k}</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <span style={{ background: '#ef444422', color: '#f87171', padding: '2px 6px', borderRadius: 4, maxWidth: '45%', wordBreak: 'break-all' }}>
                  {JSON.stringify(prima[k]) ?? 'null'}
                </span>
                <span style={{ color: '#475569' }}>→</span>
                <span style={{ background: '#10b98122', color: '#10b981', padding: '2px 6px', borderRadius: 4, maxWidth: '45%', wordBreak: 'break-all' }}>
                  {JSON.stringify(dopo[k]) ?? 'null'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <div style={{ padding: 32, maxWidth: 1200, margin: '0 auto', fontFamily: 'Sora, sans-serif' }}>
      {/* ✅ Header rinominato */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ margin: '0 0 4px', color: '#f1f5f9', fontSize: 26, fontWeight: 700 }}>
          Storico operazioni
        </h1>
        <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>
          Storico completo di tutte le operazioni: anagrafica, spese, documenti
        </p>
      </div>

      {/* Filtri */}
      <div style={{ background: '#1e293b', borderRadius: 12, padding: '18px 20px', border: '1px solid #334155', marginBottom: 24, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: '2 1 200px' }}>
          <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 5 }}>Cerca</div>
          <input style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} placeholder="Tabella, note..."
            value={filtri.cerca} onChange={e => setFiltro('cerca', e.target.value)} />
        </div>
        <div style={{ flex: '2 1 180px' }}>
          <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 5 }}>Condominio</div>
          <select style={{ ...inputStyle, width: '100%' }} value={filtri.condominioId} onChange={e => setFiltro('condominioId', e.target.value)}>
            <option value="">Tutti</option>
            {condomini.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
        <div style={{ flex: '1 1 140px' }}>
          <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 5 }}>Categoria</div>
          <select style={{ ...inputStyle, width: '100%' }} value={filtri.categoria} onChange={e => setFiltro('categoria', e.target.value)}>
            <option value="">Tutte</option>
            {CATEGORIE.map(c => <option key={c} value={c}>{CATEGORIA_ICONS[c]} {c}</option>)}
          </select>
        </div>
        <div style={{ flex: '1 1 130px' }}>
          <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 5 }}>Azione</div>
          <select style={{ ...inputStyle, width: '100%' }} value={filtri.azione} onChange={e => setFiltro('azione', e.target.value)}>
            <option value="">Tutte</option>
            {AZIONI.map(a => <option key={a} value={a}>{AZIONE_COLORI[a].label}</option>)}
          </select>
        </div>
        <div style={{ flex: '1 1 130px' }}>
          <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 5 }}>Dal</div>
          <input type="date" style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
            value={filtri.dataDal} onChange={e => setFiltro('dataDal', e.target.value)} />
        </div>
        <div style={{ flex: '1 1 130px' }}>
          <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 5 }}>Al</div>
          <input type="date" style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
            value={filtri.dataAl} onChange={e => setFiltro('dataAl', e.target.value)} />
        </div>
        <button onClick={() => setFiltri({ condominioId: '', categoria: '', azione: '', dataDal: '', dataAl: '', cerca: '', pagina: 0 })}
          style={{ background: 'transparent', color: '#64748b', border: '1px solid #334155', borderRadius: 8, padding: '8px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'Sora, sans-serif', alignSelf: 'flex-end' }}>
          Reset
        </button>
      </div>

      <div style={{ color: '#64748b', fontSize: 13, marginBottom: 14 }}>
        {totale} {totale === 1 ? 'evento' : 'eventi'} trovati
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: '#64748b', padding: 40 }}>Caricamento storico...</div>
      ) : log.length === 0 ? (
        <div style={{ background: '#1e293b', border: '2px dashed #334155', borderRadius: 12, padding: 48, textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📭</div>
          <p style={{ color: '#64748b', margin: 0 }}>Nessun evento corrisponde ai filtri selezionati</p>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {log.map(evento => {
              const azioneInfo     = AZIONE_COLORI[evento.azione] || AZIONE_COLORI.UPDATE
              const isExpanded     = expandedId === evento.id
              const hasDiff        = evento.dati_prima || evento.dati_dopo
              let nCampiCambiati   = 0
              if (evento.azione === 'UPDATE' && evento.dati_prima && evento.dati_dopo) {
                nCampiCambiati = Object.keys({ ...evento.dati_prima, ...evento.dati_dopo })
                  .filter(k => !['updated_at'].includes(k) &&
                    JSON.stringify(evento.dati_prima[k]) !== JSON.stringify(evento.dati_dopo[k])
                  ).length
              }
              return (
                <div key={evento.id} style={{ background: '#1e293b', borderRadius: 8, border: '1px solid #334155', overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: hasDiff ? 'pointer' : 'default' }}
                    onClick={() => hasDiff && setExpandedId(isExpanded ? null : evento.id)}>
                    <span style={{ background: azioneInfo.bg, color: azioneInfo.color, borderRadius: 6, padding: '3px 9px', fontSize: 11, fontWeight: 700, minWidth: 80, textAlign: 'center', flexShrink: 0 }}>
                      {azioneInfo.label}
                    </span>
                    <span style={{ fontSize: 16, flexShrink: 0 }}>{CATEGORIA_ICONS[evento.categoria] || '📁'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: '#f1f5f9', fontSize: 13, fontWeight: 500 }}>{evento.tabella_modificata.replace(/_/g, ' ')}</span>
                        {evento.condomini?.nome && <span style={{ color: '#475569', fontSize: 12 }}>· {evento.condomini.nome}</span>}
                        {nCampiCambiati > 0 && (
                          <span style={{ background: '#3b82f622', color: '#60a5fa', borderRadius: 4, padding: '1px 6px', fontSize: 11 }}>
                            {nCampiCambiati} {nCampiCambiati === 1 ? 'campo' : 'campi'} modificati
                          </span>
                        )}
                      </div>
                      <div style={{ color: '#475569', fontSize: 11, marginTop: 2 }}>ID: {evento.record_id?.slice(0, 8)}...</div>
                    </div>
                    <div style={{ color: '#64748b', fontSize: 12, textAlign: 'right', flexShrink: 0 }}>
                      {new Date(evento.created_at).toLocaleDateString('it-IT')}<br />
                      <span style={{ fontSize: 11 }}>{new Date(evento.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    {hasDiff && <span style={{ color: '#475569', fontSize: 14, flexShrink: 0, transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>›</span>}
                  </div>
                  {isExpanded && hasDiff && (
                    <div style={{ borderTop: '1px solid #334155', padding: '14px 16px', background: '#0f172a' }}>
                      {renderDiff(evento.dati_prima, evento.dati_dopo)}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {totale > PER_PAGINA && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 24 }}>
              <button disabled={filtri.pagina === 0} onClick={() => setFiltri(f => ({ ...f, pagina: f.pagina - 1 }))}
                style={{ background: filtri.pagina === 0 ? '#0f172a' : '#1e293b', color: filtri.pagina === 0 ? '#334155' : '#94a3b8', border: '1px solid #334155', borderRadius: 8, padding: '8px 16px', cursor: filtri.pagina === 0 ? 'not-allowed' : 'pointer', fontFamily: 'Sora, sans-serif' }}>
                ← Precedente
              </button>
              <span style={{ color: '#64748b', fontSize: 13, padding: '8px 12px' }}>
                Pagina {filtri.pagina + 1} di {Math.ceil(totale / PER_PAGINA)}
              </span>
              <button disabled={(filtri.pagina + 1) * PER_PAGINA >= totale} onClick={() => setFiltri(f => ({ ...f, pagina: f.pagina + 1 }))}
                style={{ background: (filtri.pagina + 1) * PER_PAGINA >= totale ? '#0f172a' : '#1e293b', color: (filtri.pagina + 1) * PER_PAGINA >= totale ? '#334155' : '#94a3b8', border: '1px solid #334155', borderRadius: 8, padding: '8px 16px', cursor: (filtri.pagina + 1) * PER_PAGINA >= totale ? 'not-allowed' : 'pointer', fontFamily: 'Sora, sans-serif' }}>
                Successiva →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
