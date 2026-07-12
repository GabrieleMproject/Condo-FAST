// src/pages/AnagraficaPage.jsx
import { useState, useMemo, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useUnita } from '../hooks/useUnita'
import { usePersone } from '../hooks/usePersone'
import AnagraficaImport from '../components/AnagraficaImport'
import UnitaForm from '../components/UnitaForm'
import PersonaForm from '../components/PersonaForm'
import { supabase } from '../lib/supabaseClient'
import { Search, Edit, X, Building2, ChevronDown, ChevronUp, Mail, Phone, Home, UserCog, Clock, Plus, Key, Trash2 } from 'lucide-react'
import StoricoOccupantiModal from '../components/StoricoOccupantiModal'

// ── Badge tipo unità (per visualizzazione condominio singolo) ──────────────
const TIPO_COLORS = {
  appartamento: { bg: '#1d3557', text: '#60a5fa', label: 'Appartamento' },
  box:          { bg: '#1a2e1a', text: '#4ade80', label: 'Box' },
  cantina:      { bg: '#2d1f0e', text: '#fb923c', label: 'Cantina' },
  negozio:      { bg: '#2d1b2e', text: '#c084fc', label: 'Negozio' },
  ufficio:      { bg: '#1a2535', text: '#38bdf8', label: 'Ufficio' },
  altro:        { bg: '#1e293b', text: '#94a3b8', label: 'Altro' },
}

const RUOLO_ICON = { proprietario: Home, inquilino: Key }

function TipoBadge({ tipo }) {
  const c = TIPO_COLORS[tipo] || TIPO_COLORS.altro
  return (
    <span style={{ background: c.bg, color: c.text, fontSize: 11, fontWeight: 600,
      padding: '2px 8px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      {c.label}
    </span>
  )
}

function PersonaChip({ persona, ruolo }) {
  if (!persona) return <span style={{ color: 'var(--text-muted)', fontSize: 12, fontStyle: 'italic' }}>—</span>
  const Icon = RUOLO_ICON[ruolo]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {Icon && <Icon size={14} style={{ color: ruolo === 'proprietario' ? '#3b82f6' : '#f59e0b' }} />}
      <div style={{ textAlign: 'left' }}>
        <div style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 500 }}>
          {persona.cognome} {persona.nome}
        </div>
        {persona.email && <div style={{ color: '#60a5fa', fontSize: 11 }}>{persona.email}</div>}
        {persona.telefono && <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>{persona.telefono}</div>}
      </div>
    </div>
  )
}

