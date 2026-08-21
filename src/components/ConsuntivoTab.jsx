// src/components/ConsuntivoTab.jsx
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useConsuntivo } from '../hooks/useConsuntivo'
import { useUnita } from '../hooks/useUnita'
import { useMillesimi } from '../hooks/useMillesimi'
import { estraiStrutturaConsuntivo, generaNotaSinteticaAi } from '../lib/fileExtractor'
import { exportConsuntivoPdf } from '../lib/exportConsuntivo'
import { exportDossierRendiconto } from '../lib/exportDossier'
import { exportConsuntivoXlsx } from '../lib/exportXlsx'
import { useWatermark } from '../hooks/useWatermark'
import PlanGate from './PlanGate'
import ModelloConsuntivoModal from './ModelloConsuntivoModal'
import WizardChiusuraEsercizio from './WizardChiusuraEsercizio'
import { FileText, Upload, Download, RefreshCw, CheckCircle2, AlertTriangle, AlertCircle, Zap, Flame, Sparkles, Archive, FileCheck, Receipt, Landmark, Send, Bot, Lock } from 'lucide-react'

const eur = (n) => '€ ' + (Number(n) || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const sgn = (n) => (Number(n) < 0 ? '-' : '') + '€ ' + Math.abs(Number(n) || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })
const formattaData = (d) => (d && !isNaN(new Date(d).getTime()) ? new Date(d).toLocaleDateString('it-IT') : '—')

