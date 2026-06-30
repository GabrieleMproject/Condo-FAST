// src/components/AnagraficaCondominioTab.jsx
import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Search, UserCog, Edit, X, Mail, Phone, Home } from 'lucide-react'

export default function AnagraficaCondominioTab({ condominioId }) {
  const [persone, setPersone] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filtroRuolo, setFiltroRuolo] = useState('tutti') // 'tutti' | 'proprietario' | 'inquilino'
  const [editingPersona, setEditingPersona] = useState(null) // persona in editing

  // Stati per la modale di editing
  const [nome, setNome] = useState('')
  const [cognome, setCognome] = useState('')
  const [email, setEmail] = useState('')
  const [telefono, setTelefono] = useState('')
  const [indirizzo, setIndirizzo] = useState('')
  const [citta, setCitta] = useState('')
  const [salvando, setSalvando] = useState(false)

  const caricaPersone = async () => {
    setLoading(true)
    try {
      // Estrae le persone collegate alle unità del condominio tramite occupanti_unita
      const { data, error } = await supabase
        .from('persone')
        .select(`
          id, nome, cognome, email, telefono, indirizzo, citta,
          occupanti_unita!inner(id, ruolo, attivo, unita!inner(id, numero, scala, condominio_id))
        `)
        .eq('occupanti_unita.unita.condominio_id', condominioId)
        .eq('occupanti_unita.attivo', true)

      if (error) throw error

      // Raggruppa i dati per persona, aggregando le unità se una persona possiede/occupa più unità
      const personeMappate = (data || []).map(p => {
        const occupazioni = p.occupanti_unita || []
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
    }
  }, [condominioId])

  // Filtra le persone in base a ricerca e ruolo
  const personeFiltrate = useMemo(() => {
    return persone.filter(p => {
      const matchSearch = 
        `${p.nome} ${p.cognome}`.toLowerCase().includes(search.toLowerCase()) ||
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

  return (
    <div style={styles.container}>
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