export default function AnagraficaPage() {
  const { condominioId } = useParams()

  // Hook per condominio singolo (retrocompatibilità)
  const { unita, loading: loadingUnita, fetchUnita, createUnita, updateUnita, deleteUnita, getProprietario, getInquilino } = useUnita(condominioId)
  const { importPersone, assegnaPersona, createPersona } = usePersone()

  const [search, setSearch]           = useState('')
  const [filterTipo, setFilterTipo]   = useState('tutti')
  const [showImport, setShowImport]   = useState(false)
  const [showUnitaForm, setShowUnitaForm] = useState(false)
  const [editUnita, setEditUnita]     = useState(null)
  const [showPersonaForm, setShowPersonaForm] = useState(null) // { unitaId, ruolo }
  const [expandedRow, setExpandedRow] = useState(null)
  const [toast, setToast]             = useState(null)
  const [storicoModal, setStoricoModal] = useState(null) // { unita, ruolo }

  // ── STATI MODALITÀ GLOBALE MULTI-CONDOMINIO ──────────────────────────────
  const [condomini, setCondomini] = useState([])
  const [persone, setPersone] = useState([])
  const [loadingGlobal, setLoadingGlobal] = useState(false)
  const [searchGlobal, setSearchGlobal] = useState('')
  const [condominiEspansi, setCondominiEspansi] = useState({})
  
  // Modale editing anagrafica globale
  const [editingPersona, setEditingPersona] = useState(null)
  const [editNome, setEditNome] = useState('')
  const [editCognome, setEditCognome] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editTelefono, setEditTelefono] = useState('')
  const [editIndirizzo, setEditIndirizzo] = useState('')
  const [editCitta, setEditCitta] = useState('')
  const [salvandoAnagrafica, setSalvandoAnagrafica] = useState(false)
  
  // Stati per la modale di creazione manuale globale
  const [showNuovoModal, setShowNuovoModal] = useState(false)
  const [nuovoNome, setNuovoNome] = useState('')
  const [nuovoCognome, setNuovoCognome] = useState('')
  const [nuovoEmail, setNuovoEmail] = useState('')
  const [nuovoTelefono, setNuovoTelefono] = useState('')
  const [nuovoTelefonoAlt, setNuovoTelefonoAlt] = useState('')
  const [nuovoIndirizzo, setNuovoIndirizzo] = useState('')
  const [nuovoCitta, setNuovoCitta] = useState('')
  const [nuovoCap, setNuovoCap] = useState('')
  const [nuovoProvincia, setNuovoProvincia] = useState('')
  const [nuovoCf, setNuovoCf] = useState('')
  const [nuovoDataNascita, setNuovoDataNascita] = useState('')
  const [nuovoNote, setNuovoNote] = useState('')
  const [nuovoCondominioId, setNuovoCondominioId] = useState('')
  const [nuovoUnitaId, setNuovoUnitaId] = useState('')
  const [nuovoRuolo, setNuovoRuolo] = useState('proprietario')
  const [salvandoNuovo, setSalvandoNuovo] = useState(false)
  const [unitaList, setUnitaList] = useState([])

  useEffect(() => {
    const caricaUnitaPerCondo = async () => {
      if (!nuovoCondominioId) {
        setUnitaList([])
        setNuovoUnitaId('')
        return
      }
      try {
        const { data, error } = await supabase
          .from('unita')
          .select('id, numero, scala, piano')
          .eq('condominio_id', nuovoCondominioId)
          .order('numero', { ascending: true })
        if (!error && data) {
          setUnitaList(data)
        }
      } catch (e) {
        console.warn('Errore caricamento unità globali:', e.message)
      }
    }
    caricaUnitaPerCondo()
  }, [nuovoCondominioId])

  // Caricamento dati per vista globale
  const caricaDatiGlobali = async () => {
    setLoadingGlobal(true)
    try {
      const { data: condData, error: condErr } = await supabase
        .from('condomini')
        .select('id, nome, indirizzo, citta')
        .order('nome', { ascending: true })
      if (condErr) throw condErr
      setCondomini(condData || [])

      const { data: persData, error: persErr } = await supabase
        .from('persone')
        .select(`
          id, nome, cognome, email, telefono, indirizzo, citta,
          occupanti_unita (
            ruolo, attivo,
            unita (id, numero, scala, condominio_id, condomini (nome))
          )
        `)
        .order('cognome', { ascending: true })
      if (persErr) throw persErr

      const personeMappate = (persData || []).map(p => {
        const occupazioni = p.occupanti_unita?.filter(o => o.attivo) || []
        const unitaDettagli = occupazioni.map(o => {
          const condoNome = o.unita?.condomini?.nome || 'Condominio'
          return {
            condominioId: o.unita?.condominio_id,
            condominioNome: condoNome,
            unitaNumero: o.unita?.numero,
            unitaScala: o.unita?.scala,
            ruolo: o.ruolo === 'proprietario' ? 'Proprietario' : 'Inquilino'
          }
        })

        return {
          ...p,
          unitaDettagli,
          isProprietario: occupazioni.some(o => o.ruolo === 'proprietario'),
          isInquilino: occupazioni.some(o => o.ruolo === 'inquilino')
        }
      })
      setPersone(personeMappate)
    } catch (err) {
      console.error('Errore caricamento dati globali:', err.message)
    } finally {
      setLoadingGlobal(false)
    }
  }

  useEffect(() => {
    if (!condominioId) {
      caricaDatiGlobali()
    }
  }, [condominioId])

  // Filtro ricerca globale
  const personeFiltrateGlobali = useMemo(() => {
    if (!searchGlobal) return []
    return persone.filter(p => {
      const matchText = 
        `${p.nome || ''} ${p.cognome || ''}`.toLowerCase().includes(searchGlobal.toLowerCase()) ||
        `${p.cognome || ''} ${p.nome || ''}`.toLowerCase().includes(searchGlobal.toLowerCase()) ||
        (p.email || '').toLowerCase().includes(searchGlobal.toLowerCase()) ||
        (p.telefono || '').toLowerCase().includes(searchGlobal.toLowerCase()) ||
        p.unitaDettagli.some(ud => ud.condominioNome.toLowerCase().includes(searchGlobal.toLowerCase()))
      return matchText
    })
  }, [persone, searchGlobal])

  const toggleCondominio = (cid) => {
    setCondominiEspansi(prev => ({ ...prev, [cid]: !prev[cid] }))
  }

  const getPersoneCondominio = (cid) => {
    return persone.filter(p => p.unitaDettagli.some(ud => ud.condominioId === cid))
  }

  const apriModificaGlobale = (p) => {
    setEditingPersona(p)
    setEditNome(p.nome || '')
    setEditCognome(p.cognome || '')
    setEditEmail(p.email || '')
    setEditTelefono(p.telefono || '')
    setEditIndirizzo(p.indirizzo || '')
    setEditCitta(p.citta || '')
  }

  const handleCreaNuovoGlobale = async (e) => {
    e.preventDefault()
    if (!nuovoNome.trim() || !nuovoCognome.trim()) {
      alert('Nome e Cognome sono obbligatori!')
      return
    }
    setSalvandoNuovo(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Utente non autenticato")

      // 1. Crea la persona
      const { data: persona, error: pErr } = await supabase
        .from('persone')
        .insert([{
          user_id: user.id,
          nome: nuovoNome.trim(),
          cognome: nuovoCognome.trim(),
          email: nuovoEmail.trim() || null,
          telefono: nuovoTelefono.trim() || null,
          telefono_alt: nuovoTelefonoAlt.trim() || null,
          indirizzo: nuovoIndirizzo.trim() || null,
          citta: nuovoCitta.trim() || null,
          cap: nuovoCap.trim() || null,
          provincia: nuovoProvincia.toUpperCase().trim() || null,
          codice_fiscale: nuovoCf.toUpperCase().trim() || null,
          data_nascita: nuovoDataNascita || null,
          note: nuovoNote.trim() || null
        }])
        .select()
        .single()

      if (pErr) throw pErr

      // 2. Se sono selezionati condominio e unità, crea l'occupazione
      if (nuovoCondominioId && nuovoUnitaId) {
        const oggi = new Date().toISOString().split('T')[0]
        const subDate = new Date()
        subDate.setDate(subDate.getDate() - 1)
        const ieri = subDate.toISOString().split('T')[0]

        // Disattiva eventuale occupante precedente attivo con lo stesso ruolo
        await supabase
          .from('occupanti_unita')
          .update({ attivo: false, data_fine: ieri })
          .eq('unita_id', nuovoUnitaId)
          .eq('ruolo', nuovoRuolo)
          .eq('attivo', true)

        // Inserisce il nuovo legame
        const { error: oErr } = await supabase
          .from('occupanti_unita')
          .insert([{
            unita_id: nuovoUnitaId,
            persona_id: persona.id,
            ruolo: nuovoRuolo,
            attivo: true,
            data_inizio: oggi
          }])
        if (oErr) throw oErr
      }

      alert('Nuovo condòmino creato con successo!')
      setShowNuovoModal(false)
      // Reset form
      setNuovoNome('')
      setNuovoCognome('')
      setNuovoEmail('')
      setNuovoTelefono('')
      setNuovoTelefonoAlt('')
      setNuovoIndirizzo('')
      setNuovoCitta('')
      setNuovoCap('')
      setNuovoProvincia('')
      setNuovoCf('')
      setNuovoDataNascita('')
      setNuovoNote('')
      setNuovoCondominioId('')
      setNuovoUnitaId('')
      setNuovoRuolo('proprietario')
      
      await caricaDatiGlobali()
    } catch (err) {
      alert('Errore durante la creazione: ' + err.message)
    } finally {
      setSalvandoNuovo(false)
    }
  }

  const handleSalvaAnagraficaGlobale = async (e) => {
    e.preventDefault()
    if (!editingPersona) return
    setSalvandoAnagrafica(true)
    try {
      const { error } = await supabase
        .from('persone')
        .update({
          nome: editNome,
          cognome: editCognome,
          email: editEmail,
          telefono: editTelefono,
          indirizzo: editIndirizzo,
          citta: editCitta
        })
        .eq('id', editingPersona.id)

      if (error) throw error
      alert('Dati salvati con successo!')
      setEditingPersona(null)
      await caricaDatiGlobali()
    } catch (err) {
      alert('Errore durante il salvataggio: ' + err.message)
    } finally {
      setSalvandoAnagrafica(false)
    }
  }

  // ── Filtro/ricerca condominio singolo ──────────────────────────────────
  const filtered = useMemo(() => {
    return unita.filter(u => {
      const prop = getProprietario(u)
      const inq  = getInquilino(u)
      const matchSearch = !search || [
        u.numero, u.scala, u.tipo,
        prop?.nome, prop?.cognome, prop?.email,
        inq?.nome,  inq?.cognome,  inq?.email,
      ].some(v => v?.toLowerCase().includes(search.toLowerCase()))
      const matchTipo = filterTipo === 'tutti' || u.tipo === filterTipo
      return matchSearch && matchTipo
    })
  }, [unita, search, filterTipo])

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const handleImport = async (rows) => {
    try {
      let unitaCondoList = [...(unita || [])]
      if (unitaCondoList.length === 0 && condominioId) {
        const { data: uData, error: uErr } = await supabase.from('unita').select('id, numero, scala, piano, tipo').eq('condominio_id', condominioId)
        if (uErr) throw uErr
        if (uData) unitaCondoList = uData
      }

      const mappedRows = []
      for (const r of rows) {
        let unita_id = r.unita_id || null
        const strUnita = String(r.unita || '').trim()
        const strUnitaLower = strUnita.toLowerCase()

        if (!unita_id && strUnita && unitaCondoList) {
          const match = unitaCondoList.find(u => {
            const num = String(u.numero || '').trim().toLowerCase()
            const cleanNum = num.replace(/^0+/, '') || '0'
            const cleanStr = strUnitaLower.replace(/^0+/, '') || '0'
            const scalaNum = `${String(u.scala || '').trim().toLowerCase()} ${num}`.trim()
            const isNumEqual = !isNaN(cleanNum) && !isNaN(cleanStr) && Number(cleanNum) === Number(cleanStr)
            return num === strUnitaLower || cleanNum === cleanStr || isNumEqual || scalaNum === strUnitaLower || strUnitaLower === `int. ${num}` || strUnitaLower === `int ${num}` || strUnitaLower === `interno ${num}` || strUnitaLower.endsWith(` ${num}`)
          })
          if (match) {
            unita_id = match.id
          } else if (condominioId) {
            // Creazione automatica unità mancante su quel condominio
            const cleanNumero = strUnita.replace(/^(unita|unità|app\.|appartamento|int\.|interno|n\.|num\.)\s*/i, '').trim() || strUnita
            let tipoUnita = 'appartamento'
            if (strUnitaLower.includes('box') || strUnitaLower.includes('garage')) tipoUnita = 'box'
            else if (strUnitaLower.includes('cantina')) tipoUnita = 'cantina'
            else if (strUnitaLower.includes('negozio')) tipoUnita = 'negozio'
            else if (strUnitaLower.includes('ufficio')) tipoUnita = 'ufficio'

            const { data: newU, error: errU } = await supabase
              .from('unita')
              .insert([{
                condominio_id: condominioId,
                numero: cleanNumero,
                tipo: tipoUnita,
                scala: r.scala ? String(r.scala).trim() : null
              }])
              .select()
              .single()

            if (errU) throw errU
            if (newU) {
              unita_id = newU.id
              unitaCondoList.push(newU)
            }
          }
        }

        let ruolo = String(r.ruolo || '').trim().toLowerCase()
        if (ruolo !== 'proprietario' && ruolo !== 'inquilino') {
          ruolo = unita_id ? 'proprietario' : ''
        }

        mappedRows.push({
          ...r,
          unita_id,
          ruolo
        })
      }

      const result = await importPersone(mappedRows)
      await fetchUnita()
      showToast(`${result.created} persone importate con successo`)
      return result
    } catch (e) {
      showToast('Errore durante l\'importazione: ' + e.message, 'error')
      return { created: 0 }
    }
  }

  const handleSaveUnita = async (data) => {
    try {
      if (editUnita) await updateUnita(editUnita.id, data)
      else await createUnita(data)
      setShowUnitaForm(false)
      setEditUnita(null)
      showToast('Unità salvata')
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  const handleDeleteUnita = async (id) => {
    if (!window.confirm("Sei sicuro di voler eliminare questa unità? L'operazione potrebbe fallire se associata a millesimi o rate.")) return
    try {
      await deleteUnita(id)
      showToast('Unità eliminata')
    } catch (err) {
      showToast("Errore durante l'eliminazione: " + err.message, 'error')
    }
  }

  const handleSavePersona = async (data) => {
    try {
      const persona = await createPersona(data)
      if (showPersonaForm?.unitaId) {
        await assegnaPersona(showPersonaForm.unitaId, persona.id, showPersonaForm.ruolo)
      }
      await fetchUnita()
      setShowPersonaForm(null)
      showToast('Persona aggiunta')
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // RENDER DETTAGLIO CONDOMINIO SINGOLO
  // ════════════════════════════════════════════════════════════════════════
  if (condominioId) {
    return (
      <div style={styles.page}>
        {toast && (
          <div style={{ ...styles.toast, background: toast.type === 'error' ? '#7f1d1d' : '#14532d' }}>
            {toast.msg}
          </div>
        )}

        <div style={styles.header}>
          <div>
            <div style={styles.breadcrumb}>
              <Link to="/condomini" style={styles.breadLink}>Condomini</Link>
              <span style={{ color: 'var(--text-muted)' }}> / </span>
              <span style={{ color: 'var(--text-secondary)' }}>Anagrafica</span>
            </div>
            <h1 style={styles.title}>Anagrafica Unità</h1>
            <p style={styles.subtitle}>{unita.length} unità totali · {filtered.length} visualizzate</p>
          </div>
          <div style={styles.headerActions}>
            <button style={styles.btnSecondary} onClick={() => setShowImport(true)}>
              📂 Importa file
            </button>
            <button style={styles.btnPrimary} onClick={() => { setEditUnita(null); setShowUnitaForm(true) }}>
              + Nuova unità
            </button>
          </div>
        </div>

        <div style={styles.filters}>
          <input
            style={styles.search}
            placeholder="Cerca per unità, proprietario, inquilino, email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select style={styles.select} value={filterTipo} onChange={e => setFilterTipo(e.target.value)}>
            <option value="tutti">Tutti i tipi</option>
            {Object.entries(TIPO_COLORS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>

        {loadingUnita ? (
          <div style={styles.loading}>Caricamento…</div>
        ) : filtered.length === 0 ? (
          <div style={styles.empty}>
            <p style={{ fontSize: 48, marginBottom: 8 }}>🏢</p>
            <p style={{ color: 'var(--text-secondary)' }}>Nessuna unità trovata</p>
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Aggiungi unità manualmente o importa un file</p>
          </div>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  {['Unità','Tipo','Piano / Scala','Proprietario','Inquilino','mq','Millesimi',''].map(h => (
                    <th key={h} style={styles.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => {
                  const prop = getProprietario(u)
                  const inq  = getInquilino(u)
                  const isExpanded = expandedRow === u.id
                  return [
                    <tr key={u.id} style={styles.tr} onClick={() => setExpandedRow(isExpanded ? null : u.id)}>
                      <td style={{ ...styles.td, fontWeight: 700, color: 'var(--text-primary)', textAlign: 'left' }}>
                        {u.numero}
                      </td>
                      <td style={{ ...styles.td, textAlign: 'left' }}><TipoBadge tipo={u.tipo} /></td>
                      <td style={{ ...styles.td, color: 'var(--text-secondary)', textAlign: 'left' }}>
                        {u.piano != null ? `Piano ${u.piano}` : '—'}
                        {u.scala ? ` · Sc.${u.scala}` : ''}
                      </td>
                      <td style={{ ...styles.td, textAlign: 'left' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'space-between' }}>
                          <PersonaChip persona={prop} ruolo="proprietario" />
                          <button
                            onClick={(e) => { e.stopPropagation(); setStoricoModal({ unita: u, ruolo: 'proprietario' }) }}
                            style={styles.historyBtn}
                            onMouseOver={(e) => e.currentTarget.style.color = '#38bdf8'}
                            onMouseOut={(e) => e.currentTarget.style.color = '#64748b'}
                            title="Storico proprietari"
                          >
                            <Clock size={12} />
                          </button>
                        </div>
                      </td>
                      <td style={{ ...styles.td, textAlign: 'left' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'space-between' }}>
                          <PersonaChip persona={inq}  ruolo="inquilino" />
                          <button
                            onClick={(e) => { e.stopPropagation(); setStoricoModal({ unita: u, ruolo: 'inquilino' }) }}
                            style={styles.historyBtn}
                            onMouseOver={(e) => e.currentTarget.style.color = '#38bdf8'}
                            onMouseOut={(e) => e.currentTarget.style.color = '#64748b'}
                            title="Storico inquilini"
                          >
                            <Clock size={12} />
                          </button>
                        </div>
                      </td>
                      <td style={{ ...styles.td, color: 'var(--text-secondary)', textAlign: 'left' }}>{u.mq ? `${u.mq} m²` : '—'}</td>
                      <td style={{ ...styles.td, color: 'var(--text-secondary)', textAlign: 'left' }}>{u.millesimi || '—'}</td>
                      <td style={styles.td}>
                        <div style={styles.rowActions} onClick={e => e.stopPropagation()}>
                          <button style={styles.iconBtn} title="Modifica" onClick={() => { setEditUnita(u); setShowUnitaForm(true) }}><Edit size={14} /></button>
                          <button style={styles.iconBtn} title="Aggiungi proprietario" onClick={() => setShowPersonaForm({ unitaId: u.id, ruolo: 'proprietario' })}><Home size={14} style={{ color: '#3b82f6' }} /></button>
                          <button style={styles.iconBtn} title="Aggiungi inquilino"   onClick={() => setShowPersonaForm({ unitaId: u.id, ruolo: 'inquilino' })}><Key size={14} style={{ color: '#f59e0b' }} /></button>
                          <button style={{ ...styles.iconBtn, color: '#ef4444' }} title="Elimina" onClick={() => handleDeleteUnita(u.id)}><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>,

                    isExpanded && (
                      <tr key={`${u.id}-expanded`} style={{ background: 'var(--app-bg)' }}>
                        <td colSpan={8} style={{ padding: '0 16px 16px' }}>
                          <div style={styles.expandedGrid}>
                            {[
                              { label: 'Proprietario', persona: prop, ruolo: 'proprietario' },
                              { label: 'Inquilino',     persona: inq,  ruolo: 'inquilino' },
                            ].map(({ label, persona, ruolo }) => (
                              <div key={ruolo} style={styles.expandedCard}>
                                <div style={styles.expandedTitle}>{RUOLO_ICON[ruolo]} {label}</div>
                                {persona ? (
                                  <div style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.8, textAlign: 'left' }}>
                                    <div><b>Nome:</b> {persona.cognome} {persona.nome}</div>
                                    <div><b>Email:</b> {persona.email || '—'}</div>
                                    <div><b>Tel:</b> {persona.telefono || '—'}</div>
                                    <div><b>Indirizzo:</b> {persona.indirizzo || '—'} {persona.citta || ''}</div>
                                  </div>
                                ) : (
                                  <button style={styles.addPersonaBtn}
                                    onClick={() => setShowPersonaForm({ unitaId: u.id, ruolo })}>
                                    + Aggiungi {label.toLowerCase()}
                                  </button>
                                )}
                              </div>
                            ))}
                            {u.note && (
                              <div style={{ ...styles.expandedCard, gridColumn: '1/-1' }}>
                                <div style={styles.expandedTitle}>📝 Note</div>
                                <div style={{ color: 'var(--text-secondary)', fontSize: 13, textAlign: 'left' }}>{u.note}</div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  ]
                })}
              </tbody>
            </table>
          </div>
        )}

        {showImport && (
          <AnagraficaImport onImport={handleImport} onClose={() => setShowImport(false)} />
        )}
        {showUnitaForm && (
          <UnitaForm
            unita={editUnita}
            condominioId={condominioId}
            onSave={handleSaveUnita}
            onClose={() => { setShowUnitaForm(false); setEditUnita(null) }}
          />
        )}
        {showPersonaForm && (
          <PersonaForm
            ruolo={showPersonaForm.ruolo}
            onSave={handleSavePersona}
            onClose={() => setShowPersonaForm(null)}
          />
        )}
        {storicoModal && (
          <StoricoOccupantiModal
            unita={storicoModal.unita}
            ruolo={storicoModal.ruolo}
            onClose={() => setStoricoModal(null)}
            onSaved={fetchUnita}
          />
        )}
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════
  // RENDER MULTI-CONDOMINIO GLOBALE
  // ════════════════════════════════════════════════════════════════════════
  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Anagrafica Condomini e Residenti</h1>
          <p style={styles.subtitle}>Gestisci la situazione anagrafica di tutti i condomini e cerca rapidamente i contatti.</p>
        </div>
        <div style={styles.headerActions}>
          <button style={styles.btnPrimary} onClick={() => setShowNuovoModal(true)}>
            <Plus size={15} style={{ marginRight: 6 }} /> Nuovo Condòmino
          </button>
        </div>
      </div>

      {/* Barra di ricerca superiore */}
      <div style={styles.searchBarWrap}>
        <Search size={20} color="#64748b" style={{ marginLeft: 14 }} />
        <input
          type="text"
          placeholder="Cerca condòmino per nome, cognome, email o condominio in tutto il sistema..."
          value={searchGlobal}
          onChange={(e) => setSearchGlobal(e.target.value)}
          style={styles.searchBarInput}
        />
      </div>

      {loadingGlobal ? (
        <div style={styles.loading}>Caricamento anagrafiche condomini...</div>
      ) : searchGlobal ? (
        /* VISTA FILTRATA: RISULTATI DI RICERCA GLOBALI */
        <div style={styles.resultsSec}>
          <h3 style={styles.resultsTitle}>Risultati della ricerca ({personeFiltrateGlobali.length})</h3>
          
          {personeFiltrateGlobali.length === 0 ? (
            <div style={styles.empty}>
              <Search size={32} color="#475569" style={{ marginBottom: 8 }} />
              <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Nessun condòmino trovato per "{searchGlobal}"</p>
            </div>
          ) : (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Condòmino</th>
                    <th style={styles.th}>Contatti</th>
                    <th style={styles.th}>Condominio ed Unità</th>
                    <th style={styles.th}>Residenza</th>
                    <th style={{ ...styles.th, textAlign: 'center' }}>Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {personeFiltrateGlobali.map(p => {
                    const iniziali = `${p.nome?.[0] || ''}${p.cognome?.[0] || ''}`.toUpperCase()
                    return (
                      <tr key={p.id} style={styles.tr}>
                        <td style={styles.td}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={styles.avatar}>{iniziali}</div>
                            <div style={{ textAlign: 'left' }}>
                              <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{p.cognome} {p.nome}</div>
                              <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>ID: {p.id.slice(0, 8)}</div>
                            </div>
                          </div>
                        </td>
                        <td style={styles.td}>
                          <div style={styles.contactItem}><Mail size={12} color="#64748b" /> {p.email || '—'}</div>
                          <div style={{ ...styles.contactItem, marginTop: 4 }}><Phone size={12} color="#64748b" /> {p.telefono || '—'}</div>
                        </td>
                        <td style={styles.td}>
                          {p.unitaDettagli.map((ud, i) => (
                            <div key={i} style={{ marginBottom: i > 0 ? 6 : 0, textAlign: 'left' }}>
                              <div style={{ color: '#60a5fa', fontWeight: 600, fontSize: 13 }}>{ud.condominioNome}</div>
                              <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{ud.ruolo} • Unità {ud.unitaNumero}{ud.unitaScala ? ` Scala ${ud.unitaScala}` : ''}</div>
                            </div>
                          ))}
                          {p.unitaDettagli.length === 0 && <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Nessuna associazione</span>}
                        </td>
                        <td style={styles.td}>
                          <div style={{ color: 'var(--text-secondary)', fontSize: 13, textAlign: 'left' }}>{p.indirizzo || '—'}</div>
                          {p.citta && <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 2, textAlign: 'left' }}>{p.citta}</div>}
                        </td>
                        <td style={{ ...styles.td, textAlign: 'center' }}>
                          <button onClick={() => apriModificaGlobale(p)} style={styles.btnEdit} title="Modifica Anagrafica">
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Edit size={12} /> Modifica</span>
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* VISTA ORDINARIA: ACCORDION PER CONDOMINIO */
        <div style={styles.condominiList}>
          {condomini.map(c => {
            const isEspanso = condominiEspansi[c.id]
            const residenti = getPersoneCondominio(c.id)

            return (
              <div key={c.id} style={styles.condoCard}>
                <div style={styles.condoCardHead} onClick={() => toggleCondominio(c.id)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={styles.condoIcon}>
                      <Building2 size={18} color="#60a5fa" />
                    </div>
                    <div style={{ textAlign: 'left' }}>
                      <div style={styles.condoNome}>{c.nome}</div>
                      <div style={styles.condoIndirizzo}>{c.indirizzo} • {c.citta}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <span style={styles.residentiCountBadge}>{residenti.length} residenti</span>
                    {isEspanso ? <ChevronUp size={18} color="#64748b" /> : <ChevronDown size={18} color="#64748b" />}
                  </div>
                </div>

                {isEspanso && (
                  <div style={styles.condoCardBody}>
                    {residenti.length === 0 ? (
                      <div style={{ padding: '20px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                        Nessun condomino o inquilino associato alle unità di questo condominio.
                      </div>
                    ) : (
                      <div style={styles.tableWrap}>
                        <table style={styles.table}>
                          <thead>
                            <tr>
                              <th style={styles.th}>Condòmino</th>
                              <th style={styles.th}>Contatti</th>
                              <th style={styles.th}>Ruolo ed Unità</th>
                              <th style={styles.th}>Residenza</th>
                              <th style={{ ...styles.th, textAlign: 'center' }}>Azioni</th>
                            </tr>
                          </thead>
                          <tbody>
                            {residenti.map(p => {
                              const iniziali = `${p.nome?.[0] || ''}${p.cognome?.[0] || ''}`.toUpperCase()
                              // Filtra le unità associate specificamente a questo condominio
                              const unitaCondo = p.unitaDettagli.filter(ud => ud.condominioId === c.id)

                              return (
                                <tr key={p.id} style={styles.tr}>
                                  <td style={styles.td}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                      <div style={styles.avatar}>{iniziali}</div>
                                      <div style={{ textAlign: 'left' }}>
                                        <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{p.cognome} {p.nome}</div>
                                        <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>ID: {p.id.slice(0, 8)}</div>
                                      </div>
                                    </div>
                                  </td>
                                  <td style={styles.td}>
                                    <div style={styles.contactItem}><Mail size={12} color="#64748b" /> {p.email || '—'}</div>
                                    <div style={{ ...styles.contactItem, marginTop: 4 }}><Phone size={12} color="#64748b" /> {p.telefono || '—'}</div>
                                  </td>
                                  <td style={styles.td}>
                                    {unitaCondo.map((uc, idx) => (
                                      <div key={idx} style={{ marginBottom: idx > 0 ? 4 : 0, textAlign: 'left' }}>
                                        <span style={{ color: uc.ruolo === 'Proprietario' ? '#60a5fa' : '#34d399', fontWeight: 600, fontSize: 12 }}>
                                          {uc.ruolo}
                                        </span>
                                        <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}> • Unità {uc.unitaNumero}{uc.unitaScala ? ` (Scala ${uc.unitaScala})` : ''}</span>
                                      </div>
                                    ))}
                                  </td>
                                  <td style={styles.td}>
                                    <div style={{ color: 'var(--text-secondary)', fontSize: 13, textAlign: 'left' }}>{p.indirizzo || '—'}</div>
                                    {p.citta && <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 2, textAlign: 'left' }}>{p.citta}</div>}
                                  </td>
                                  <td style={{ ...styles.td, textAlign: 'center' }}>
                                    <button onClick={() => apriModificaGlobale(p)} style={styles.btnEdit} title="Modifica Anagrafica">
                                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Edit size={12} /> Modifica</span>
                                    </button>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modale Modifica Anagrafica Globale */}
      {editingPersona && (
        <div style={styles.overlay} onClick={() => setEditingPersona(null)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHead}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <UserCog size={18} color="#60a5fa" />
                <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 15 }}>Modifica Anagrafica Condòmino</span>
              </div>
              <button style={styles.btnClose} onClick={() => setEditingPersona(null)}><X size={16} /></button>
            </div>
            
            <form onSubmit={handleSalvaAnagraficaGlobale}>
              <div style={styles.modalBody}>
                <div style={styles.formRow}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Nome</label>
                    <input style={styles.input} type="text" required value={editNome} onChange={e => setEditNome(e.target.value)} />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Cognome</label>
                    <input style={styles.input} type="text" required value={editCognome} onChange={e => setEditCognome(e.target.value)} />
                  </div>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Email</label>
                  <input style={styles.input} type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Telefono</label>
                  <input style={styles.input} type="text" value={editTelefono} onChange={e => setEditTelefono(e.target.value)} />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Indirizzo di Residenza</label>
                  <input style={styles.input} type="text" value={editIndirizzo} onChange={e => setEditIndirizzo(e.target.value)} />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Città</label>
                  <input style={styles.input} type="text" value={editCitta} onChange={e => setEditCitta(e.target.value)} />
                </div>
              </div>

              <div style={styles.modalFooter}>
                <button type="button" style={styles.btnCancel} onClick={() => setEditingPersona(null)}>Annulla</button>
                <button type="submit" disabled={salvandoAnagrafica} style={styles.btnSave}>
                  {salvandoAnagrafica ? 'Salvataggio...' : 'Salva Modifiche'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modale Nuovo Condòmino Globale */}
      {showNuovoModal && (
        <div style={styles.overlay} onClick={() => setShowNuovoModal(false)}>
          <div style={{ ...styles.modal, width: 550, maxContent: '90vw' }} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHead}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Plus size={18} color="#60a5fa" />
                <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: 15 }}>Nuovo Condòmino</span>
              </div>
              <button style={styles.btnClose} onClick={() => setShowNuovoModal(false)}><X size={16} /></button>
            </div>
            
            <form onSubmit={handleCreaNuovoGlobale}>
              <div style={{ ...styles.modalBody, maxHeight: '65vh', overflowY: 'auto', paddingRight: 6 }}>
                <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, borderBottom: '1px solid var(--border-color)', paddingBottom: 4, textAlign: 'left' }}>Dati Anagrafici</div>
                <div style={styles.formRow}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Cognome *</label>
                    <input style={styles.input} type="text" required value={nuovoCognome} onChange={e => setNuovoCognome(e.target.value)} placeholder="es. Rossi" />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Nome *</label>
                    <input style={styles.input} type="text" required value={nuovoNome} onChange={e => setNuovoNome(e.target.value)} placeholder="es. Mario" />
                  </div>
                </div>

                <div style={styles.formRow}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Codice Fiscale</label>
                    <input style={styles.input} type="text" value={nuovoCf} onChange={e => setNuovoCf(e.target.value)} maxLength={16} placeholder="es. RSSMRA80A01F205X" />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Data di Nascita</label>
                    <input style={styles.input} type="date" value={nuovoDataNascita} onChange={e => setNuovoDataNascita(e.target.value)} />
                  </div>
                </div>

                <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 12, marginBottom: 6, borderBottom: '1px solid var(--border-color)', paddingBottom: 4, textAlign: 'left' }}>Contatti</div>
                <div style={styles.formRow}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Email</label>
                    <input style={styles.input} type="email" value={nuovoEmail} onChange={e => setNuovoEmail(e.target.value)} placeholder="es. email@esempio.it" />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Telefono</label>
                    <input style={styles.input} type="text" value={nuovoTelefono} onChange={e => setNuovoTelefono(e.target.value)} placeholder="es. 3331234567" />
                  </div>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Telefono Alternativo</label>
                  <input style={styles.input} type="text" value={nuovoTelefonoAlt} onChange={e => setNuovoTelefonoAlt(e.target.value)} placeholder="es. 02123456" />
                </div>

                <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 12, marginBottom: 6, borderBottom: '1px solid var(--border-color)', paddingBottom: 4, textAlign: 'left' }}>Residenza</div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Indirizzo</label>
                  <input style={styles.input} type="text" value={nuovoIndirizzo} onChange={e => setNuovoIndirizzo(e.target.value)} placeholder="es. Via Roma 10" />
                </div>
                <div style={styles.formRow}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Città</label>
                    <input style={styles.input} type="text" value={nuovoCitta} onChange={e => setNuovoCitta(e.target.value)} placeholder="es. Milano" />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>CAP</label>
                      <input style={styles.input} type="text" value={nuovoCap} onChange={e => setNuovoCap(e.target.value)} maxLength={5} placeholder="20100" />
                    </div>
                    <div style={styles.formGroup}>
                      <label style={styles.label}>Prov.</label>
                      <input style={styles.input} type="text" value={nuovoProvincia} onChange={e => setNuovoProvincia(e.target.value)} maxLength={2} placeholder="MI" />
                    </div>
                  </div>
                </div>

                <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 12, marginBottom: 6, borderBottom: '1px solid var(--border-color)', paddingBottom: 4, textAlign: 'left' }}>Associazione Unità</div>
                
                <div style={styles.formGroup}>
                  <label style={styles.label}>Condominio</label>
                  <select style={styles.input} value={nuovoCondominioId} onChange={e => setNuovoCondominioId(e.target.value)}>
                    <option value="">-- Seleziona Condominio --</option>
                    {condomini.map(c => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                </div>

                <div style={{ ...styles.formRow, marginTop: 12 }}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Unità</label>
                    <select style={styles.input} value={nuovoUnitaId} onChange={e => setNuovoUnitaId(e.target.value)} disabled={!nuovoCondominioId}>
                      <option value="">-- Nessuna Associazione --</option>
                      {unitaList.map(u => (
                        <option key={u.id} value={u.id}>
                          Unità {u.numero} {u.scala ? `(Scala ${u.scala})` : ''} {u.piano !== null ? `(Piano ${u.piano})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Ruolo</label>
                    <select style={styles.input} value={nuovoRuolo} onChange={e => setNuovoRuolo(e.target.value)} disabled={!nuovoUnitaId}>
                      <option value="proprietario">Proprietario</option>
                      <option value="inquilino">Inquilino</option>
                    </select>
                  </div>
                </div>

                <div style={{ ...styles.formGroup, marginTop: 12 }}>
                  <label style={styles.label}>Note</label>
                  <textarea style={{ ...styles.input, minHeight: 50, resize: 'vertical' }} value={nuovoNote} onChange={e => setNuovoNote(e.target.value)} />
                </div>
              </div>

              <div style={styles.modalFooter}>
                <button type="button" style={styles.btnCancel} onClick={() => setShowNuovoModal(false)}>Annulla</button>
                <button type="submit" disabled={salvandoNuovo} style={styles.btnSave}>
                  {salvandoNuovo ? 'Salvataggio...' : 'Crea Condòmino'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ── STILI COMPLETI ────────────────────────────────────────────────────────
const styles = {
  page: { padding: '28px 32px', background: 'var(--app-bg)', minHeight: '100vh', fontFamily: 'Sora, sans-serif' },
  toast: {
    position: 'fixed', top: 20, right: 20, zIndex: 2000,
    color: 'white', padding: '12px 20px', borderRadius: 10,
    fontSize: 14, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  breadcrumb: { fontSize: 13, marginBottom: 6 },
  breadLink: { color: '#3b82f6', textDecoration: 'none' },
  title: { color: 'var(--text-primary)', fontSize: 26, fontWeight: 700, margin: 0, textAlign: 'left' },
  subtitle: { color: 'var(--text-muted)', fontSize: 13, marginTop: 4, textAlign: 'left' },
  headerActions: { display: 'flex', gap: 10 },
  filters: { display: 'flex', gap: 12, marginBottom: 20 },
  search: {
    flex: 1, background: 'var(--card-bg)', border: '1px solid var(--border-color)', color: 'var(--text-primary)',
    borderRadius: 10, padding: '10px 16px', fontSize: 14, outline: 'none',
  },
  select: {
    background: 'var(--card-bg)', border: '1px solid var(--border-color)', color: 'var(--text-primary)',
    borderRadius: 10, padding: '10px 14px', fontSize: 14, outline: 'none',
  },
  loading: { color: 'var(--text-muted)', textAlign: 'center', padding: '60px' },
  empty: { textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  tableWrap: { overflowX: 'auto', borderRadius: 12, border: '1px solid var(--border-color)', background: 'var(--card-bg)' },
  table: { width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 13 },
  th: {
    background: 'var(--app-bg)', color: 'var(--text-muted)', padding: '12px 16px',
    textAlign: 'left', fontWeight: 600, textTransform: 'uppercase',
    letterSpacing: '0.05em', fontSize: 11, whiteSpace: 'nowrap',
    borderBottom: '1px solid var(--border-color)'
  },
  tr: {
    borderBottom: '1px solid var(--border-color-2)',
    transition: 'background .15s',
  },
  td: { padding: '12px 16px', verticalAlign: 'middle', borderBottom: '1px solid var(--border-color-2)' },
  rowActions: { display: 'flex', gap: 2 },
  historyBtn: {
    background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
    padding: '4px', borderRadius: 4, display: 'flex', alignItems: 'center',
  },
  iconBtn: {
    background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px',
    fontSize: 15, borderRadius: 6, transition: 'background .15s',
  },
  expandedGrid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, paddingTop: 16,
  },
  expandedCard: {
    background: 'var(--card-bg)', borderRadius: 10, padding: '14px 18px',
    border: '1px solid var(--border-color)',
  },
  expandedTitle: { color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.08em', marginBottom: 10 },
  addPersonaBtn: {
    background: 'transparent', border: '1px dashed var(--border-color)', color: '#3b82f6',
    borderRadius: 8, padding: '8px 16px', cursor: 'pointer', fontSize: 13,
  },
  btnPrimary: {
    background: '#2563eb', color: 'white', border: 'none', borderRadius: 8,
    padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
  btnSecondary: {
    background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-color)',
    borderRadius: 8, padding: '10px 20px', fontSize: 14, cursor: 'pointer',
  },

  // Stili globali
  searchBarWrap: { display: 'flex', alignItems: 'center', background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 12, marginBottom: 20 },
  searchBarInput: { background: 'transparent', border: 'none', padding: '14px 16px', color: 'var(--text-primary)', fontFamily: 'Sora, sans-serif', fontSize: 14, outline: 'none', width: '100%' },
  resultsSec: { marginTop: 10 },
  resultsTitle: { color: 'var(--text-secondary)', fontSize: 15, fontWeight: 600, marginBottom: 12, textAlign: 'left' },
  avatar: { width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', color: '#fff', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  contactItem: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-primary)' },
  btnEdit: { background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: 6, padding: '6px 12px', color: 'var(--text-primary)', fontSize: 12, cursor: 'pointer', fontFamily: 'Sora, sans-serif', fontWeight: 600 },
  
  condominiList: { display: 'flex', flexDirection: 'column', gap: 14 },
  condoCard: { background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 14, overflow: 'hidden' },
  condoCardHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 24px', cursor: 'pointer' },
  condoIcon: { width: 38, height: 38, borderRadius: 10, background: 'rgba(37,99,235,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  condoNome: { color: 'var(--text-primary)', fontWeight: 700, fontSize: 16 },
  condoIndirizzo: { color: 'var(--text-muted)', fontSize: 12, marginTop: 2 },
  residentiCountBadge: { background: 'rgba(96,165,250,0.15)', color: '#60a5fa', fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 20 },
  condoCardBody: { padding: '0 24px 24px 24px', borderTop: '1px solid var(--border-color-2)', paddingTop: 16 },

  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 },
  modal: { background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 14, padding: 22, width: 440, maxWidth: '90vw', fontFamily: 'Sora, sans-serif' },
  modalHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  btnClose: { background: 'transparent', color: 'var(--text-muted)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 },
  modalBody: { display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 },
  formRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  formGroup: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' },
  input: { width: '100%', boxSizing: 'border-box', background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '9px 10px', color: 'var(--text-primary)', fontFamily: 'Sora, sans-serif', fontSize: 14, outline: 'none' },
  modalFooter: { display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid var(--border-color)', paddingTop: 14 },
  btnCancel: { background: 'transparent', border: '1px solid var(--border-color)', borderRadius: 8, padding: '9px 20px', color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'Sora, sans-serif', fontSize: 13 },
  btnSave: { background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Sora, sans-serif' },
}