export default function ConsuntivoTab({ condominioId, esercizioId: esercizioIdProp, esercizioAttivo, onSelectEsercizio }) {
  const [condominio, setCondominio] = useState(null)
  const [esercizi, setEsercizi] = useState([])
  const [esercizioId, setEsercizioId] = useState(esercizioIdProp || null)
  const [tabellaMillId, setTabellaMillId] = useState(null)
  const [uploadingTpl, setUploadingTpl] = useState(false)
  const [tplMsg, setTplMsg] = useState('')
  
  // Modale Selezione Modello
  const [strutturaEstratta, setStrutturaEstratta] = useState(null)
  const [fileNomeCaricato, setFileNomeCaricato] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [savingModello, setSavingModello] = useState(false)

  // Export Dossier ZIP
  const [exportingZip, setExportingZip] = useState(false)
  const [zipMsg, setZipMsg] = useState('')
  const [loadingAiNote, setLoadingAiNote] = useState(false)
  const [notaSinteticaCustom, setNotaSinteticaCustom] = useState('')

  const { data, template, loading, error, fetch, setTemplate } = useConsuntivo(condominioId, esercizioId)
  const { unita, getProprietario } = useUnita(condominioId)
  const { tabelle, getMillesimiUnita, getTotaleTabella } = useMillesimi(condominioId)
  const { WatermarkModal, checkWatermark } = useWatermark()
  const [wizardOpen, setWizardOpen] = useState(false)

  const handleGeneraNotaSinteticaAi = async () => {
    if (!condominio || !data?.esercizio) return
    setLoadingAiNote(true)
    try {
      const nota = await generaNotaSinteticaAi({
        condominio,
        esercizio: data.esercizio,
        spese: data.speseRaw || [],
        rate: data.rateRaw || [],
        attivitaStudio: data.attivitaStudio || {}
      })
      setNotaSinteticaCustom(nota)
    } catch (errNote) {
      alert('Errore generazione Nota Sintetica AI: ' + errNote.message)
    } finally {
      setLoadingAiNote(false)
    }
  }

  useEffect(() => {
    if (esercizioIdProp && esercizioIdProp !== esercizioId) {
      setEsercizioId(esercizioIdProp)
    }
  }, [esercizioIdProp])

  useEffect(() => {
    if (condominioId) {
      supabase.from('condomini').select('*').eq('id', condominioId).single().then(({ data }) => setCondominio(data))
      supabase.from('esercizi').select('*').eq('condominio_id', condominioId).order('anno', { ascending: false }).then(({ data }) => {
        const lista = data || []
        setEsercizi(lista)
        if (esercizioIdProp) {
          setEsercizioId(esercizioIdProp)
        } else if (lista.length) {
          const active = lista.find(e => e.stato === 'aperto') || lista[0]
          setEsercizioId(active.id)
        }
      })
    }
  }, [condominioId, esercizioIdProp])

  useEffect(() => {
    if (esercizioId) {
      fetch()
    }
  }, [esercizioId, fetch])

  useEffect(() => {
    if (tabelle?.length && !tabellaMillId) {
      setTabellaMillId(tabelle[0].id)
    }
  }, [tabelle])

  async function onTemplateFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingTpl(true)
    setTplMsg('Analisi modello con AI in corso…')
    try {
      const struttura = await estraiStrutturaConsuntivo(file)
      if (!struttura) throw new Error("Impossibile analizzare il file selezionato.")
      setStrutturaEstratta(struttura)
      setFileNomeCaricato(file.name)
      setIsModalOpen(true)
      setTplMsg('')
    } catch (err) {
      setTplMsg('Errore: ' + err.message)
    } finally {
      setUploadingTpl(false)
      e.target.value = ''
    }
  }

  async function handleSelectModello(tipoModello, datiStruttura) {
    setSavingModello(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Utente non autenticato")

      await supabase.from('consuntivo_template').update({ attivo: false }).eq('amministratore_id', user.id)

      const strutturaFinale = {
        ...(datiStruttura || {}),
        tipo_modello: tipoModello,
      }

      const { error: e1 } = await supabase.from('consuntivo_template').insert({
        amministratore_id: user.id,
        nome: fileNomeCaricato || 'Modello Amministratore',
        struttura: strutturaFinale,
        attivo: true,
      })
      if (e1) throw e1

      setTplMsg(`Modello ${(tipoModello === 'condofast' || tipoModello === 'condosmart') ? 'Proposto da CondoFAST' : 'Identico'} applicato con successo!`)
      setIsModalOpen(false)
      await fetch()
      setTimeout(() => setTplMsg(''), 4000)
    } catch (err) {
      setTplMsg('Errore salvataggio modello: ' + err.message)
    } finally {
      setSavingModello(false)
    }
  }

  async function scaricaPdf() {
    if (!data) return
    checkWatermark((withWatermark) => {
      exportConsuntivoPdf({
        condominio, consuntivo: data, template, unita, getProprietario,
        getMillesimiUnita, getTotaleTabella, tabellaMillId, withWatermark
      }).catch(err => {
        setTplMsg('Errore generazione PDF: ' + err.message)
        setTimeout(() => setTplMsg(''), 5000)
      })
    })
  }

  const [exportingXls, setExportingXls] = useState(false)
  async function scaricaXls() {
    if (!data) return
    setExportingXls(true)
    try {
      await exportConsuntivoXlsx({
        condominio, consuntivo: data, template, unita, getProprietario,
        getMillesimiUnita, tabellaMillId
      })
      setTplMsg('Excel scaricato con successo!')
      setTimeout(() => setTplMsg(''), 4000)
    } catch (err) {
      setTplMsg('Errore generazione Excel: ' + err.message)
      setTimeout(() => setTplMsg(''), 5000)
    } finally {
      setExportingXls(false)
    }
  }

  async function scaricaDossierZip() {
    if (!data) return
    setExportingZip(true)
    setZipMsg('Avvio generazione Dossier ZIP…')
    checkWatermark((withWatermark) => {
      exportDossierRendiconto({
        condominio,
        consuntivo: data,
        template,
        unita,
        getProprietario,
        getMillesimiUnita,
        getTotaleTabella,
        tabellaMillId,
        withWatermark,
        onProgress: (p) => setZipMsg(p.messaggio || 'Pacchettizzazione ZIP…'),
      }).then(() => {
        setTplMsg('Dossier Completo (.zip) scaricato con successo!')
        setTimeout(() => setTplMsg(''), 4000)
      }).catch(err => {
        setTplMsg('Errore generazione Dossier ZIP: ' + err.message)
        setTimeout(() => setTplMsg(''), 5000)
      }).finally(() => {
        setExportingZip(false)
        setZipMsg('')
      })
    })
  }

  if (!esercizioId) return <div style={st.empty}>Nessun esercizio contabile.</div>

  return (
    <div>
      <WatermarkModal />
      <ModelloConsuntivoModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        fileNome={fileNomeCaricato}
        struttura={strutturaEstratta}
        onConfirm={handleSelectModello}
        loading={savingModello}
      />
      <WizardChiusuraEsercizio
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        condominioId={condominioId}
        esercizioId={esercizioId}
        onSuccess={() => {
          fetch()
          setTplMsg('Esercizio chiuso con successo.')
        }}
        hideTrigger={true}
        onDownloadPdf={scaricaPdf}
        onDownloadDossier={scaricaDossierZip}
        onDownloadXls={scaricaXls}
      />

      {/* Toolbar */}
      <div style={st.toolbar}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {esercizi.map(es => (
            <button
              key={es.id}
              onClick={() => {
                setEsercizioId(es.id)
                if (onSelectEsercizio) onSelectEsercizio(es.id)
              }}
              style={st.esBtn(esercizioId === es.id)}
            >
              {es.anno}<span style={st.esTag(es.stato === 'aperto')}>{es.stato}</span>
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {tabelle.length > 0 && (
            <select value={tabellaMillId || ''} onChange={e => setTabellaMillId(e.target.value)} style={st.select} title="Tabella millesimi per il riparto">
              {tabelle.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          )}
          <label style={st.btnGhost}>
            <Upload size={14} /> {uploadingTpl ? 'Analisi AI…' : 'Carica modello'}
            <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx,.xls,.txt" style={{ display: 'none' }} onChange={onTemplateFile} disabled={uploadingTpl} />
          </label>
          <button style={st.btnGhost} onClick={fetch}><RefreshCw size={14} /> Ricalcola</button>
          <button style={st.btnGhost} onClick={scaricaDossierZip} disabled={!data || exportingZip} title="Scarica consuntivo, estratti conto e tutte le fatture in un unico archivio ZIP">
            <Archive size={14} color="#60a5fa" /> {exportingZip ? (zipMsg || 'Dossier…') : 'Dossier Completo (.zip)'}
          </button>
          <button style={st.btnGhost} onClick={scaricaXls} disabled={!data || exportingXls} title="Scarica il consuntivo in formato Excel">
            <Download size={14} color="#10b981" /> {exportingXls ? 'Esportazione...' : 'Scarica Excel'}
          </button>
          <PlanGate feature="rendiconto_pdf" compact>
            <button style={st.btnPrimary} onClick={scaricaPdf} disabled={!data} title="Genera il consuntivo impaginato in PDF">
              <Download size={14} /> Esporta PDF
            </button>
          </PlanGate>
          <button style={st.btnSuccess} onClick={() => setWizardOpen(true)} disabled={!data}>
            <Lock size={14} /> Chiudi Esercizio
          </button>
        </div>
      </div>

      {tplMsg && (
        <div style={{ ...st.msg, display: 'flex', alignItems: 'center', gap: 6 }}>
          {tplMsg.includes('Errore') ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
          <span>{tplMsg}</span>
        </div>
      )}
      {error && (
        <div style={{ ...st.err, display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertCircle size={14} style={{ flexShrink: 0 }} /> <span>{error}</span>
        </div>
      )}
      {loading && <div style={st.empty}>Calcolo consuntivo…</div>}

      {data && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Banner template */}
          <div style={st.tplBanner}>
            {(template?.tipo_modello === 'condofast' || template?.tipo_modello === 'condosmart') ? (
              <Sparkles size={15} color="#60a5fa" />
            ) : (
              <FileText size={15} color="#60a5fa" />
            )}
            <span>
              Modello attivo: <b>{(template?.tipo_modello === 'condofast' || template?.tipo_modello === 'condosmart') ? 'Modello Proposto da CondoFAST (Standard Art. 1130-bis c.c.)' : (template?.nome ? `Modello Identico (da ${template.nome})` : 'Standard CondoFAST')}</b> · presenta le sezioni ed etichette contabili selezionate.
            </span>
          </div>

          {/* A/B competenza */}
          <Card title="A — Rendiconto di competenza">
            <Table head={['Categoria', 'Tipo', 'Importo']}
              rows={[
                ...(() => {
                  const ord = template?.ordine_categorie || Object.keys(data.competenza.catMap)
                  return [...ord, ...Object.keys(data.competenza.catMap).filter(k => !ord.includes(k))]
                })()
                  .filter(k => data.competenza.catMap[k])
                  .map(k => {
                    const v = data.competenza.catMap[k]
                    const tot = v.ordinaria + v.straordinaria
                    return tot ? [template?.etichette_categorie?.[k] || k.toUpperCase(), v.straordinaria > 0 ? 'straordinaria' : 'ordinaria', eur(tot)] : null
                  }).filter(Boolean),
              ]}
              foot={[
                ['Totale ordinario', '', eur(data.competenza.totOrd)],
                ['Totale straordinario', '', eur(data.competenza.totStr)],
                ['TOTALE CONSUNTIVO', '', eur(data.competenza.totSpese)],
              ]} alignRight={[2]} />
          </Card>

          {/* C riparto */}
          <Card title="C — Riparto per unità">
            <Table head={['Unità', 'Proprietario', 'Mill.', 'Dovuto', 'Versato', 'Saldo iniz.', 'Conguaglio', 'Arretrati']}
              rows={(unita || []).map(u => {
                const r = data.riparto.unitaRows.find(x => x.unita_id === u.id) || { dovuto: 0, versato: 0, saldoIniz: 0, conguaglio: 0, arretrati: 0 }
                const p = getProprietario ? getProprietario(u) : null
                const mill = getMillesimiUnita ? getMillesimiUnita(tabellaMillId, u.id) : ''
                return [`U.${u.numero}`, p ? `${p.cognome || ''} ${p.nome || ''}`.trim() : '', mill ? Number(mill).toFixed(2) : '',
                  eur(r.dovuto), eur(r.versato), sgn(r.saldoIniz), sgn(r.conguaglio), eur(r.arretrati)]
              })}
              foot={[['TOTALI', '', '', eur(data.riparto.tot.dovuto), eur(data.riparto.tot.versato), sgn(data.riparto.tot.saldoIniz), sgn(data.riparto.tot.conguaglio), eur(data.riparto.tot.arretrati)]]}
              alignRight={[3, 4, 5, 6, 7]} congCol={6} />
            <p style={st.note}>(*) Saldo/conguaglio negativo = debito verso il Condominio; positivo = credito al condomino.</p>
          </Card>

          {/* D cassa */}
          <Card title="D — Situazione di cassa">
            {(() => {
              const isQuadraturaOk = Math.abs(data.cassa.scartoQuadratura || 0) <= 0.02;
              return (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: isQuadraturaOk ? '#10b98115' : '#f59e0b15',
                  border: isQuadraturaOk ? '1px solid #10b98130' : '1px solid #f59e0b30',
                  borderRadius: 10, padding: '10px 14px', marginBottom: 12, flexWrap: 'wrap', gap: 8
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {isQuadraturaOk ? (
                      <CheckCircle2 size={16} color="#10b981" />
                    ) : (
                      <AlertTriangle size={16} color="#f59e0b" />
                    )}
                    <span style={{ fontSize: 13, fontWeight: 700, color: isQuadraturaOk ? '#10b981' : '#d97706' }}>
                      {isQuadraturaOk ? '✓ Pareggio di Cassa Verificato al Centesimo' : '⚠️ Scarto di Quadratura da Verificare'}
                    </span>
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Saldo Iniziale ({eur(data.cassa.saldoInizCassa)}) + Entrate ({eur(data.cassa.entrate)}) − Uscite ({eur(data.cassa.uscite)}) = {eur(data.cassa.saldoFinaleCassa)}
                  </span>
                </div>
              );
            })()}
            <Table head={['Voce', 'Importo']} alignRight={[1]}
              rows={[
                ['Saldo cassa iniziale', eur(data.cassa.saldoInizCassa)],
                ['Entrate periodo', eur(data.cassa.entrate)],
                ['Uscite periodo', data.cassa.uscite > 0 ? ('-' + eur(data.cassa.uscite)) : eur(0)],
                ['Saldo cassa finale', sgn(data.cassa.saldoFinaleCassa)],
                ['Risultato di competenza (versato − spese)', sgn(data.cassa.saldoCompetenza)],
                ['Quadratura competenza ↔ cassa', sgn(data.cassa.scartoQuadratura)],
              ]} />
            <p style={st.note}>Il fondo di riserva non è gestito automaticamente; va riportato a mano se presente.</p>
          </Card>

          {/* E fatture */}
          {data.fatture.rows.length > 0 && (
            <Card title="E — Situazione fatture">
              <Table head={['Fornitore', 'N°', 'Data', 'Importo', 'Stato', 'Ritenuta/F24']} alignRight={[3]}
                rows={data.fatture.rows.map(f => [f.fornitore, f.numero_fattura || '—',
                  f.data_fattura ? formattaData(f.data_fattura) : '', eur(f.importo_totale), f.stato, f.ritenutaBadge || '—'])}
                foot={[['TOTALE', '', '', eur(data.fatture.tot.totale), `pagate ${eur(data.fatture.tot.pagate)}`, data.fatture.tot.attesaF24 ? `${data.fatture.tot.attesaF24} att. F24` : '']]} />
            </Card>
          )}

          {/* confronto */}
          {data.confronto.rows.length > 0 && (
            <Card title="Confronto Preventivo / Consuntivo">
              <Table head={['Categoria', 'Preventivo', 'Consuntivo', 'Differenza']} alignRight={[1, 2, 3]}
                rows={data.confronto.rows.map(r => [template?.etichette_categorie?.[r.categoria] || r.categoria.toUpperCase(), eur(r.preventivo), eur(r.consuntivo), sgn(r.differenza)])}
                foot={[['TOTALE', eur(data.confronto.tot.preventivo), eur(data.confronto.tot.consuntivo), sgn(data.confronto.tot.differenza)]]} />
            </Card>
          )}

          {/* Analisi Storica & Consumi Energetici */}
          {data.storico && (
            <Card title="Analisi Storica & Consumi Energetici">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 4 }}>
                <div style={st.statBox}>
                  <div style={{ ...st.statLabel, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Zap size={14} color="var(--primary)" /> ENERGIA ELETTRICA
                  </div>
                  <div style={st.statValue}>{eur(data.storico.energia.corrente)}</div>
                  {data.storico.haPrecedente ? (
                    <div style={st.statSub}>
                      <span>Prec. ({data.storico.annoPrecedente}): <b>{eur(data.storico.energia.precedente)}</b></span>
                      <span style={st.badge(data.storico.energia.variazione)}>
                        {data.storico.energia.variazione >= 0 ? '+' : ''}{data.storico.energia.variazione}%
                      </span>
                    </div>
                  ) : (
                    <div style={st.statSub}>Nessun dato storico per il confronto</div>
                  )}
                </div>

                <div style={st.statBox}>
                  <div style={{ ...st.statLabel, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Flame size={14} color="#f59e0b" /> RISCALDAMENTO & GAS
                  </div>
                  <div style={st.statValue}>{eur(data.storico.riscaldamento.corrente)}</div>
                  {data.storico.haPrecedente ? (
                    <div style={st.statSub}>
                      <span>Prec. ({data.storico.annoPrecedente}): <b>{eur(data.storico.riscaldamento.precedente)}</b></span>
                      <span style={st.badge(data.storico.riscaldamento.variazione)}>
                        {data.storico.riscaldamento.variazione >= 0 ? '+' : ''}{data.storico.riscaldamento.variazione}%
                      </span>
                    </div>
                  ) : (
                    <div style={st.statSub}>Nessun dato storico per il confronto</div>
                  )}
                </div>
              </div>
            </Card>
          )}

          {/* Riepilogo Attività & Gestione Studio (Pro-Admin) */}
          {data.attivitaStudio && (
            <Card title="Riepilogo Attività & Gestione Studio">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
                <div style={st.statBox}>
                  <div style={{ ...st.statLabel, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <FileCheck size={14} color="#60a5fa" /> FATTURE & SPESE
                  </div>
                  <div style={st.statValue}>{data.attivitaStudio.fattureElaborate || 0}</div>
                  <div style={st.statSub}>Documenti lavorati e registrati</div>
                </div>

                <div style={st.statBox}>
                  <div style={{ ...st.statLabel, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Receipt size={14} color="#10b981" /> RITENUTE & F24
                  </div>
                  <div style={st.statValue}>{data.attivitaStudio.ritenuteGestite || 0}</div>
                  <div style={st.statSub}>Pratiche fiscali elaborate</div>
                </div>

                <div style={st.statBox}>
                  <div style={{ ...st.statLabel, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Landmark size={14} color="#a855f7" /> RICONCILIAZIONI
                  </div>
                  <div style={st.statValue}>{data.attivitaStudio.movimentiRiconciliati || 0}</div>
                  <div style={st.statSub}>Movimenti bancari abbinati</div>
                </div>

                <div style={st.statBox}>
                  <div style={{ ...st.statLabel, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Send size={14} color="#f59e0b" /> COMUNICAZIONI
                  </div>
                  <div style={st.statValue}>{data.attivitaStudio.comunicazioniInviate || 0}</div>
                  <div style={st.statSub}>Invii e solleciti registrati</div>
                </div>
              </div>
            </Card>
          )}

          {/* Nota sintetica (art. 1130-bis c.c.) */}
          <Card title="Nota sintetica esplicativa (art. 1130-bis c.c.)">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Relazione formale ex art. 1130-bis c.c. a tutela dell'operato dell'amministratore</span>
              <button 
                onClick={handleGeneraNotaSinteticaAi} 
                disabled={loadingAiNote}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '6px 12px',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'Sora, sans-serif'
                }}
              >
                <Bot size={14} />
                {loadingAiNote ? 'Generazione AI in corso...' : 'Genera Nota Sintetica con AI'}
              </button>
            </div>

            {notaSinteticaCustom ? (
              <textarea 
                value={notaSinteticaCustom}
                onChange={(e) => setNotaSinteticaCustom(e.target.value)}
                style={{
                  width: '100%',
                  minHeight: 180,
                  background: 'var(--app-bg)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 8,
                  padding: 12,
                  color: 'var(--text-primary)',
                  fontSize: 12.5,
                  lineHeight: 1.5,
                  fontFamily: 'Sora, sans-serif',
                  resize: 'vertical'
                }}
              />
            ) : (
              <p style={{ ...st.note, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                {(() => {
                  const diff = data.confronto.tot.differenza
                  const saldo = data.cassa.saldoFinaleCassa
                  const quadr = data.cassa.scartoQuadratura
                  return (
                    <>
                      L'esercizio chiude con un totale spese di competenza pari a {eur(data.competenza.totSpese)}
                      {data.competenza.totStr > 0 && <>, di cui {eur(data.competenza.totStr)} per gestione straordinaria</>}.
                      {' '}Rispetto al preventivo di {eur(data.confronto.tot.preventivo)}, si registra
                      {diff >= 0
                        ? <> un <b style={{ color: '#10b981' }}>avanzo di {eur(Math.abs(diff))}</b> (speso meno del previsto)</>
                        : <> un <b style={{ color: '#ef4444' }}>disavanzo di {eur(Math.abs(diff))}</b> (speso più del previsto)</>}.
                      {' '}Il saldo di cassa finale ammonta a {sgn(saldo)}.
                      {Math.abs(quadr) < 0.01
                        ? <> La quadratura competenza-cassa è <b style={{ color: '#10b981' }}>verificata</b> (scarto nullo).</>
                        : <> Lo scarto di quadratura competenza-cassa è pari a {sgn(quadr)}, dovuto a movimenti non ancora riconciliati.</>}
                    </>
                  )
                })()}
              </p>
            )}
          </Card>
        </div>
      )}
    </div>
  )
}

function Card({ title, children }) {
  return (
    <div style={st.card}>
      <div style={st.cardTitle}>{title}</div>
      {children}
    </div>
  )
}
function Table({ head, rows, foot = [], alignRight = [], congCol = -1 }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={st.table}>
        <thead><tr>{head.map((h, i) => <th key={i} style={{ ...st.th, textAlign: alignRight.includes(i) ? 'right' : 'left' }}>{h}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri}>{r.map((c, ci) => {
              let color = 'var(--text-primary)'
              if (ci === congCol) color = String(c).includes('-') ? '#ef4444' : (c !== '€ 0,00' ? '#10b981' : 'var(--text-primary)')
              return <td key={ci} style={{ ...st.td, textAlign: alignRight.includes(ci) ? 'right' : 'left', color }}>{c}</td>
            })}</tr>
          ))}
          {foot.map((r, ri) => (
            <tr key={'f' + ri}>{r.map((c, ci) => <td key={ci} style={{ ...st.td, ...st.footTd, textAlign: alignRight.includes(ci) ? 'right' : 'left' }}>{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const st = {
  toolbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' },
  select: { background: 'var(--app-bg)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '7px 10px', fontFamily: 'Sora, sans-serif', fontSize: 13 },
  btnGhost: { display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Sora, sans-serif' },
  btnPrimary: { display: 'inline-flex', alignItems: 'center', gap: 6, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Sora, sans-serif' },
  esBtn: (a) => ({ padding: '6px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer', border: `1px solid ${a ? '#2563eb' : 'var(--border-color)'}`, background: a ? 'rgba(37,99,235,0.15)' : 'transparent', color: a ? '#60a5fa' : '#64748b', fontFamily: 'Sora, sans-serif', fontWeight: a ? 600 : 400 }),
  esTag: (ap) => ({ marginLeft: 6, fontSize: 10, padding: '1px 6px', borderRadius: 4, background: ap ? '#10b98122' : '#64748b22', color: ap ? '#10b981' : '#64748b' }),
  msg: { background: '#1e3a5f', color: '#93c5fd', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 12 },
  err: { background: '#ef444415', border: '1px solid #ef444440', borderRadius: 8, padding: '10px 14px', color: '#ef4444', fontSize: 13, marginBottom: 12 },
  empty: { textAlign: 'center', padding: 40, color: 'var(--text-muted)', background: 'var(--card-bg)', borderRadius: 12, border: '1px solid var(--border-color)' },
  tplBanner: { display: 'flex', alignItems: 'center', gap: 8, background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 10, padding: '10px 14px', color: 'var(--text-secondary)', fontSize: 12.5 },
  card: { background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 18 },
  cardTitle: { color: '#60a5fa', fontWeight: 700, fontSize: 14, marginBottom: 12, fontFamily: 'Sora, sans-serif' },
  table: { borderCollapse: 'collapse', width: '100%', fontFamily: 'Sora, sans-serif', fontSize: 13 },
  th: { color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', padding: '8px 10px', borderBottom: '1px solid var(--border-color)', whiteSpace: 'nowrap' },
  td: { padding: '8px 10px', borderBottom: '1px solid var(--border-color-2)', whiteSpace: 'nowrap' },
  footTd: { fontWeight: 700, color: 'var(--text-primary)', background: 'var(--app-bg)', borderTop: '1px solid var(--border-color)' },
  note: { color: 'var(--text-muted)', fontSize: 11.5, marginTop: 8 },
  statBox: { background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 6 },
  statLabel: { fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.05em' },
  statValue: { fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' },
  statSub: { fontSize: 11, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  badge: (v) => ({ fontSize: 11, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: v <= 0 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', color: v <= 0 ? '#10b981' : '#ef4444' }),
}