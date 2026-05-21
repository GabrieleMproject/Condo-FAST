import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useSpese } from '../hooks/useSpese'
import { useEsercizi } from '../hooks/useEsercizi'
import { useMillesimi } from '../hooks/useMillesimi'
import { useDocumenti } from '../hooks/useDocumenti'
import SpeseForm from '../components/SpeseForm'

const CATEGORIE_COLORI = {
  ordinaria: '#3b82f6', straordinaria: '#8b5cf6', manutenzione: '#f59e0b',
  utenze: '#06b6d4', assicurazione: '#10b981', altro: '#6b7280'
}

export default function SpesePage() {
  const { condominioId } = useParams()
  const [esercizioAttivo, setEsercizioAttivo] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [showEsercizioForm, setShowEsercizioForm] = useState(false)
  const [spesaInEdit, setSpesaInEdit] = useState(null)
  const [unita, setUnita] = useState([])
  const [condominio, setCondominio] = useState(null)
  const [subentriAlert, setSubentriAlert] = useState([])

  const { esercizi, loading: loadEsercizi, fetch: fetchEsercizi, crea: creaEsercizio } = useEsercizi(condominioId)
  const { spese, loading: loadSpese, fetch: fetchSpese, crea: creaSpesa, elimina, segnalaSubentro } = useSpese(condominioId, esercizioAttivo?.id)
  const { tabelle, fetch: fetchTabelle } = useMillesimi(condominioId)
  const { documenti, fetch: fetchDocumenti } = useDocumenti(condominioId)

  const [nuovoEsercizio, setNuovoEsercizio] = useState({
    anno: new Date().getFullYear(),
    data_inizio: `${new Date().getFullYear()}-01-01`,
    data_fine: `${new Date().getFullYear()}-12-31`,
    stato: 'aperto', note: ''
  })

  useEffect(() => {
    fetchEsercizi()
    fetchTabelle()
    fetchDocumenti()
    // Fetch unità del condominio
    supabase.from('unita').select('id, interno, piano, tipo').eq('condominio_id', condominioId)
      .then(({ data }) => setUnita(data || []))
    supabase.from('condomini').select('nome, indirizzo').eq('id', condominioId).single()
      .then(({ data }) => setCondominio(data))
  }, [condominioId])

  // Seleziona esercizio aperto di default
  useEffect(() => {
    if (esercizi.length && !esercizioAttivo) {
      const aperto = esercizi.find(e => e.stato === 'aperto') || esercizi[0]
      setEsercizioAttivo(aperto)
    }
  }, [esercizi])

  useEffect(() => {
    if (esercizioAttivo) fetchSpese()
  }, [esercizioAttivo])

  // Rileva subentri non gestiti
  useEffect(() => {
    const alert = spese.filter(s =>
      s.ripartizioni?.some(r => r.subentro_segnalato && !r.importo_override)
    )
    setSubentriAlert(alert)
  }, [spese])

  const handleCreaEsercizio = async (e) => {
    e.preventDefault()
    try {
      const esercizio = await creaEsercizio(nuovoEsercizio)
      setEsercizioAttivo(esercizio)
      setShowEsercizioForm(false)
    } catch (err) {
      alert('Errore: ' + err.message)
    }
  }

  const handleSaveSpesa = async (payload, ripartizioni) => {
    try {
      await creaSpesa({ ...payload, esercizio_id: esercizioAttivo.id }, ripartizioni)
      setShowForm(false)
      setSpesaInEdit(null)
    } catch (err) {
      alert('Errore: ' + err.message)
    }
  }

  const totaleSpese = spese.reduce((s, sp) => s + parseFloat(sp.importo || 0), 0)

  const inputStyle = {
    width: '100%', background: '#0f172a', color: '#f1f5f9',
    border: '1px solid #334155', borderRadius: 8, padding: '10px 12px',
    fontSize: 14, fontFamily: 'Sora, sans-serif', boxSizing: 'border-box'
  }

  return (
    <div style={{ padding: 32, maxWidth: 1200, margin: '0 auto', fontFamily: 'Sora, sans-serif' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ margin: '0 0 4px', color: '#f1f5f9', fontSize: 26, fontWeight: 700 }}>
          Spese condominiali
        </h1>
        {condominio && (
          <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>
            {condominio.nome} · {condominio.indirizzo}
          </p>
        )}
      </div>

      {/* Alert subentri */}
      {subentriAlert.length > 0 && (
        <div style={{
          background: '#78350f22', border: '1px solid #f59e0b44', borderRadius: 10,
          padding: '14px 18px', marginBottom: 20, display: 'flex', gap: 12, alignItems: 'center'
        }}>
          <span style={{ fontSize: 20 }}>⚠️</span>
          <div>
            <div style={{ color: '#fbbf24', fontWeight: 600, fontSize: 14 }}>
              {subentriAlert.length} {subentriAlert.length === 1 ? 'spesa ha' : 'spese hanno'} subentri non gestiti
            </div>
            <div style={{ color: '#92400e', fontSize: 13 }}>
              Ci sono cambi di proprietà/inquilino che richiedono revisione manuale della ripartizione.
            </div>
          </div>
        </div>
      )}

      {/* Selezione esercizio */}
      <div style={{
        background: '#1e293b', borderRadius: 12, padding: '16px 20px',
        border: '1px solid #334155', marginBottom: 24,
        display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap'
      }}>
        <span style={{ color: '#94a3b8', fontSize: 13, fontWeight: 600 }}>Esercizio:</span>
        <div style={{ display: 'flex', gap: 8, flex: 1, flexWrap: 'wrap' }}>
          {esercizi.map(es => (
            <button
              key={es.id}
              onClick={() => setEsercizioAttivo(es)}
              style={{
                background: esercizioAttivo?.id === es.id ? '#2563eb' : '#0f172a',
                color: esercizioAttivo?.id === es.id ? '#fff' : '#94a3b8',
                border: `1px solid ${esercizioAttivo?.id === es.id ? '#2563eb' : '#334155'}`,
                borderRadius: 8, padding: '7px 14px', fontSize: 13, cursor: 'pointer',
                fontFamily: 'Sora, sans-serif', display: 'flex', alignItems: 'center', gap: 6
              }}
            >
              {es.anno}
              <span style={{
                fontSize: 10, padding: '1px 6px', borderRadius: 4,
                background: es.stato === 'aperto' ? '#10b98133' : '#6b728033',
                color: es.stato === 'aperto' ? '#10b981' : '#9ca3af'
              }}>
                {es.stato}
              </span>
            </button>
          ))}
          <button
            onClick={() => setShowEsercizioForm(true)}
            style={{
              background: 'transparent', color: '#64748b', border: '1px dashed #334155',
              borderRadius: 8, padding: '7px 14px', fontSize: 13, cursor: 'pointer',
              fontFamily: 'Sora, sans-serif'
            }}
          >
            + Nuovo esercizio
          </button>
        </div>
      </div>

      {/* KPI row */}
      {esercizioAttivo && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
          {[
            { label: 'Totale spese', value: `€${totaleSpese.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`, color: '#3b82f6' },
            { label: 'N. spese', value: spese.length, color: '#8b5cf6' },
            { label: 'Unità coinvolte', value: unita.length, color: '#10b981' },
          ].map(kpi => (
            <div key={kpi.label} style={{
              background: '#1e293b', borderRadius: 10, padding: '16px 20px',
              border: `1px solid ${kpi.color}33`
            }}>
              <div style={{ color: '#64748b', fontSize: 12, marginBottom: 4 }}>{kpi.label}</div>
              <div style={{ color: kpi.color, fontSize: 22, fontWeight: 700 }}>{kpi.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      {esercizioAttivo && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
          <button
            onClick={() => setShowForm(true)}
            style={{
              background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8,
              padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'Sora, sans-serif', display: 'flex', alignItems: 'center', gap: 8
            }}
          >
            + Nuova spesa
          </button>
        </div>
      )}

      {/* Form nuova spesa */}
      {showForm && esercizioAttivo && (
        <div style={{ marginBottom: 24 }}>
          <SpeseForm
            esercizioId={esercizioAttivo.id}
            condominioId={condominioId}
            tabelle={tabelle}
            unita={unita}
            documenti={documenti}
            spesaInEdit={spesaInEdit}
            onSave={handleSaveSpesa}
            onCancel={() => { setShowForm(false); setSpesaInEdit(null) }}
          />
        </div>
      )}

      {/* Lista spese */}
      {!esercizioAttivo ? (
        <div style={{
          background: '#1e293b', border: '2px dashed #334155', borderRadius: 12,
          padding: 48, textAlign: 'center'
        }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📅</div>
          <p style={{ color: '#64748b', margin: 0 }}>Crea un esercizio contabile per iniziare</p>
        </div>
      ) : loadSpese ? (
        <div style={{ textAlign: 'center', color: '#64748b', padding: 40 }}>Caricamento spese...</div>
      ) : spese.length === 0 ? (
        <div style={{
          background: '#1e293b', border: '2px dashed #334155', borderRadius: 12,
          padding: 48, textAlign: 'center'
        }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>💸</div>
          <p style={{ color: '#64748b', margin: 0 }}>Nessuna spesa per questo esercizio</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {spese.map(spesa => {
            const hasSubentro = spesa.ripartizioni?.some(r => r.subentro_segnalato && !r.importo_override)
            return (
              <div
                key={spesa.id}
                style={{
                  background: '#1e293b', borderRadius: 10, padding: '16px 20px',
                  border: `1px solid ${hasSubentro ? '#f59e0b44' : '#334155'}`,
                  display: 'flex', alignItems: 'center', gap: 16
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ color: '#f1f5f9', fontWeight: 600, fontSize: 15 }}>
                      {spesa.descrizione}
                    </span>
                    <span style={{
                      background: CATEGORIE_COLORI[spesa.categoria] + '22',
                      color: CATEGORIE_COLORI[spesa.categoria],
                      borderRadius: 4, padding: '2px 8px', fontSize: 11
                    }}>{spesa.categoria}</span>
                    {spesa.tipo_lavoro === 'straordinario' && (
                      <span style={{ background: '#7c3aed22', color: '#a78bfa', borderRadius: 4, padding: '2px 8px', fontSize: 11 }}>
                        straordinario
                      </span>
                    )}
                    {hasSubentro && (
                      <span style={{ background: '#f59e0b22', color: '#f59e0b', borderRadius: 4, padding: '2px 8px', fontSize: 11 }}>
                        ⚠ subentro
                      </span>
                    )}
                    {spesa.suggerimento_ai && !spesa.criterio_override && (
                      <span style={{ background: '#7c3aed11', color: '#7c3aed', borderRadius: 4, padding: '2px 8px', fontSize: 11 }}>
                        🤖 AI
                      </span>
                    )}
                  </div>
                  <div style={{ color: '#64748b', fontSize: 12, display: 'flex', gap: 12 }}>
                    <span>{new Date(spesa.data_spesa).toLocaleDateString('it-IT')}</span>
                    {spesa.fornitore && <span>· {spesa.fornitore}</span>}
                    <span>· {spesa.criterio === 'millesimi' ? '📊 Millesimi' : spesa.criterio === 'quota_fissa' ? '⚖️ Quote fisse' : '🔀 Misto'}</span>
                    {spesa.tabelle_millesimali && <span>· {spesa.tabelle_millesimali.nome}</span>}
                    <span>· {spesa.ripartizioni?.length || 0} unità</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#10b981', fontSize: 18, fontWeight: 700 }}>
                    €{parseFloat(spesa.importo).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                  </div>
                  <button
                    onClick={() => elimina(spesa.id)}
                    style={{
                      background: 'transparent', color: '#64748b', border: 'none',
                      fontSize: 12, cursor: 'pointer', marginTop: 4
                    }}
                  >
                    Elimina
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal nuovo esercizio */}
      {showEsercizioForm && (
        <div style={{
          position: 'fixed', inset: 0, background: '#00000088', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div style={{
            background: '#1e293b', borderRadius: 16, padding: 32, maxWidth: 480,
            width: '100%', border: '1px solid #334155'
          }}>
            <h3 style={{ margin: '0 0 24px', color: '#f1f5f9' }}>Nuovo esercizio contabile</h3>
            <form onSubmit={handleCreaEsercizio}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, marginBottom: 6 }}>Anno</label>
                  <input type="number" style={inputStyle}
                    value={nuovoEsercizio.anno}
                    onChange={e => setNuovoEsercizio(f => ({
                      ...f, anno: parseInt(e.target.value),
                      data_inizio: `${e.target.value}-01-01`,
                      data_fine: `${e.target.value}-12-31`
                    }))} />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, marginBottom: 6 }}>Data inizio</label>
                  <input type="date" style={inputStyle}
                    value={nuovoEsercizio.data_inizio}
                    onChange={e => setNuovoEsercizio(f => ({ ...f, data_inizio: e.target.value }))} />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#94a3b8', fontSize: 13, marginBottom: 6 }}>Data fine</label>
                  <input type="date" style={inputStyle}
                    value={nuovoEsercizio.data_fine}
                    onChange={e => setNuovoEsercizio(f => ({ ...f, data_fine: e.target.value }))} />
                </div>
              </div>
              <div style={{ background: '#0f172a', borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 13, color: '#64748b' }}>
                ℹ️ Le 4 rate trimestrali verranno generate automaticamente
              </div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowEsercizioForm(false)} style={{
                  background: 'transparent', color: '#94a3b8', border: '1px solid #334155',
                  borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontFamily: 'Sora, sans-serif'
                }}>Annulla</button>
                <button type="submit" style={{
                  background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8,
                  padding: '10px 20px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Sora, sans-serif'
                }}>Crea esercizio</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
