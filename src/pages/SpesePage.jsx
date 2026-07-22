import { useEffect, useState } from 'react'
import { useParams, useLocation, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { AlertTriangle, Bot, Edit3, Trash2, Info, FileSpreadsheet, Scale, Split, Plus, Pencil, Receipt, Calendar, CreditCard } from 'lucide-react'
import { useSpese } from '../hooks/useSpese'
import { useEsercizi } from '../hooks/useEsercizi'
import { useMillesimi } from '../hooks/useMillesimi'
import { useDocumenti } from '../hooks/useDocumenti'
import SpeseForm from '../components/SpeseForm'

const CATEGORIE_COLORI = {
  ordinaria: '#3b82f6', straordinaria: '#8b5cf6', manutenzione: '#f59e0b',
  utenze: '#06b6d4', assicurazione: '#10b981', altro: '#6b7280'
}

const annoCorrente = () => new Date().getFullYear()
const esercizioVuoto = () => {
  const a = annoCorrente()
  return { anno: a, data_inizio: `${a}-01-01`, data_fine: `${a}-12-31`, stato: 'aperto', tipo: 'ordinario', note: '' }
}

export default function SpesePage() {
  const { condominioId } = useParams()
  const [searchParams] = useSearchParams()
  const urlEsercizioId = searchParams.get('esercizio')

  const [esercizioAttivo, setEsercizioAttivo] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [fromFattura, setFromFattura] = useState(false)
  const [showEsercizioForm, setShowEsercizioForm] = useState(false)
  const [esercizioEditId, setEsercizioEditId] = useState(null) // null = creazione, id = modifica
  const [esercizioErr, setEsercizioErr] = useState('')
  const [spesaInEdit, setSpesaInEdit] = useState(null)
  const [unita, setUnita] = useState([])
  const [condominio, setCondominio] = useState(null)
  const [subentriAlert, setSubentriAlert] = useState([])

  const { esercizi, loading: loadEsercizi, fetch: fetchEsercizi, crea: creaEsercizio, aggiorna: aggiornaEsercizio } = useEsercizi(condominioId)
  const { spese, loading: loadSpese, fetch: fetchSpese, crea: creaSpesa, aggiorna: aggiornaSpesa, elimina, segnalaSubentro } = useSpese(condominioId, esercizioAttivo?.id)
  const { tabelle, fetch: fetchTabelle } = useMillesimi(condominioId)
  const { documenti, fetch: fetchDocumenti } = useDocumenti(condominioId)

  const [nuovoEsercizio, setNuovoEsercizio] = useState(esercizioVuoto())

  useEffect(() => {
    fetchEsercizi()
    fetchTabelle()
    fetchDocumenti()
    supabase.from('unita').select('id, numero, scala, piano, tipo').eq('condominio_id', condominioId)
      .then(({ data }) => setUnita(data || []))
    supabase.from('condomini').select('nome, indirizzo').eq('id', condominioId).single()
      .then(({ data }) => setCondominio(data))
  }, [condominioId])

  useEffect(() => {
    if (esercizi.length) {
      if (urlEsercizioId) {
        const match = esercizi.find(e => e.id === urlEsercizioId)
        if (match) {
          setEsercizioAttivo(match)
          return
        }
      }
      if (!esercizioAttivo || !esercizi.some(e => e.id === esercizioAttivo?.id)) {
        const aperto = esercizi.find(e => e.stato === 'aperto') || esercizi[0]
        setEsercizioAttivo(aperto)
      }
    }
  }, [esercizi, urlEsercizioId])

  useEffect(() => {
    if (esercizioAttivo) fetchSpese()
  }, [esercizioAttivo])

  const location = useLocation()
  useEffect(() => {
    if (location.state?.prefillSpesa && esercizioAttivo) {
      setFromFattura(false)
      setShowForm(true)
      window.history.replaceState({}, '')
    }
  }, [location.state, esercizioAttivo])

  useEffect(() => {
    const alert = spese.filter(s =>
      s.ripartizioni?.some(r => r.subentro_segnalato && !r.importo_override)
    )
    setSubentriAlert(alert)
  }, [spese])

  // ── apertura modal esercizio ───────────────────────────────
  const apriCreaEsercizio = () => {
    setEsercizioEditId(null)
    setEsercizioErr('')
    setNuovoEsercizio(esercizioVuoto())
    setShowEsercizioForm(true)
  }

  const apriModificaEsercizio = (es) => {
    setEsercizioEditId(es.id)
    setEsercizioErr('')
    setNuovoEsercizio({
      anno: es.anno,
      data_inizio: es.data_inizio || `${es.anno}-01-01`,
      data_fine: es.data_fine || `${es.anno}-12-31`,
      stato: es.stato || 'aperto',
      tipo: es.tipo || 'ordinario',
      note: es.note || ''
    })
    setShowEsercizioForm(true)
  }

  const chiudiEsercizioForm = () => {
    setShowEsercizioForm(false)
    setEsercizioEditId(null)
    setEsercizioErr('')
  }

  const handleSalvaEsercizio = async (e) => {
    e.preventDefault()
    setEsercizioErr('')
    // validazione date periodo amministrativo
    if (!nuovoEsercizio.data_inizio || !nuovoEsercizio.data_fine) {
      setEsercizioErr('Inserisci data inizio e data fine del periodo'); return
    }
    if (nuovoEsercizio.data_fine <= nuovoEsercizio.data_inizio) {
      setEsercizioErr('La data fine deve essere successiva alla data inizio'); return
    }
    try {
      if (esercizioEditId) {
        const aggiornato = await aggiornaEsercizio(esercizioEditId, nuovoEsercizio)
        if (esercizioAttivo?.id === esercizioEditId) setEsercizioAttivo(aggiornato)
      } else {
        const creato = await creaEsercizio(nuovoEsercizio)
        setEsercizioAttivo(creato)
      }
      chiudiEsercizioForm()
    } catch (err) {
      setEsercizioErr(err.message)
    }
  }

  const handleSaveSpesa = async (payload, ripartizioni, fileCaricato, aiDatiEstratti) => {
    try {
      let spesaId = spesaInEdit?.id;
      if (spesaId) {
        await aggiornaSpesa(spesaId, payload, ripartizioni)
      } else {
        const nuovaSpesa = await creaSpesa({ ...payload, esercizio_id: esercizioAttivo.id }, ripartizioni)
        spesaId = nuovaSpesa?.id;
      }
      
      if (fileCaricato && spesaId) {
        const { data: { user } } = await supabase.auth.getUser()
        const path = `${user.id}/${condominioId}/${Date.now()}_${fileCaricato.name}`
        const { error: storageErr } = await supabase.storage
          .from('fatture')
          .upload(path, fileCaricato, { contentType: fileCaricato.type })
        if (storageErr) throw storageErr

        // Cerca fornitore_id corrispondente nella rubrica fornitori
        let fornitoreId = null
        try {
          const { data: fornitoriList } = await supabase
            .from('fornitori')
            .select('id, ragione_sociale, partita_iva, codice_fiscale')
          
          if (fornitoriList && fornitoriList.length > 0) {
            const pIvaClean = (aiDatiEstratti?.partita_iva_fornitore || '').replace(/\s+/g, '')
            if (pIvaClean) {
              const trovato = fornitoriList.find(f => f.partita_iva === pIvaClean || f.codice_fiscale === pIvaClean)
              if (trovato) fornitoreId = trovato.id
            } else {
              const nomeClean = (payload.fornitore || '').trim().toLowerCase()
              const trovato = fornitoriList.find(f => f.ragione_sociale.toLowerCase() === nomeClean)
              if (trovato) fornitoreId = trovato.id
            }
          }
        } catch (fornErr) {
          console.error('Errore ricerca fornitore:', fornErr)
        }

        // Cerca se esiste già una fattura collegata
        const { data: fattureEsistenti } = await supabase
          .from('fatture_fornitori')
          .select('id')
          .eq('spesa_id', spesaId)
          .limit(1);

        const datiFattura = {
          condominio_id: condominioId,
          user_id: user.id,
          spesa_id: spesaId,
          fornitore: payload.fornitore || 'Fornitore sconosciuto',
          fornitore_id: fornitoreId,
          numero_fattura: payload.numero_fattura || null,
          data_fattura: payload.data_spesa,
          data_scadenza: aiDatiEstratti?.data_scadenza || payload.data_spesa,
          importo_totale: payload.importo,
          importo_iva: aiDatiEstratti?.importo_iva || 0,
          importo_netto: aiDatiEstratti?.importo_netto || (payload.importo - (aiDatiEstratti?.importo_iva || 0)),
          descrizione: payload.descrizione || '',
          categoria: payload.categoria || 'altro',
          stato: 'attesa',
          pdf_url: path,
          ai_dati_estratti: aiDatiEstratti,
          imponibile_ritenuta: aiDatiEstratti?.imponibile_ritenuta || 0.00,
          aliquota_ritenuta_percentuale: aiDatiEstratti?.aliquota_ritenuta_percentuale || 0.00,
          importo_ritenuta: aiDatiEstratti?.importo_ritenuta || 0.00,
          ritenuta_acconto: aiDatiEstratti?.importo_ritenuta || 0.00,
          codice_tributo_f24: aiDatiEstratti?.codice_tributo_f24 || null,
          data_pagamento: null,
        }

        if (fattureEsistenti && fattureEsistenti.length > 0) {
          const { error: invoiceErr } = await supabase.from('fatture_fornitori')
            .update(datiFattura)
            .eq('id', fattureEsistenti[0].id)
          if (invoiceErr) throw invoiceErr
        } else {
          const { error: invoiceErr } = await supabase.from('fatture_fornitori')
            .insert(datiFattura)
          if (invoiceErr) throw invoiceErr
        }
      }
      setShowForm(false)
      setFromFattura(false)
      setSpesaInEdit(null)
    } catch (err) {
      alert('Errore: ' + err.message)
    }
  }

  const apriFormManuale = () => {
    setFromFattura(false)
    setShowForm(true)
  }

  const apriFormFattura = () => {
    setFromFattura(true)
    setShowForm(true)
  }

  const chiudiForm = () => {
    setShowForm(false)
    setFromFattura(false)
    setSpesaInEdit(null)
  }

  const totaleSpese = spese.reduce((s, sp) => s + parseFloat(sp.importo || 0), 0)

  const fmtPeriodo = (es) => {
    if (!es?.data_inizio || !es?.data_fine) return null
    const d = (s) => new Date(s).toLocaleDateString('it-IT')
    return `${d(es.data_inizio)} → ${d(es.data_fine)}`
  }

  const inputStyle = {
    width: '100%', background: 'var(--app-bg)', color: 'var(--text-primary)',
    border: '1px solid var(--border-color)', borderRadius: 8, padding: '10px 12px',
    fontSize: 14, fontFamily: 'Sora, sans-serif', boxSizing: 'border-box'
  }

  return (
    <div style={{ padding: 32, maxWidth: 1200, margin: '0 auto', fontFamily: 'Sora, sans-serif' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ margin: '0 0 4px', color: 'var(--text-primary)', fontSize: 26, fontWeight: 700 }}>
          Spese condominiali
        </h1>
        {condominio && (
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 14 }}>
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
          <AlertTriangle size={20} style={{ color: '#fbbf24', flexShrink: 0 }} />
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
        background: 'var(--card-bg)', borderRadius: 12, padding: '16px 20px',
        border: '1px solid var(--border-color)', marginBottom: 24,
        display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap'
      }}>
        <span style={{ color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600 }}>Esercizio:</span>
        <div style={{ display: 'flex', gap: 8, flex: 1, flexWrap: 'wrap' }}>
          {esercizi.map(es => (
            <div
              key={es.id}
              style={{
                background: esercizioAttivo?.id === es.id
                  ? (es.tipo === 'straordinario' ? '#8b5cf6' : '#2563eb')
                  : (es.tipo === 'straordinario' ? '#161033' : 'var(--app-bg)'),
                color: esercizioAttivo?.id === es.id
                  ? '#fff'
                  : (es.tipo === 'straordinario' ? '#c084fc' : 'var(--text-secondary)'),
                border: `1px solid ${esercizioAttivo?.id === es.id
                  ? (es.tipo === 'straordinario' ? '#8b5cf6' : '#2563eb')
                  : (es.tipo === 'straordinario' ? '#4c1d95' : 'var(--border-color)')}`,
                borderRadius: 8, padding: '7px 10px 7px 14px', fontSize: 13,
                fontFamily: 'Sora, sans-serif', display: 'flex', alignItems: 'center', gap: 6
              }}
            >
              <button
                onClick={() => setEsercizioAttivo(es)}
                title={fmtPeriodo(es) || ''}
                style={{
                  background: 'transparent', border: 'none', color: 'inherit',
                  fontFamily: 'Sora, sans-serif', fontSize: 13, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6, padding: 0
                }}
              >
                {es.anno} {es.tipo === 'straordinario' ? 'straordinaria' : 'ordinaria'}
                <span style={{
                  fontSize: 10, padding: '1px 6px', borderRadius: 4,
                  background: es.stato === 'aperto' ? '#10b98133' : '#6b728033',
                  color: es.stato === 'aperto' ? '#10b981' : '#9ca3af'
                }}>
                  {es.stato}
                </span>
              </button>
              <button
                onClick={() => apriModificaEsercizio(es)}
                title="Modifica periodo / dati esercizio"
                style={{
                  background: 'transparent', border: 'none',
                  color: esercizioAttivo?.id === es.id ? '#dbeafe' : '#64748b',
                  cursor: 'pointer', fontSize: 13, padding: '0 2px', lineHeight: 1
                }}
              >
                <Pencil size={12} />
              </button>
            </div>
          ))}
          <button
            onClick={apriCreaEsercizio}
            style={{
              background: 'transparent', color: 'var(--text-muted)', border: '1px dashed var(--border-color)',
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
              background: 'var(--card-bg)', borderRadius: 10, padding: '16px 20px',
              border: `1px solid ${kpi.color}33`
            }}>
              <div style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 4 }}>{kpi.label}</div>
              <div style={{ color: kpi.color, fontSize: 22, fontWeight: 700 }}>{kpi.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Periodo esercizio attivo */}
      {esercizioAttivo && fmtPeriodo(esercizioAttivo) && (
        <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 20, marginTop: -8 }}>
          Periodo amministrativo: <span style={{ color: 'var(--text-secondary)' }}>{fmtPeriodo(esercizioAttivo)}</span>
        </div>
      )}

      {/* Actions */}
      {esercizioAttivo && !showForm && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginBottom: 20 }}>
          {/* Bottone Da fattura */}
          <button
            onClick={apriFormFattura}
            style={{
              background: 'var(--app-bg)', color: 'var(--text-secondary)',
              border: '1px solid var(--border-color)', borderRadius: 8,
              padding: '10px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'Sora, sans-serif', display: 'flex', alignItems: 'center', gap: 8
            }}
          >
            <Receipt size={14} /> Da fattura
          </button>
          <button
            onClick={apriFormManuale}
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
            fromFattura={fromFattura}
            prefillData={location.state?.prefillSpesa || null}
            onSave={handleSaveSpesa}
            onCancel={chiudiForm}
            onRefreshTabelle={fetchTabelle}
          />
        </div>
      )}

      {/* Lista spese */}
      {!esercizioAttivo ? (
        <div style={{
          background: 'var(--card-bg)', border: '2px dashed var(--border-color)', borderRadius: 12,
          padding: 48, textAlign: 'center'
        }}>
          <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
            <Calendar size={36} color="var(--text-muted)" strokeWidth={1.5} />
          </div>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>Crea un esercizio contabile per iniziare</p>
        </div>
      ) : loadSpese ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>Caricamento spese...</div>
      ) : spese.length === 0 ? (
        <div style={{
          background: 'var(--card-bg)', border: '2px dashed var(--border-color)', borderRadius: 12,
          padding: 48, textAlign: 'center'
        }}>
          <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}>
            <CreditCard size={36} color="var(--text-muted)" strokeWidth={1.5} />
          </div>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>Nessuna spesa per questo esercizio</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {spese.map(spesa => {
            const hasSubentro = spesa.ripartizioni?.some(r => r.subentro_segnalato && !r.importo_override)
            return (
              <div
                key={spesa.id}
                style={{
                  background: 'var(--card-bg)', borderRadius: 10, padding: '16px 20px',
                  border: `1px solid ${hasSubentro ? '#f59e0b44' : 'var(--border-color)'}`,
                  display: 'flex', alignItems: 'center', gap: 16
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 15 }}>
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
                      <span style={{ background: '#f59e0b22', color: '#f59e0b', borderRadius: 4, padding: '2px 8px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <AlertTriangle size={10} /> subentro
                      </span>
                    )}
                    {spesa.suggerimento_ai && !spesa.criterio_override && (
                      <span style={{ background: '#7c3aed11', color: '#7c3aed', borderRadius: 4, padding: '2px 8px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <Bot size={10} /> AI
                      </span>
                    )}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 12, display: 'flex', gap: 12 }}>
                    <span>{new Date(spesa.data_spesa).toLocaleDateString('it-IT')}</span>
                    {spesa.fornitore && <span>· {spesa.fornitore}</span>}
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      · {spesa.criterio === 'millesimi' ? <><FileSpreadsheet size={12} /> Millesimi</> : spesa.criterio === 'quota_fissa' ? <><Scale size={12} /> Quote fisse</> : <><Split size={12} /> Misto</>}
                    </span>
                    {spesa.tabelle_millesimali && <span>· {spesa.tabelle_millesimali.nome}</span>}
                    <span>· {spesa.ripartizioni?.length || 0} unità</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#10b981', fontSize: 18, fontWeight: 700 }}>
                    €{parseFloat(spesa.importo).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                  </div>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 6 }}>
                    <button
                      onClick={() => {
                        setSpesaInEdit(spesa)
                        setShowForm(true)
                      }}
                      style={{
                        background: 'transparent', color: '#3b82f6', border: 'none',
                        fontSize: 12, cursor: 'pointer', fontWeight: 600,
                        display: 'inline-flex', alignItems: 'center', gap: 4
                      }}
                      type="button"
                    >
                      <Edit3 size={12} /> Modifica
                    </button>
                    <button
                      onClick={() => elimina(spesa.id)}
                      style={{
                        background: 'transparent', color: '#ef4444', border: 'none',
                        fontSize: 12, cursor: 'pointer', fontWeight: 600,
                        display: 'inline-flex', alignItems: 'center', gap: 4
                      }}
                      type="button"
                    >
                      <Trash2 size={12} /> Elimina
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal esercizio (create / edit) */}
      {showEsercizioForm && (
        <div style={{
          position: 'fixed', inset: 0, background: '#00000088', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20
        }}>
          <div style={{
            background: 'var(--card-bg)', borderRadius: 16, padding: 32, maxWidth: 480,
            width: '100%', border: '1px solid var(--border-color)'
          }}>
            <h3 style={{ margin: '0 0 24px', color: 'var(--text-primary)' }}>
              {esercizioEditId ? 'Modifica esercizio contabile' : 'Nuovo esercizio contabile'}
            </h3>
            <form onSubmit={handleSalvaEsercizio}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: 13, marginBottom: 6 }}>Anno</label>
                  <input type="number" style={inputStyle}
                    value={nuovoEsercizio.anno}
                    onChange={e => {
                      const a = e.target.value
                      setNuovoEsercizio(f => ({
                        ...f, anno: parseInt(a) || f.anno,
                        // se l'utente non ha ancora toccato le date, le riallineo all'anno solare;
                        // in modifica lasciamo che l'utente cambi l'anno senza sovrascrivere date già custom
                        data_inizio: esercizioEditId ? f.data_inizio : `${a}-01-01`,
                        data_fine: esercizioEditId ? f.data_fine : `${a}-12-31`
                      }))
                    }} />
                </div>
                <div>
                  <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: 13, marginBottom: 6 }}>Data inizio</label>
                  <input type="date" style={inputStyle}
                    value={nuovoEsercizio.data_inizio}
                    onChange={e => setNuovoEsercizio(f => ({ ...f, data_inizio: e.target.value }))} />
                </div>
                <div>
                  <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: 13, marginBottom: 6 }}>Data fine</label>
                  <input type="date" style={inputStyle}
                    value={nuovoEsercizio.data_fine}
                    onChange={e => setNuovoEsercizio(f => ({ ...f, data_fine: e.target.value }))} />
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: 13, marginBottom: 6 }}>Stato</label>
                  <select style={inputStyle}
                    value={nuovoEsercizio.stato}
                    onChange={e => setNuovoEsercizio(f => ({ ...f, stato: e.target.value }))}>
                    <option value="aperto">aperto</option>
                    <option value="chiuso">chiuso</option>
                  </select>
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: 13, marginBottom: 6 }}>Tipo Gestione</label>
                  <select style={inputStyle}
                    value={nuovoEsercizio.tipo || 'ordinario'}
                    onChange={e => setNuovoEsercizio(f => ({ ...f, tipo: e.target.value }))}>
                    <option value="ordinario">Ordinaria (Ripartita inquilini/proprietari)</option>
                    <option value="straordinario">Straordinaria (Soli proprietari)</option>
                  </select>
                </div>
              </div>

              <div style={{ background: 'var(--app-bg)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Info size={14} style={{ flexShrink: 0 }} />
                <span>Il periodo amministrativo può non coincidere con l'anno solare (es. 1/7 → 30/6). Le rate si generano dal preventivo, non automaticamente.</span>
              </div>

              {esercizioErr && (
                <div style={{
                  background: '#ef444415', border: '1px solid #ef444440', borderRadius: 8,
                  padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#ef4444'
                }}>
                  {esercizioErr}
                </div>
              )}

              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button type="button" onClick={chiudiEsercizioForm} style={{
                  background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-color)',
                  borderRadius: 8, padding: '10px 20px', cursor: 'pointer', fontFamily: 'Sora, sans-serif'
                }}>Annulla</button>
                <button type="submit" style={{
                  background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8,
                  padding: '10px 20px', fontWeight: 600, cursor: 'pointer', fontFamily: 'Sora, sans-serif'
                }}>{esercizioEditId ? 'Salva modifiche' : 'Crea esercizio'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}