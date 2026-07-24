// src/pages/CondominiPage.jsx
import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCondomini } from '../hooks/useCondomini'
import CondominiForm from '../components/CondominiForm'
import { Building2, CheckCircle2, Home, Eye, Edit3, Archive, Trash2, Layers, Grid } from 'lucide-react'

const STATO_STYLE = {
  attivo:      { bg:'#052e16', text:'#4ade80', label:'Attivo' },
  archiviato:  { bg:'#1c1917', text:'#94a3b8', label:'Archiviato' },
}

export default function CondominiPage() {
  const { condomini, loading, createCondominio, updateCondominio, deleteCondominio, archiviaCondominio } = useCondomini()
  const navigate = useNavigate()

  const [search, setSearch]       = useState('')
  const [filterStato, setFilterStato] = useState('tutti')
  const [showForm, setShowForm]   = useState(false)
  const [editItem, setEditItem]   = useState(null)
  const [toast, setToast]         = useState(null)
  const [menuOpen, setMenuOpen]   = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  const filtered = useMemo(() => condomini.filter(c => {
    const matchSearch = !search ||
      c.nome?.toLowerCase().includes(search.toLowerCase()) ||
      c.citta?.toLowerCase().includes(search.toLowerCase()) ||
      c.indirizzo?.toLowerCase().includes(search.toLowerCase())
    const matchStato = filterStato === 'tutti' || c.stato === filterStato
    return matchSearch && matchStato
  }), [condomini, search, filterStato])

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const handleSave = async (data) => {
    try {
      if (editItem) await updateCondominio(editItem.id, data)
      else await createCondominio(data)
      setShowForm(false)
      setEditItem(null)
      showToast(editItem ? 'Condominio aggiornato' : 'Condominio creato')
    } catch (err) { showToast(err.message, 'error') }
  }

  const handleDelete = async (id) => {
    if (!confirm('Eliminare questo condominio? L\'operazione è irreversibile.')) return
    setDeletingId(id)
    try { await deleteCondominio(id); showToast('Condominio eliminato') }
    catch (err) { showToast(err.message, 'error') }
    finally { setDeletingId(null) }
    setMenuOpen(null)
  }

  const handleArchivia = async (id) => {
    setDeletingId(id)
    try { await archiviaCondominio(id); showToast('Condominio archiviato') }
    catch (err) { showToast(err.message, 'error') }
    finally { setDeletingId(null) }
    setMenuOpen(null)
  }

  // Stats rapide
  const totale  = condomini.length
  const attivi  = condomini.filter(c => c.stato === 'attivo').length
  const unita   = condomini.reduce((s, c) => s + (c.num_unita || 0), 0)

  return (
    <div style={S.page} onClick={() => setMenuOpen(null)}>
      {/* Toast */}
      {toast && (
        <div style={{ ...S.toast, background: toast.type === 'error' ? '#7f1d1d' : '#14532d' }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={S.header}>
        <div>
          <h1 style={S.title}>Condomini</h1>
          <p style={S.subtitle}>Gestisci il tuo portafoglio condominiale</p>
        </div>
        <button style={S.btnPrimary} data-tour-target="btn-nuovo-condominio" onClick={() => { setEditItem(null); setShowForm(true) }}>
          + Nuovo condominio
        </button>
      </div>

      {/* KPI */}
      <div style={S.kpiRow}>
        {[
          { label:'Totale', value: totale, icon: Building2, color: '#3b82f6' },
          { label:'Attivi', value: attivi, icon: CheckCircle2, color: '#16a34a' },
          { label:'Unità totali', value: unita, icon: Home, color: '#d97706' },
        ].map(k => (
          <div key={k.label} style={S.kpiCard}>
            <span style={{ color: k.color, display: 'flex', alignItems: 'center' }}><k.icon size={24} /></span>
            <div>
              <div style={S.kpiValue}>{k.value}</div>
              <div style={S.kpiLabel}>{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filtri */}
      <div style={S.filters}>
        <input
          style={S.search}
          placeholder="Cerca per nome, città, indirizzo…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select style={S.select} value={filterStato} onChange={e => setFilterStato(e.target.value)}>
          <option value="tutti">Tutti gli stati</option>
          <option value="attivo">Attivi</option>
          <option value="archiviato">Archiviati</option>
        </select>
      </div>

      {/* Griglia */}
      {loading ? (
        <div style={S.empty}>Caricamento…</div>
      ) : filtered.length === 0 ? (
        <div style={S.empty}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><Building2 size={48} style={{ color: 'var(--text-muted)' }} /></div>
          <p style={{ color: 'var(--text-secondary)' }}>Nessun condominio trovato</p>
          <button style={S.btnPrimary} onClick={() => setShowForm(true)}>+ Aggiungi il primo</button>
        </div>
      ) : (
        <div style={S.grid}>
          {filtered.map(c => {
            const st = STATO_STYLE[c.stato] || STATO_STYLE.attivo
            return (
              <div key={c.id} style={S.card} onClick={() => navigate(`/condomini/${c.id}`)}>
                {/* Card header */}
                <div style={S.cardHeader}>
                  <div style={{ ...S.cardIcon, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Building2 size={20} /></div>
                  <div style={{ flex:1 }}>
                    <div style={S.cardTitle}>{c.nome}</div>
                    <div style={S.cardAddr}>{c.indirizzo} {c.civico}, {c.citta}</div>
                  </div>
                  {/* Menu contestuale */}
                  <div style={{ position:'relative' }} onClick={e => e.stopPropagation()}>
                    <button style={S.menuBtn} onClick={() => setMenuOpen(menuOpen === c.id ? null : c.id)}>⋮</button>
                    {menuOpen === c.id && (
                      <div style={S.dropdown}>
                        <button style={{ ...S.ddItem, display: 'flex', alignItems: 'center', gap: 8 }} onClick={() => navigate(`/condomini/${c.id}`)}><Eye size={14} /> Visualizza</button>
                        <button style={{ ...S.ddItem, display: 'flex', alignItems: 'center', gap: 8 }} onClick={() => { setEditItem(c); setShowForm(true); setMenuOpen(null) }}><Edit3 size={14} /> Modifica</button>
                        <button disabled={deletingId === c.id} style={{ ...S.ddItem, display: 'flex', alignItems: 'center', gap: 8, opacity: deletingId === c.id ? 0.5 : 1 }} onClick={() => handleArchivia(c.id)}><Archive size={14} /> Archivia</button>
                        <button disabled={deletingId === c.id} style={{ ...S.ddItem, color:'#f87171', display: 'flex', alignItems: 'center', gap: 8, opacity: deletingId === c.id ? 0.5 : 1 }} onClick={() => handleDelete(c.id)}><Trash2 size={14} /> Elimina</button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div style={S.cardStats}>
                  <span style={{ ...S.stat, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Home size={12} /> {c.num_unita || 0} unità</span>
                  <span style={{ ...S.stat, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Layers size={12} /> {c.num_scale || 1} scale</span>
                  {(c.num_piani_fuori_terra || c.num_piani_interrati || c.num_piani) && (
                    <span style={{ ...S.stat, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Grid size={12} /> 
                      {c.num_piani_fuori_terra != null || c.num_piani_interrati != null 
                        ? `${c.num_piani_fuori_terra || 0} f.t.${c.num_piani_interrati ? ` / ${c.num_piani_interrati} int.` : ''}`
                        : `${c.num_piani} piani`}
                    </span>
                  )}
                </div>

                {/* Badge stato */}
                <div style={{ display:'flex', justifyContent:'flex-end', marginTop:8 }}>
                  <span style={{ background:st.bg, color:st.text, fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:20 }}>
                    {st.label}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Form modal */}
      {showForm && (
        <CondominiForm
          condominio={editItem}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditItem(null) }}
        />
      )}
    </div>
  )
}

const S = {
  page:       { padding:'28px 32px', background: 'var(--app-bg)', minHeight:'100vh', fontFamily:'Sora, sans-serif' },
  toast:      { position:'fixed', top:20, right:20, zIndex:2000, color:'white', padding:'12px 20px', borderRadius:10, fontSize:14, fontWeight:600, boxShadow:'0 8px 24px rgba(0,0,0,0.4)' },
  header:     { display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:24 },
  title:      { color: 'var(--text-primary)', fontSize:26, fontWeight:700, margin:0 },
  subtitle:   { color: 'var(--text-muted)', fontSize:13, marginTop:4 },
  kpiRow:     { display:'flex', gap:14, marginBottom:24 },
  kpiCard:    { flex:1, background: 'var(--card-bg)', borderRadius:12, padding:'16px 20px', display:'flex', gap:14, alignItems:'center', border: '1px solid var(--border-color)' },
  kpiValue:   { color: 'var(--text-primary)', fontSize:22, fontWeight:700 },
  kpiLabel:   { color: 'var(--text-muted)', fontSize:12 },
  filters:    { display:'flex', gap:12, marginBottom:20 },
  search:     { flex:1, background: 'var(--card-bg)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius:10, padding:'10px 16px', fontSize:14, outline:'none' },
  select:     { background: 'var(--card-bg)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius:10, padding:'10px 14px', fontSize:14, outline:'none' },
  empty:      { textAlign:'center', padding:'80px 20px', color: 'var(--text-muted)' },
  grid:       { display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:16 },
  card:       { background: 'var(--card-bg)', borderRadius:14, padding:'18px 20px', border: '1px solid var(--border-color)', cursor:'pointer', transition:'border-color .2s, transform .15s' },
  cardHeader: { display:'flex', gap:12, alignItems:'flex-start', marginBottom:12 },
  cardIcon:   { fontSize:28, flexShrink:0 },
  cardTitle:  { color: 'var(--text-primary)', fontSize:15, fontWeight:700, marginBottom:2 },
  cardAddr:   { color: 'var(--text-muted)', fontSize:12 },
  cardStats:  { display:'flex', gap:12, flexWrap:'wrap' },
  stat:       { color: 'var(--text-secondary)', fontSize:12 },
  menuBtn:    { background:'none', border:'none', color: 'var(--text-muted)', fontSize:20, cursor:'pointer', padding:'2px 8px', borderRadius:6 },
  dropdown:   { position:'absolute', right:0, top:'100%', background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius:10, zIndex:100, minWidth:160, boxShadow:'0 8px 24px rgba(0,0,0,0.4)', overflow:'hidden' },
  ddItem:     { display:'block', width:'100%', background:'none', border:'none', color: 'var(--text-secondary)', fontSize:13, padding:'10px 16px', textAlign:'left', cursor:'pointer' },
  btnPrimary: { background:'#2563eb', color:'white', border:'none', borderRadius:8, padding:'10px 20px', fontSize:14, fontWeight:600, cursor:'pointer' },
}
