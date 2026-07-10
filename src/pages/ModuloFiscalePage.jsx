import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Landmark, Download, FileSpreadsheet, Building2, User, Calendar, CheckCircle2, AlertTriangle, FileText, Upload, Plus } from 'lucide-react'
import { exportBozzaCU, exportQuietanzaFornitore } from '../lib/exportFiscale'
import { generaCbiF24 } from '../lib/cbiGenerator'
import { generaTelematicoCU, generaTelematico770 } from '../lib/fiscaleTelematico'
import { usePlan } from '../hooks/usePlan'
import { useWatermark } from '../hooks/useWatermark'

const formattaData = (dataStr) => {
  if (!dataStr) return '—';
  const d = new Date(dataStr);
  return isNaN(d.getTime()) ? dataStr : d.toLocaleDateString('it-IT');
};

export default function ModuloFiscalePage() {
  const { profile } = usePlan()
  const { checkWatermark, WatermarkModal } = useWatermark()
  const [condomini, setCondomini] = useState([])
  const [fornitori, setFornitori] = useState([])
  const [fatture, setFatture] = useState([])
  const [f24Deleghe, setF24Deleghe] = useState([])
  const [tributi, setTributi] = useState([])
  const [abbinamenti, setAbbinamenti] = useState([])
  const [loading, setLoading] = useState(true)

  // Filtri e Tabs
  const [tabAttivo, setTabAttivo] = useState('cu_770') // cu_770 | f24 | quietanze
  const [annoSelezionato, setAnnoSelezionato] = useState(new Date().getFullYear().toString())
  const [condominioSelezionato, setCondominioSelezionato] = useState('')
  
  // Selezione per CBI massivo
  const [selezionatiCbi, setSelezionatiCbi] = useState({}) // f24Id -> boolean
  const [f24UploadingId, setF24UploadingId] = useState(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [resCondomini, resFornitori, resFatture, resF24, resTributi, resAbbinamenti] = await Promise.all([
        supabase.from('condomini').select('id, nome, codice_fiscale, indirizzo, cap, citta, provincia').order('nome'),
        supabase.from('fornitori').select('*'),
        supabase.from('fatture_fornitori').select('*, fornitore_rel:fornitore_id(*)'),
        supabase.from('f24_deleghe').select('*').order('data_scadenza', { ascending: false }),
        supabase.from('f24_dettagli_tributi').select('*'),
        supabase.from('abbinamenti_f24_fatture').select('*')
      ])
      
      setCondomini(resCondomini.data || [])
      setFornitori(resFornitori.data || [])
      
      // Filtriamo solo le fatture che contengono ritenuta d'acconto
      const fattureConRitenuta = (resFatture.data || []).filter(
        f => (parseFloat(f.importo_ritenuta) > 0 || parseFloat(f.ritenuta_acconto) > 0)
      )
      setFatture(fattureConRitenuta)
      setF24Deleghe(resF24.data || [])
      setTributi(resTributi.data || [])
      setAbbinamenti(resAbbinamenti.data || [])
    } catch (e) {
      console.error('Errore caricamento dati fiscali:', e)
    } finally {
      setLoading(false)
    }
  }

  // --- LOGICA RAGGRUPPAMENTO CERTIFICAZIONE UNICA ---
  const datiRaggruppatiCU = useMemo(() => {
    const filtrate = fatture.filter(f => {
      if (f.stato !== 'pagata') return false
      if (condominioSelezionato && f.condominio_id !== condominioSelezionato) return false
      
      const annoFattura = f.data_pagamento ? f.data_pagamento.substring(0, 4) : (f.data_fattura ? f.data_fattura.substring(0, 4) : null)
      if (annoFattura !== annoSelezionato) return false
      
      return true
    })

    const map = {}
    filtrate.forEach(fattura => {
      const cId = fattura.condominio_id
      const fId = fattura.fornitore_id || `sconosciuto-${fattura.fornitore}`
      
      if (!map[cId]) map[cId] = {}
      if (!map[cId][fId]) {
        const fornitoreInfo = fornitori.find(fo => fo.id === fId) || { 
          ragione_sociale: fattura.fornitore_rel?.ragione_sociale || fattura.fornitore, 
          partita_iva: fattura.fornitore_rel?.partita_iva || null,
          codice_fiscale: fattura.fornitore_rel?.codice_fiscale || null,
          indirizzo: fattura.fornitore_rel?.indirizzo || null,
          citta: fattura.fornitore_rel?.citta || null,
          cap: fattura.fornitore_rel?.cap || null,
          provincia: fattura.fornitore_rel?.provincia || null,
          regime_forfettario: fattura.fornitore_rel?.regime_forfettario || false,
          codice_esclusione_cu: fattura.fornitore_rel?.codice_esclusione_cu || null
        }
        
        map[cId][fId] = {
          condominio: condomini.find(c => c.id === cId) || { nome: 'Sconosciuto' },
          fornitore: fornitoreInfo,
          fatture: [],
          totaleImponibile: 0,
          totaleRitenute: 0
        }
      }
      
      map[cId][fId].fatture.push(fattura)
      const imponibile = parseFloat(fattura.imponibile_ritenuta) || (parseFloat(fattura.importo_totale || 0) - parseFloat(fattura.importo_iva || 0))
      map[cId][fId].totaleImponibile += imponibile
      map[cId][fId].totaleRitenute += parseFloat(fattura.importo_ritenuta || fattura.ritenuta_acconto || 0)
    })
    
    return map
  }, [fatture, annoSelezionato, condominioSelezionato, condomini, fornitori])

  // --- LOGICA FILTRO DELEGHE F24 ---
  const delegheFiltrare = useMemo(() => {
    return f24Deleghe.filter(d => {
      if (condominioSelezionato && d.condominio_id !== condominioSelezionato) return false
      const annoScadenza = d.data_scadenza ? d.data_scadenza.substring(0, 4) : null
      if (annoScadenza !== annoSelezionato) return false
      return true
    })
  }, [f24Deleghe, condominioSelezionato, annoSelezionato])

  // --- LOGICA RITENUTE PER QUIETANZE FORNITORI ---
  const ritenutePagateList = useMemo(() => {
    return fatture.filter(f => {
      if (f.stato !== 'pagata') return false
      if (!f.ritenuta_pagata) {
        // Fallback: se l'F24 abbinato risulta pagato, consideriamo la ritenuta pagata
        const abb = abbinamenti.find(a => a.fattura_id === f.id)
        if (abb) {
          const del = f24Deleghe.find(d => d.id === abb.f24_id)
          if (del && del.stato === 'pagato') return true
        }
        return false
      }
      return true
    }).filter(f => {
      if (condominioSelezionato && f.condominio_id !== condominioSelezionato) return false
      const annoPagamento = f.data_pagamento ? f.data_pagamento.substring(0, 4) : null
      return annoPagamento === annoSelezionato
    })
  }, [fatture, abbinamenti, f24Deleghe, condominioSelezionato, annoSelezionato])

  // --- ESPORTAZIONI ED AZIONI ---
  
  const handleExportPdfCU = (cId) => {
    checkWatermark((withWatermark) => {
      const condominioData = datiRaggruppatiCU[cId]
      const condominioInfo = condomini.find(c => c.id === cId)
      if (!condominioData) return
      
      const fornitoriList = Object.values(condominioData)
      exportBozzaCU(condominioInfo, annoSelezionato, fornitoriList, profile, withWatermark)
    })
  }

  const handleExportTxtCU = (cId) => {
    const condominioData = datiRaggruppatiCU[cId]
    const condominioInfo = condomini.find(c => c.id === cId)
    if (!condominioData) return

    const fornitoriList = Object.values(condominioData)
    const txtCU = generaTelematicoCU(condominioInfo, annoSelezionato, fornitoriList, profile)
    
    scaricaFileTxt(txtCU, `CU_${condominioInfo.nome.replace(/\s+/g, '_')}_${annoSelezionato}.txt`)
  }

  const handleExportTxt770 = (cId) => {
    const condominioInfo = condomini.find(c => c.id === cId)
    if (!condominioInfo) return

    const deleghePagate = f24Deleghe.filter(
      d => d.condominio_id === cId && d.stato === 'pagato' && d.data_pagamento?.substring(0, 4) === annoSelezionato
    ).map(d => ({
      ...d,
      f24_dettagli_tributi: tributi.filter(t => t.f24_id === d.id)
    }))

    if (deleghePagate.length === 0) {
      alert("Nessun modello F24 pagato (con quietanza registrata) trovato per questo condominio nell'anno selezionato. Impossibile generare il 770.")
      return
    }

    const txt770 = generaTelematico770(condominioInfo, annoSelezionato, deleghePagate, profile)
    scaricaFileTxt(txt770, `770_${condominioInfo.nome.replace(/\s+/g, '_')}_${annoSelezionato}.txt`)
  }

  const handleExportMassiveCBI = () => {
    const idsSelezionati = Object.keys(selezionatiCbi).filter(id => selezionatiCbi[id])
    if (idsSelezionati.length === 0) {
      alert("Seleziona almeno un F24 da esportare.")
      return
    }

    const delegheDaGenerare = f24Deleghe.filter(d => idsSelezionati.includes(d.id)).map(d => ({
      ...d,
      condominio: condomini.find(c => c.id === d.condominio_id),
      f24_dettagli_tributi: tributi.filter(t => t.f24_id === d.id)
    }))

    const cbiText = generaCbiF24(delegheDaGenerare, profile)
    scaricaFileTxt(cbiText, `DISTINTA_F24_${new Date().toISOString().split('T')[0]}.txt`)
  }

  const handleUploadQuietanza = async (f24Id, file) => {
    if (!file) return
    setF24UploadingId(f24Id)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const path = `${user.id}/f24_quietanze/${Date.now()}_${file.name}`
      
      const { error: uploadErr } = await supabase.storage
        .from('fatture')
        .upload(path, file)
      if (uploadErr) throw uploadErr

      const dataOggi = new Date().toISOString().split('T')[0]
      
      // Aggiorna F24
      const { error: updErr } = await supabase.from('f24_deleghe')
        .update({ 
          stato: 'pagato',
          data_pagamento: dataOggi,
          quietanza_url: path
        })
        .eq('id', f24Id)
      if (updErr) throw updErr

      // Aggiorna fatture collegate
      const collegateIds = abbinamenti.filter(a => a.f24_id === f24Id).map(a => a.fattura_id)
      if (collegateIds.length > 0) {
        const { error: updFattErr } = await supabase.from('fatture_fornitori')
          .update({ 
            ritenuta_pagata: true,
            f24_url: path
          })
          .in('id', collegateIds)
        if (updFattErr) throw updFattErr
      }

      alert('Quietanza registrata e F24 impostato come PAGATO con successo.')
      await loadData()
    } catch (err) {
      alert('Errore registrazione quietanza: ' + err.message)
    } finally {
      setF24UploadingId(null)
    }
  }

  const visualizzaQuietanza = async (path) => {
    const newTab = window.open('about:blank', '_blank')
    try {
      const { data, error } = await supabase.storage
        .from('fatture')
        .createSignedUrl(path, 900)
      if (error) throw error
      newTab.location.href = data.signedUrl
    } catch (err) {
      newTab.close()
      alert('Errore apertura quietanza: ' + err.message)
    }
  }

  const handleGeneraQuietanzaFornitore = (fat) => {
    checkWatermark((withWatermark) => {
      const condominio = condomini.find(c => c.id === fat.condominio_id)
      const fornitore = fornitori.find(f => f.id === fat.fornitore_id) || { ragione_sociale: fat.fornitore }
      
      const abb = abbinamenti.find(a => a.fattura_id === fat.id)
      let delega = { data_pagamento: fat.data_pagamento, importo_totale: fat.importo_ritenuta }
      if (abb) {
        const d = f24Deleghe.find(x => x.id === abb.f24_id)
        if (d) delega = d
      }
      
      exportQuietanzaFornitore(condominio, fornitore, [fat], delega, profile, withWatermark)
    })
  }

  function scaricaFileTxt(text, filename) {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = filename
    link.click()
  }

  const toggleSelezionato = (id) => {
    setSelezionatiCbi(prev => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div style={styles.page}>
      <WatermarkModal />
      
      {/* Header */}
      <div style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ background: '#2563eb20', padding: 12, borderRadius: 12 }}>
            <Landmark size={28} color="#60a5fa" />
          </div>
          <div>
            <h1 style={styles.title}>Modulo Fiscale & Adempimenti</h1>
            <p style={styles.subtitle}>Gestione Ritenute d'Acconto, F24 Cumulativi (CBI) e invii telematici Agenzia delle Entrate</p>
          </div>
        </div>
      </div>

      {/* Toolbar Filtri */}
      <div style={styles.toolbar}>
        <div style={{ display: 'flex', gap: 16 }}>
          <div>
            <label style={styles.label}>Anno d'Imposta</label>
            <select value={annoSelezionato} onChange={e => setAnnoSelezionato(e.target.value)} style={styles.select}>
              {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label style={styles.label}>Filtro Condominio</label>
            <select value={condominioSelezionato} onChange={e => setCondominioSelezionato(e.target.value)} style={styles.select}>
              <option value="">Tutti i condomini</option>
              {condomini.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Tabs di Navigazione */}
      <div style={styles.tabsContainer}>
        {[
          { id: 'cu_770', label: 'Certificazione Unica & 770' },
          { id: 'f24', label: 'Modelli F24 in Scadenza' },
          { id: 'quietanze', label: 'Quietanza ai Fornitori' }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTabAttivo(t.id)}
            style={{
              ...styles.tabButton,
              ...(tabAttivo === t.id ? styles.tabButtonActive : {})
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ color: '#94a3b8' }}>Caricamento dati fiscali in corso...</div>
      ) : (
        <>
          {/* TAB 1: CERTIFICAZIONE UNICA & 770 */}
          {tabAttivo === 'cu_770' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              
              {/* Alert Informativo Desktop Telematico */}
              <div style={styles.alertBanner}>
                <AlertTriangle size={20} color="#f59e0b" style={{ flexShrink: 0 }} />
                <div style={{ fontSize: 13.5, color: '#e2e8f0', lineHeight: '1.4' }}>
                  <b>Avviso di Conformità AdE:</b> I file telematici scaricati (.txt da 1900 caratteri) rispettano rigorosamente le specifiche tecniche ministeriali. Prima della trasmissione reale all'Agenzia delle Entrate, è <b>obbligatorio</b> validarli tramite il software <b>Desktop Telematico (moduli di controllo Sogei)</b> per verificare la presenza di anomalie anagrafiche dei percipienti.
                </div>
              </div>

              {Object.keys(datiRaggruppatiCU).length === 0 ? (
                <div style={styles.empty}>
                  Nessun compenso erogato soggetto a ritenuta (fatture pagate) per l'anno e condominio selezionati.
                </div>
              ) : (
                Object.entries(datiRaggruppatiCU).map(([cId, fornitoriMap]) => {
                  const fornitoriList = Object.values(fornitoriMap)
                  const condName = fornitoriList[0]?.condominio?.nome || 'Condominio'
                  
                  return (
                    <div key={cId} style={styles.section}>
                      <div style={styles.sectionHeader}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Building2 size={20} color="#94a3b8" />
                          <h2 style={styles.sectionTitle}>{condName}</h2>
                        </div>
                        <div style={{ display: 'flex', gap: 10 }}>
                          <button onClick={() => handleExportPdfCU(cId)} style={styles.btnAction}>
                            <Download size={14} /> PDF Bozza CU
                          </button>
                          <button onClick={() => handleExportTxtCU(cId)} style={styles.btnActionPrimary}>
                            <FileText size={14} /> Telematico CU (.txt)
                          </button>
                          <button onClick={() => handleExportTxt770(cId)} style={styles.btnActionPrimary}>
                            <FileText size={14} /> Telematico 770 (.txt)
                          </button>
                        </div>
                      </div>
                      
                      <div style={styles.tableContainer}>
                        <table style={styles.table}>
                          <thead>
                            <tr>
                              <th style={styles.th}>Fornitore</th>
                              <th style={styles.th}>P.IVA / CF</th>
                              <th style={styles.th}>Regime</th>
                              <th style={styles.th}>N° Fatt.</th>
                              <th style={{ ...styles.th, textAlign: 'right' }}>Imponibile Lordo</th>
                              <th style={{ ...styles.th, textAlign: 'right' }}>Ritenuta Trattenuta</th>
                            </tr>
                          </thead>
                          <tbody>
                            {fornitoriList.map((fData, i) => (
                              <tr key={i} style={styles.tr}>
                                <td style={styles.td}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <User size={14} color="#64748b" />
                                    <span style={{ fontWeight: 600, color: '#e2e8f0' }}>{fData.fornitore.ragione_sociale}</span>
                                  </div>
                                </td>
                                <td style={styles.td}>
                                  <span style={styles.badge}>{fData.fornitore.codice_fiscale || fData.fornitore.partita_iva || 'MANCANTE'}</span>
                                </td>
                                <td style={styles.td}>
                                  {fData.fornitore.regime_forfettario ? (
                                    <span style={{ ...styles.badge, background: '#10b98120', color: '#10b981' }}>Forfettario (Esente)</span>
                                  ) : (
                                    <span style={{ ...styles.badge, background: '#2563eb20', color: '#60a5fa' }}>Ordinario (Soggetto)</span>
                                  )}
                                </td>
                                <td style={styles.td}>{fData.fatture.length} doc.</td>
                                <td style={{ ...styles.td, textAlign: 'right' }}>€ {fData.totaleImponibile.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</td>
                                <td style={{ ...styles.td, textAlign: 'right', color: fData.totaleRitenute > 0 ? '#f59e0b' : '#64748b', fontWeight: 600 }}>
                                  € {fData.totaleRitenute.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}

          {/* TAB 2: MODELLI F24 IN SCADENZA */}
          {tabAttivo === 'f24' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              
              {/* Esportazione cumulativa CBI */}
              {delegheFiltrare.some(d => d.stato === 'da_pagare') && (
                <div style={styles.massivePanel}>
                  <div style={{ color: '#cbd5e1', fontSize: 14 }}>
                    Seleziona le deleghe "Da Pagare" e scarica la distinta F24 CBI per l'addebito massivo in banca.
                  </div>
                  <button onClick={handleExportMassiveCBI} style={styles.btnActionPrimary}>
                    <FileSpreadsheet size={16} /> Esporta Distinta CBI F24 ({Object.values(selezionatiCbi).filter(Boolean).length} sel.)
                  </button>
                </div>
              )}

              {delegheFiltrare.length === 0 ? (
                <div style={styles.empty}>
                  Nessun modello F24 generato per i filtri selezionati.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {delegheFiltrare.map(delega => {
                    const condo = condomini.find(c => c.id === delega.condominio_id) || { nome: 'Condominio' }
                    const dettagli = tributi.filter(t => t.f24_id === delega.id)
                    const fattureAbbinate = abbinamenti.filter(a => a.f24_id === delega.id)
                    
                    const isDaPagare = delega.stato === 'da_pagare'
                    
                    return (
                      <div key={delega.id} style={{ ...styles.cardF24, borderLeft: `4px solid ${isDaPagare ? '#f59e0b' : '#10b981'}` }}>
                        <div style={styles.cardF24Header}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            {isDaPagare && (
                              <input 
                                type="checkbox" 
                                checked={!!selezionatiCbi[delega.id]} 
                                onChange={() => toggleSelezionato(delega.id)}
                                style={{ width: 18, height: 18, cursor: 'pointer' }}
                              />
                            )}
                            <div>
                              <div style={{ fontWeight: 700, color: '#f8fafc', fontSize: 15 }}>{condo.nome}</div>
                              <div style={{ display: 'flex', gap: 12, marginTop: 4, alignItems: 'center' }}>
                                <span style={styles.dateLabel}>
                                  <Calendar size={12} /> Scadenza: {formattaData(delega.data_scadenza)}
                                </span>
                                {delega.data_pagamento && (
                                  <span style={{ ...styles.dateLabel, color: '#10b981' }}>
                                    <CheckCircle2 size={12} /> Pagato il: {formattaData(delega.data_pagamento)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div style={{ textAlign: 'right' }}>
                            <div style={styles.f24Importo}>€ {delega.importo_totale.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</div>
                            <span style={{ 
                              ...styles.statoBadge, 
                              background: isDaPagare ? '#f59e0b20' : '#10b98120', 
                              color: isDaPagare ? '#f59e0b' : '#10b981' 
                            }}>
                              {isDaPagare ? 'Da pagare' : 'Pagato'}
                            </span>
                          </div>
                        </div>

                        {/* Tributi Interni ed Azioni */}
                        <div style={styles.cardF24Body}>
                          <div>
                            <div style={styles.subTitleF24}>Codici Tributo Associati:</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                              {dettagli.map(t => (
                                <div key={t.id} style={styles.tributoChip}>
                                  <span style={{ fontWeight: 700, color: '#60a5fa' }}>Cod. {t.codice_tributo}</span>
                                  <span style={{ color: '#94a3b8' }}>({String(t.mese_riferimento).padStart(2, '0')}/{t.anno_riferimento})</span>
                                  <span style={{ fontWeight: 600, color: '#f8fafc' }}>€ {t.importo.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>
                                </div>
                              ))}
                            </div>
                            <div style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>
                              Fatture collegate: {fattureAbbinate.length} documenti
                            </div>
                          </div>

                          {/* Upload / Visualizzazione Quietanza */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            {delega.quietanza_url ? (
                              <button onClick={() => visualizzaQuietanza(delega.quietanza_url)} style={styles.btnAction}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><FileText size={14} /> Visualizza Quietanza PDF</span>
                              </button>
                            ) : (
                              <label style={styles.btnUpload}>
                                <Upload size={14} />
                                {f24UploadingId === delega.id ? 'Salvataggio...' : 'Registra Pagamento (Quietanza)'}
                                <input 
                                  type="file" 
                                  accept=".pdf" 
                                  style={{ display: 'none' }}
                                  disabled={f24UploadingId === delega.id}
                                  onChange={(e) => handleUploadQuietanza(delega.id, e.target.files[0])}
                                />
                              </label>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: QUIETANZA AI FORNITORI */}
          {tabAttivo === 'quieta' || tabAttivo === 'quietanze' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {ritenutePagateList.length === 0 ? (
                <div style={styles.empty}>
                  Nessuna ritenuta d'acconto versata (F24 liquidato) nell'anno selezionato.
                </div>
              ) : (
                <div style={styles.section}>
                  <div style={styles.sectionHeader}>
                    <h2 style={styles.sectionTitle}>Certificazioni di Versamento Ritenuta d'Acconto</h2>
                  </div>
                  <div style={styles.tableContainer}>
                    <table style={styles.table}>
                      <thead>
                        <tr>
                          <th style={styles.th}>Fornitore</th>
                          <th style={styles.th}>P.IVA / CF</th>
                          <th style={styles.th}>Fattura</th>
                          <th style={styles.th}>Data Pagamento</th>
                          <th style={{ ...styles.th, textAlign: 'right' }}>Importo Ritenuta</th>
                          <th style={{ ...styles.th, textAlign: 'center' }}>Azione</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ritenutePagateList.map((fat) => {
                          const fName = fat.fornitore
                          const fIva = fat.fornitore_rel?.partita_iva || fat.fornitore_rel?.codice_fiscale || '-'
                          return (
                            <tr key={fat.id} style={styles.tr}>
                              <td style={styles.td}>
                                <span style={{ fontWeight: 600, color: '#e2e8f0' }}>{fName}</span>
                              </td>
                              <td style={styles.td}>
                                <span style={styles.badge}>{fIva}</span>
                              </td>
                              <td style={styles.td}>N° {fat.numero_fattura || '-'} del {formattaData(fat.data_fattura)}</td>
                              <td style={styles.td}>{formattaData(fat.data_pagamento)}</td>
                              <td style={{ ...styles.td, textAlign: 'right', fontWeight: 600, color: '#10b981' }}>
                                € {parseFloat(fat.importo_ritenuta || fat.ritenuta_acconto || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                              </td>
                              <td style={{ ...styles.td, textAlign: 'center' }}>
                                <button onClick={() => handleGeneraQuietanzaFornitore(fat)} style={styles.btnAction}>
                                  <Download size={13} /> Scarica Ricevuta PDF
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

const styles = {
  page: { padding: '28px 32px', background: '#0f172a', minHeight: '100vh', fontFamily: 'Sora, sans-serif' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  title: { color: '#f8fafc', fontSize: 24, fontWeight: 700, margin: 0 },
  subtitle: { color: '#94a3b8', fontSize: 14, marginTop: 4 },
  toolbar: { display: 'flex', gap: 16, marginBottom: 24, background: '#1e293b', padding: '16px 20px', borderRadius: 12, border: '1px solid #334155' },
  label: { display: 'block', color: '#94a3b8', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 },
  select: { background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '8px 12px', color: '#f8fafc', fontFamily: 'Sora, sans-serif', fontSize: 14, outline: 'none' },
  tabsContainer: { display: 'flex', gap: 8, borderBottom: '1px solid #1e293b', paddingBottom: 12, marginBottom: 24 },
  tabButton: { background: 'none', border: 'none', color: '#64748b', fontSize: 14, fontWeight: 600, padding: '8px 16px', cursor: 'pointer', borderRadius: 6, transition: 'all 0.2s', fontFamily: 'Sora, sans-serif' },
  tabButtonActive: { background: '#1e293b', color: '#f8fafc', border: '1px solid #334155' },
  alertBanner: { display: 'flex', gap: 12, alignItems: 'center', background: '#f59e0b15', border: '1px solid #f59e0b30', padding: '14px 18px', borderRadius: 10 },
  empty: { background: '#1e293b', border: '1px dashed #334155', borderRadius: 12, padding: 40, textAlign: 'center', color: '#64748b' },
  section: { background: '#1e293b', borderRadius: 12, border: '1px solid #334155', overflow: 'hidden' },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #334155', background: '#0f172a' },
  sectionTitle: { color: '#e2e8f0', fontSize: 15, fontWeight: 600, margin: 0 },
  btnAction: { display: 'flex', alignItems: 'center', gap: 6, background: '#1e293b', color: '#f8fafc', border: '1px solid #475569', borderRadius: 6, padding: '6px 12px', fontSize: 13, cursor: 'pointer', fontWeight: 600, fontFamily: 'Sora, sans-serif' },
  btnActionPrimary: { display: 'flex', alignItems: 'center', gap: 6, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 13, cursor: 'pointer', fontWeight: 700, fontFamily: 'Sora, sans-serif' },
  tableContainer: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13.5 },
  th: { padding: '12px 20px', textAlign: 'left', color: '#94a3b8', fontWeight: 600, fontSize: 11.5, textTransform: 'uppercase', borderBottom: '1px solid #334155' },
  td: { padding: '12px 20px', borderBottom: '1px solid #334155', color: '#cbd5e1' },
  tr: { transition: 'background 0.2s', borderBottom: '1px solid #1e293b' },
  badge: { background: '#334155', color: '#e2e8f0', padding: '4px 8px', borderRadius: 4, fontSize: 11.5, fontFamily: 'monospace' },
  massivePanel: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#1e293b', border: '1px solid #334155', padding: '14px 20px', borderRadius: 10 },
  cardF24: { background: '#1e293b', border: '1px solid #334155', borderRadius: 10, padding: 18, transition: 'all 0.2s' },
  cardF24Header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  dateLabel: { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12.5, color: '#94a3b8' },
  f24Importo: { fontSize: 19, fontWeight: 800, color: '#f8fafc' },
  statoBadge: { borderRadius: 20, padding: '3px 12px', fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase', display: 'inline-block', marginTop: 4 },
  cardF24Body: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 14, paddingTop: 14, borderTop: '1px solid #334155' },
  subTitleF24: { fontSize: 12, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' },
  tributoChip: { display: 'inline-flex', alignItems: 'center', gap: 6, background: '#0f172a', border: '1px solid #334155', borderRadius: 20, padding: '4px 12px', fontSize: 12 },
  btnUpload: { display: 'inline-flex', alignItems: 'center', gap: 6, background: '#2563eb', color: '#fff', borderRadius: 6, padding: '6px 12px', fontSize: 13, cursor: 'pointer', fontWeight: 700, fontFamily: 'Sora, sans-serif' }
}
