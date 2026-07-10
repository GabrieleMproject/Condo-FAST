// src/components/AnagraficaCondominioTab.jsx
import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Search, UserCog, Edit, X, Mail, Phone, Home, Download, FileText, Upload, Plus } from 'lucide-react'
import { exportAnagraficaXlsx } from '../lib/exportXlsx'
import { exportAnagraficaPdf } from '../lib/exportPdf'
import { usePlan } from '../hooks/usePlan'
import { useWatermark } from '../hooks/useWatermark'
import AnagraficaImport from './AnagraficaImport'

export default function AnagraficaCondominioTab({ condominioId, condominio }) {
  const { profile } = usePlan()
  const { checkWatermark, WatermarkModal } = useWatermark()
  const [persone, setPersone] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroRuolo, setFiltroRuolo] = useState('tutti') // 'tutti' | 'proprietario' | 'inquilino'
  const [editingPersona, setEditingPersona] = useState(null) // persona in editing
  const [showImport, setShowImport] = useState(false)
  const [showNuovoModal, setShowNuovoModal] = useState(false)

  // Stati per la modale di editing
  const [nome, setNome] = useState('')
  const [cognome, setCognome] = useState('')
  const [email, setEmail] = useState('')
  const [telefono, setTelefono] = useState('')
  const [indirizzo, setIndirizzo] = useState('')
  const [citta, setCitta] = useState('')
  const [salvando, setSalvando] = useState(false)

  // Stati per la modale di creazione manuale
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
  const [nuovoUnitaId, setNuovoUnitaId] = useState('')
  const [nuovoRuolo, setNuovoRuolo] = useState('proprietario')
  const [salvandoNuovo, setSalvandoNuovo] = useState(false)

  // Lista di tutte le unità per il dropdown
  const [unitaList, setUnitaList] = useState([])

  const caricaUnita = async () => {
    try {
      const { data, error } = await supabase
        .from('unita')
        .select('id, numero, scala, piano')
        .eq('condominio_id', condominioId)
        .order('numero', { ascending: true })
      if (!error && data) {
        setUnitaList(data)
      }
    } catch (e) {
      console.warn('Errore caricamento unità:', e.message)
    }
  }

  const caricaPersone = async () => {
    setLoading(true)
    try {
      // LEFT JOIN: mostra persone anche se non hanno unità assegnata nel condominio
      const { data, error } = await supabase
        .from('persone')
        .select(`
          id, nome, cognome, email, telefono, indirizzo, citta,
          occupanti_unita(id, ruolo, attivo, unita(id, numero, scala, condominio_id))
        `)
        .eq('occupanti_unita.unita.condominio_id', condominioId)
        .eq('occupanti_unita.attivo', true)

      if (error) throw error

      // Filtra: mantieni solo le persone che hanno almeno un'occupazione in questo condominio
      const personeFiltrate = (data || []).filter(p =>
        (p.occupanti_unita || []).some(o => o.unita?.condominio_id === condominioId)
      )

      const personeMappate = personeFiltrate.map(p => {
        const occupazioni = (p.occupanti_unita || []).filter(o => o.unita?.condominio_id === condominioId)
        const unitaNomi = occupazioni.map(o => `Unità ${o.unita.numero}${o.unita.scala ? ` (Sc. ${o.unita.scala})` : ''}`).join(', ')
        const ruoli = Array.from(new Set(occupazioni.map(o => o.ruolo))).map(r => r === 'proprietario' ? 'Proprietario' : 'Inquilino').join(' / ')
        
        return {
          ...p,
          unitaNomi,
          ruoli,
          isProprietario: occupazioni.some(o => o.ruolo === 'proprietario'),
          isInquilino: occupazioni.some(o => o.ruolo === 'inquilino')
        }
      })

      setPersone(personeMappate)
    } catch (err) {
      console.error('Errore caricamento anagrafica condominio:', err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (condominioId) {
      caricaPersone()
      caricaUnita()
    }
  }, [condominioId])

  // Filtra le persone in base a ricerca e ruolo
  const personeFiltrate = useMemo(() => {
    return persone.filter(p => {
      const matchSearch = 
        `${p.nome} ${p.cognome}`.toLowerCase().includes(search.toLowerCase()) ||
        `${p.cognome} ${p.nome}`.toLowerCase().includes(search.toLowerCase()) ||
        (p.email || '').toLowerCase().includes(search.toLowerCase()) ||
        (p.unitaNomi || '').toLowerCase().includes(search.toLowerCase())

      const matchRuolo = 
        filtroRuolo === 'tutti' ||
        (filtroRuolo === 'proprietario' && p.isProprietario) ||
        (filtroRuolo === 'inquilino' && p.isInquilino)

      return matchSearch && matchRuolo
    })
  }, [persone, search, filtroRuolo])

  const apriModifica = (p) => {
    setEditingPersona(p)
    setNome(p.nome || '')
    setCognome(p.cognome || '')
    setEmail(p.email || '')
    setTelefono(p.telefono || '')
    setIndirizzo(p.indirizzo || '')
    setCitta(p.citta || '')
  }

  const handleSalva = async (e) => {
    e.preventDefault()
    if (!editingPersona) return
    setSalvando(true)
    try {
      const { error } = await supabase
        .from('persone')
        .update({ nome, cognome, email, telefono, indirizzo, citta })
        .eq('id', editingPersona.id)

      if (error) throw error

      alert('Dati anagrafici salvati con successo!')
      setEditingPersona(null)
      await caricaPersone()
    } catch (err) {
      alert('Errore durante il salvataggio: ' + err.message)
    } finally {
      setSalvando(false)
    }
  }

  const handleCreaNuovo = async (e) => {
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

      // 2. Se è selezionata una unità, crea l'occupazione
      if (nuovoUnitaId) {
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
      setNuovoUnitaId('')
      setNuovoRuolo('proprietario')
      
      await caricaPersone()
    } catch (err) {
      alert('Errore durante la creazione: ' + err.message)
    } finally {
      setSalvandoNuovo(false)
    }
  }

  const handleImport = async (rows) => {
    const { data: { user } } = await supabase.auth.getUser()

    // Carica unità del condominio per l'abbinamento
    const { data: unitaCondoData } = await supabase
      .from('unita')
      .select('id, numero, scala, piano, tipo')
      .eq('condominio_id', condominioId)
    const unitaCondominio = unitaCondoData || []
    const results = { created: 0, errors: [] }

    for (const r of rows) {
      try {
        // 1. Abbina unità per numero
        let unita_id = r.unita_id || null
        const strUnita = String(r.unita || '').trim()
        const strUnitaLower = strUnita.toLowerCase()

        if (!unita_id && strUnita) {
          const match = unitaCondominio.find(u => {
            const num = String(u.numero || '').trim().toLowerCase()
            const cleanNum = num.replace(/^0+/, '') || '0'
            const cleanStr = strUnitaLower.replace(/^0+/, '') || '0'
            return num === strUnitaLower || cleanNum === cleanStr ||
              strUnitaLower === `int. ${num}` || strUnitaLower === `int ${num}` ||
              strUnitaLower === `interno ${num}` || strUnitaLower.endsWith(` ${num}`)
          })
          if (match) {
            unita_id = match.id
          } else {
            const cleanNumero = strUnita.replace(/^(unita|unità|app\.|appartamento|int\.|interno|n\.|num\.)\s*/i, '').trim() || strUnita
            const { data: newU, error: errU } = await supabase
              .from('unita')
              .insert([{ condominio_id: condominioId, numero: cleanNumero, tipo: 'appartamento' }])
              .select().single()
            if (!errU && newU) { unita_id = newU.id; unitaCondominio.push(newU) }
          }
        }

        // 2. Crea persona
        const { data: persona, error: pErr } = await supabase
          .from('persone')
          .insert([{
            user_id: user.id,
            nome: r.nome || '',
            cognome: r.cognome || '',
            email: r.email || null,
            telefono: r.telefono || null,
            indirizzo: r.indirizzo || null,
            citta: r.citta || null,
            cap: r.cap || null,
            provincia: r.provincia || null,
            codice_fiscale: r.codice_fiscale || null,
          }])
          .select().single()
        if (pErr) throw pErr

        // 3. Assegna a unità
        if (unita_id) {
          const ruolo = ['proprietario', 'inquilino'].includes(String(r.ruolo || '').toLowerCase())
            ? r.ruolo.toLowerCase() : 'proprietario'
          const oggi = new Date().toISOString().split('T')[0]
          const subDate = new Date()
          subDate.setDate(subDate.getDate() - 1)
          const ieri = subDate.toISOString().split('T')[0]

          await supabase.from('occupanti_unita')
            .update({ attivo: false, data_fine: ieri })
            .eq('unita_id', unita_id).eq('ruolo', ruolo).eq('attivo', true)
          const { error: aErr } = await supabase.from('occupanti_unita')
            .insert([{ unita_id, persona_id: persona.id, ruolo, attivo: true, data_inizio: oggi }])
          if (aErr) console.warn(`Assegnazione unità fallita per ${r.nome} ${r.cognome}:`, aErr.message)
        }

        results.created++
      } catch (err) {
        results.errors.push({ row: r, error: err.message })
      }
    }

    await caricaPersone()
    return results
  }


  return (
    <div style={styles.container}>
      <WatermarkModal />
      
      {/* Sezione Filtri */}
      <div style={styles.filterRow}>
        <div style={styles.searchSec}>
          <Search size={16} color="#64748b" style={{ marginLeft: 10 }} />
          <input
            type="text"
            placeholder="Cerca condomino per nome, email o unità..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={styles.searchInput}
          />
        </div>

        <div style={styles.tabFilters}>
          {[
            { id: 'tutti', label: 'Tutti' },
            { id: 'proprietario', label: 'Proprietari' },
            { id: 'inquilino', label: 'Inquilini' }
          ].map(f => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFiltroRuolo(f.id)}
              style={styles.filterBtn(filtroRuolo === f.id)}
            >
              {f.label}
            </button>
          ))}
          <div style={{ display: 'flex', gap: 6, marginLeft: 8 }}>
            <button
              type="button"
              onClick={() => setShowNuovoModal(true)}
              style={{ ...styles.filterBtn(false), display: 'flex', alignItems: 'center', gap: 6, color: '#3b82f6', border: '1px solid rgba(59,130,246,0.3)', padding: '6px 10px' }}
              title="Crea manualmente un nuovo condòmino"
            >
              <Plus size={14} /> Nuovo Condòmino
            </button>
            <button
              type="button"
              onClick={() => setShowImport(true)}
              style={{ ...styles.filterBtn(false), display: 'flex', alignItems: 'center', gap: 6, color: '#60a5fa', border: '1px solid rgba(96,165,250,0.3)', padding: '6px 10px' }}
              title="Importa anagrafica da file Excel, Word o PDF"
            >
              <Upload size={14} /> Importa
            </button>
            <button
              type="button"
              onClick={() => exportAnagraficaXlsx({ condominio: { nome: 'Condominio' }, persone: personeFiltrate })}
              style={{ ...styles.filterBtn(false), display: 'flex', alignItems: 'center', gap: 6, color: '#10b981', border: '1px solid rgba(16,185,129,0.3)', padding: '6px 10px' }}
              title="Esporta in Excel"
            >
              <Download size={14} /> Excel
            </button>
            <button
              type="button"
              onClick={() => {
                checkWatermark((withWatermark) => {
                  exportAnagraficaPdf({ condominio: condominio || { nome: 'Condominio' }, persone: personeFiltrate, profile, withWatermark })
                })
              }}
              style={{ ...styles.filterBtn(false), display: 'flex', alignItems: 'center', gap: 6, color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', padding: '6px 10px' }}
              title="Esporta in PDF"
            >
              <FileText size={14} /> PDF
            </button>
          </div>
        </div>
      </div>

      {/* Tabella anagrafica */}
      {loading ? (
        <div style={styles.loading}>Caricamento anagrafica...</div>
      ) : personeFiltrate.length === 0 ? (
        <div style={styles.empty}>
          <Search size={32} color="#334155" style={{ marginBottom: 10 }} />
          <p style={{ color: '#64748b', margin: 0 }}>Nessun condòmino corrispondente ai filtri impostati</p>
        </div>
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Condòmino</th>
                <th style={styles.th}>Ruolo</th>
                <th style={styles.th}>Contatti</th>
                <th style={styles.th}>Unità Collegate</th>
                <th style={styles.th}>Residenza</th>
                <th style={{ ...styles.th, textAlign: 'center' }}>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {personeFiltrate.map(p => {
                const iniziali = `${p.nome?.[0] || ''}${p.cognome?.[0] || ''}`.toUpperCase()
                return (
                  <tr key={p.id} style={styles.tr}>
                    <td style={styles.td}>
                      <div style={styles.profileRow}>
                        <div style={styles.avatar}>{iniziali || '?'}</div>
                        <div style={{ textAlign: 'left' }}>
                          <div style={styles.fullName}>{p.cognome} {p.nome}</div>
                          <div style={{ color: '#64748b', fontSize: 11, marginTop: 2 }}>ID: {p.id.slice(0, 8)}</div>
                        </div>
                      </div>
                    </td>
                    <td style={styles.td}>
                      <span style={styles.roleBadge(p.isProprietario)}>
                        {p.ruoli}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <div style={styles.contactItem}><Mail size={12} color="#64748b" /> {p.email || '—'}</div>
                      <div style={{ ...styles.contactItem, marginTop: 4 }}><Phone size={12} color="#64748b" /> {p.telefono || '—'}</div>
                    </td>
                    <td style={styles.td}>
                      <div style={styles.contactItem}><Home size={12} color="#64748b" /> {p.unitaNomi || 'Nessuna'}</div>
                    </td>
                    <td style={styles.td}>
                      <div style={{ fontSize: 13, color: '#e2e8f0' }}>{p.indirizzo || '—'}</div>
                      {p.citta && <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{p.citta}</div>}
                    </td>
                    <td style={{ ...styles.td, textAlign: 'center' }}>
                      <button onClick={() => apriModifica(p)} style={styles.btnEdit} title="Modifica Anagrafica">
                        <Edit size={14} style={{ marginRight: 6 }} /> Modifica
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modale Modifica */}
      {editingPersona && (
        <div style={styles.overlay} onClick={() => setEditingPersona(null)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHead}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <UserCog size={18} color="#60a5fa" />
                <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 15 }}>Modifica Anagrafica Condòmino</span>
              </div>
              <button style={styles.btnClose} onClick={() => setEditingPersona(null)}><X size={16} /></button>
            </div>
            
            <form onSubmit={handleSalva}>
              <div style={styles.modalBody}>
                <div style={styles.formRow}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Nome</label>
                    <input style={styles.input} type="text" required value={nome} onChange={e => setNome(e.target.value)} />
                  </div>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Cognome</label>
                    <input style={styles.input} type="text" required value={cognome} onChange={e => setCognome(e.target.value)} />
                  </div>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Email</label>
                  <input style={styles.input} type="email" value={email} onChange={e => setEmail(e.target.value)} />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Telefono</label>
                  <input style={styles.input} type="text" value={telefono} onChange={e => setTelefono(e.target.value)} />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Indirizzo di Residenza</label>
                  <input style={styles.input} type="text" value={indirizzo} onChange={e => setIndirizzo(e.target.value)} />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Città</label>
                  <input style={styles.input} type="text" value={citta} onChange={e => setCitta(e.target.value)} />
                </div>
              </div>

              <div style={styles.modalFooter}>
                <button type="button" style={styles.btnCancel} onClick={() => setEditingPersona(null)}>Annulla</button>
                <button type="submit" disabled={salvando} style={styles.btnSave}>
                  {salvando ? 'Salvataggio...' : 'Salva Modifiche'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modale Nuovo Condòmino */}
      {showNuovoModal && (
        <div style={styles.overlay} onClick={() => setShowNuovoModal(false)}>
          <div style={{ ...styles.modal, width: 550, maxContent: '90vw' }} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHead}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Plus size={18} color="#60a5fa" />
                <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 15 }}>Nuovo Condòmino</span>
              </div>
              <button style={styles.btnClose} onClick={() => setShowNuovoModal(false)}><X size={16} /></button>
            </div>
            
            <form onSubmit={handleCreaNuovo}>
              <div style={{ ...styles.modalBody, maxHeight: '65vh', overflowY: 'auto', paddingRight: 6 }}>
                <div style={{ color: '#475569', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6, borderBottom: '1px solid #334155', paddingBottom: 4, textAlign: 'left' }}>Dati Anagrafici</div>
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

                <div style={{ color: '#475569', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 12, marginBottom: 6, borderBottom: '1px solid #334155', paddingBottom: 4, textAlign: 'left' }}>Contatti</div>
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

                <div style={{ color: '#475569', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 12, marginBottom: 6, borderBottom: '1px solid #334155', paddingBottom: 4, textAlign: 'left' }}>Residenza</div>
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

                <div style={{ color: '#475569', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 12, marginBottom: 6, borderBottom: '1px solid #334155', paddingBottom: 4, textAlign: 'left' }}>Assegnazione Unità</div>
                <div style={styles.formRow}>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Unità</label>
                    <select style={styles.input} value={nuovoUnitaId} onChange={e => setNuovoUnitaId(e.target.value)}>
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

      {/* Modale Importazione AI */}
      {showImport && (
        <AnagraficaImport onImport={handleImport} onClose={() => setShowImport(false)} />
      )}
    </div>
  )
}

const styles = {
  container: { display: 'flex', flexDirection: 'column', width: '100%' },
  filterRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 },
  searchSec: { display: 'flex', alignItems: 'center', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, width: 340, maxWidth: '100%' },
  searchInput: { background: 'transparent', border: 'none', padding: '9px 10px', color: '#e2e8f0', fontFamily: 'Sora, sans-serif', fontSize: 13, outline: 'none', width: '100%' },
  tabFilters: { display: 'flex', gap: 6, background: '#0f172a', padding: 4, borderRadius: 8, border: '1px solid #1e293b' },
  filterBtn: (active) => ({ padding: '6px 14px', borderRadius: 6, fontSize: 13, cursor: 'pointer', border: 'none', background: active ? '#2563eb' : 'transparent', color: active ? '#fff' : '#64748b', fontFamily: 'Sora, sans-serif', fontWeight: active ? 600 : 400, transition: 'all 0.15s' }),
  loading: { textAlign: 'center', padding: 40, color: '#64748b', fontSize: 14 },
  empty: { textAlign: 'center', padding: 40, background: '#1e293b', borderRadius: 12, border: '1px solid #334155', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  tableWrap: { overflowX: 'auto', border: '1px solid #334155', borderRadius: 12 },
  table: { borderCollapse: 'separate', borderSpacing: 0, width: '100%', fontFamily: 'Sora, sans-serif' },
  th: { background: '#0f172a', color: '#64748b', fontSize: 12, fontWeight: 700, padding: '14px 12px', textAlign: 'left', borderBottom: '1px solid #334155', whiteSpace: 'nowrap' },
  tr: { background: '#1e293b', transition: 'background 0.15s' },
  td: { padding: '12px 12px', borderBottom: '1px solid #1e293b', verticalAlign: 'middle' },
  profileRow: { display: 'flex', alignItems: 'center', gap: 10 },
  avatar: { width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)', color: '#fff', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  fullName: { color: '#e2e8f0', fontWeight: 600, fontSize: 14 },
  roleBadge: (isProprietario) => ({ padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: isProprietario ? 'rgba(37,99,235,0.15)' : 'rgba(16,185,129,0.15)', color: isProprietario ? '#60a5fa' : '#34d399' }),
  contactItem: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#e2e8f0' },
  btnEdit: { background: 'rgba(255,255,255,0.05)', border: '1px solid #334155', borderRadius: 6, padding: '6px 12px', color: '#e2e8f0', fontSize: 12, cursor: 'pointer', fontFamily: 'Sora, sans-serif', fontWeight: 600, display: 'inline-flex', alignItems: 'center' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 },
  modal: { background: '#1e293b', border: '1px solid #334155', borderRadius: 14, padding: 22, width: 440, maxWidth: '90vw', fontFamily: 'Sora, sans-serif' },
  modalHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  btnClose: { background: 'transparent', color: '#64748b', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 },
  modalBody: { display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 },
  formRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  formGroup: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { color: '#64748b', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' },
  input: { width: '100%', boxSizing: 'border-box', background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '9px 10px', color: '#e2e8f0', fontFamily: 'Sora, sans-serif', fontSize: 14, outline: 'none' },
  modalFooter: { display: 'flex', justifyContent: 'flex-end', gap: 10, borderTop: '1px solid #334155', paddingTop: 14 },
  btnCancel: { background: 'transparent', border: '1px solid #334155', borderRadius: 8, padding: '9px 20px', color: '#94a3b8', cursor: 'pointer', fontFamily: 'Sora, sans-serif', fontSize: 13 },
  btnSave: { background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'Sora, sans-serif' },
}
