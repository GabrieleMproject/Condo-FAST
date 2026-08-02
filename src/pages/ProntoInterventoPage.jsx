import React, { useState, useEffect } from 'react'
import { 
  PhoneCall, ShieldAlert, MapPin, Phone, MessageSquare, Send, 
  Search, ShieldCheck, CheckCircle2, Clock, Zap, AlertCircle, Wrench
} from 'lucide-react'
import { fetchFornitoriPartner } from '../lib/partnerEngine'
import ModalRichiestaPreventivo from '../components/ModalRichiestaPreventivo'
import { toast } from 'react-hot-toast'

const PROVINCE_ITALIANE = [
  'tutte', 'AG', 'AL', 'AN', 'AO', 'AR', 'AP', 'AT', 'AV', 'BA', 'BT', 'BL', 'BN', 'BG', 'BI', 'BO', 'BZ', 'BS', 'BR', 'CA', 'CL', 'CB', 'CE', 'CT', 'CZ', 'CH', 'CO', 'CS', 'CR', 'KR', 'CN', 'EN', 'FM', 'FE', 'FI', 'FG', 'FC', 'FR', 'GE', 'GO', 'GR', 'IM', 'IS', 'SP', 'AQ', 'LT', 'LE', 'LC', 'LI', 'LO', 'LU', 'MC', 'MN', 'MS', 'MT', 'ME', 'MI', 'MO', 'MB', 'NO', 'NU', 'OR', 'PD', 'PA', 'PR', 'PV', 'PG', 'PU', 'PE', 'PC', 'PI', 'PT', 'PN', 'PZ', 'PO', 'RG', 'RA', 'RC', 'RE', 'RI', 'RN', 'RM', 'RO', 'SA', 'SS', 'SV', 'SI', 'SR', 'SO', 'SU', 'TA', 'TE', 'TR', 'TO', 'TP', 'TN', 'TV', 'TS', 'UD', 'VA', 'VE', 'VB', 'VC', 'VR', 'VV', 'VI', 'VT'
]

const CATEGORIE_URGENZA = [
  { id: 'tutte', label: 'Tutte le Urgenze', icon: Wrench },
  { id: 'spurghi', label: 'Spurghi & Allagamenti H24', icon: ShieldAlert },
  { id: 'idraulico', label: 'Emergenza Idraulica & Tubi', icon: Zap },
  { id: 'elettricista', label: 'Guasti Elettrici Parti Comuni', icon: Zap },
  { id: 'ascensori', label: 'Ascensori & Elevatori', icon: AlertCircle },
  { id: 'pulizie', label: 'Sanificazioni & Pulizie', icon: CheckCircle2 },
  { id: 'altro', label: 'Altre Manutenzioni', icon: Wrench }
]

export default function ProntoInterventoPage() {
  const [partnerList, setPartnerList] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedProvincia, setSelectedProvincia] = useState('MI')
  const [selectedCategoria, setSelectedCategoria] = useState('tutte')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPartnerModal, setSelectedPartnerModal] = useState(null)

  useEffect(() => {
    loadPartners()
  }, [])

  const loadPartners = async () => {
    setLoading(true)
    try {
      const data = await fetchFornitoriPartner()
      setPartnerList(data.filter(p => p.attivo))
    } catch (err) {
      toast.error("Errore caricamento fornitori pronto intervento: " + err.message)
    } finally {
      setLoading(false)
    }
  }

  const partnerFiltrati = partnerList.filter(p => {
    const matchProv = selectedProvincia === 'tutte' || p.provincia_esclusiva?.toUpperCase() === selectedProvincia.toUpperCase()
    const matchCat = selectedCategoria === 'tutte' || p.categoria === selectedCategoria
    const matchSearch = !searchQuery || (
      p.ragione_sociale?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.partita_iva?.includes(searchQuery) ||
      p.referente_nome?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    return matchProv && matchCat && matchSearch
  })

  return (
    <div style={styles.page}>
      {/* Header Banner H24 */}
      <div style={styles.headerBanner}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={styles.iconBadge}>
            <PhoneCall size={28} color="#fff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 style={styles.title}>Pronto Intervento H24 & Reperibilità</h1>
              <span style={styles.badgeH24}>REPERIBILITÀ ATTIVA</span>
            </div>
            <p style={styles.subtitle}>
              Contatti diretti e numeri d'emergenza dei fornitori convenzionati e verificati per la tua provincia.
            </p>
          </div>
        </div>
      </div>

      {/* Filtri Provincia & Categoria */}
      <div style={styles.filtersBar}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <MapPin size={16} color="var(--primary)" />
            <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Provincia:</label>
          </div>
          <select
            value={selectedProvincia}
            onChange={e => setSelectedProvincia(e.target.value)}
            style={styles.selectProvincia}
          >
            {PROVINCE_ITALIANE.map(p => (
              <option key={p} value={p}>
                {p === 'tutte' ? 'Tutte le Province' : `Provincia di ${p}`}
              </option>
            ))}
          </select>

          <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
            <Search size={15} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              type="text"
              placeholder="Cerca fornitore o servizio d'emergenza..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={styles.searchInput}
            />
          </div>
        </div>
      </div>

      {/* Bar Categorie Urgenza */}
      <div style={styles.categoriesRow}>
        {CATEGORIE_URGENZA.map(cat => {
          const IconComponent = cat.icon
          const isSelected = selectedCategoria === cat.id
          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategoria(cat.id)}
              style={{ ...styles.categoryBtn, ...(isSelected ? styles.categoryBtnActive : {}) }}
            >
              <IconComponent size={14} />
              <span>{cat.label}</span>
            </button>
          )
        })}
      </div>

      {/* Griglia Schede Fornitori */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          Caricamento rubrica pronto intervento in corso...
        </div>
      ) : (
        <div style={styles.grid}>
          {partnerFiltrati.map(partner => (
            <div key={partner.id} style={styles.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <span style={styles.provinciaBadge}>{partner.provincia_esclusiva}</span>
                  <span style={styles.categoriaTag}>{partner.categoria}</span>
                </div>
                <span style={styles.verifiedBadge}>
                  <ShieldCheck size={13} /> Partner H24
                </span>
              </div>

              <h3 style={styles.cardTitle}>{partner.ragione_sociale}</h3>
              {partner.referente_nome && (
                <div style={styles.referenteText}>Referente: {partner.referente_nome}</div>
              )}
              <div style={styles.pivaText}>P.IVA: {partner.partita_iva}</div>

              {/* Box Contatti Reperibilità */}
              <div style={styles.contactsBox}>
                {partner.telefono && (
                  <div style={styles.contactRow}>
                    <Phone size={14} color="#10b981" />
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{partner.telefono}</span>
                  </div>
                )}
                {partner.email && (
                  <div style={styles.contactRow}>
                    <Send size={13} color="#3b82f6" />
                    <span>{partner.email}</span>
                  </div>
                )}
              </div>

              {/* Pulsanti Azione Rapida */}
              <div style={styles.cardActions}>
                {partner.telefono ? (
                  <a
                    href={`tel:${partner.telefono}`}
                    style={styles.btnCall}
                  >
                    <Phone size={15} /> Chiama Subito
                  </a>
                ) : null}

                {partner.telefono ? (
                  <a
                    href={`https://wa.me/${partner.telefono.replace(/\D/g, '')}?text=${encodeURIComponent('Emergenza Condominio — Richiesta intervento immediato da Amministratore')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={styles.btnWhatsapp}
                  >
                    <MessageSquare size={15} /> WhatsApp
                  </a>
                ) : null}

                <button
                  onClick={() => setSelectedPartnerModal(partner)}
                  style={styles.btnPreventivo}
                >
                  Invia Scheda
                </button>
              </div>
            </div>
          ))}

          {partnerFiltrati.length === 0 && (
            <div style={styles.emptyCard}>
              <AlertCircle size={36} color="#f59e0b" style={{ margin: '0 auto 12px auto' }} />
              <h3 style={{ margin: '0 0 6px 0', fontSize: 16, color: 'var(--text-primary)' }}>
                Nessun fornitore Pioneer convenzionato nella provincia di {selectedProvincia}
              </h3>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 500, margin: '0 auto 16px auto' }}>
                Stiamo espandendo la rete dei fornitori d'emergenza in tutta Italia. Se hai un fornitore di fiducia per la provincia di <strong>{selectedProvincia}</strong>, segnalalo per concedergli l'esclusiva H24.
              </p>
              <button
                onClick={() => setSelectedProvincia('tutte')}
                style={styles.btnResetFiltri}
              >
                Mostra Fornitori di tutte le Province
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modale Richiesta Preventivo / Scheda Intervento */}
      {selectedPartnerModal && (
        <ModalRichiestaPreventivo
          condominio={{ provincia: selectedPartnerModal.provincia_esclusiva }}
          onClose={() => setSelectedPartnerModal(null)}
        />
      )}
    </div>
  )
}

const styles = {
  page: { padding: '24px 32px', maxWidth: 1400, margin: '0 auto', fontFamily: 'Sora, sans-serif' },
  headerBanner: { background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', border: '1px solid var(--border-color)', borderRadius: 16, padding: '24px 28px', color: '#fff', marginBottom: 24, boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.2)' },
  iconBadge: { width: 52, height: 52, borderRadius: 14, background: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  title: { fontSize: 24, fontWeight: 700, margin: 0, color: '#fff' },
  badgeH24: { background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.4)', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 800, letterSpacing: '0.05em' },
  subtitle: { fontSize: 13, color: '#94a3b8', margin: '4px 0 0 0' },
  filtersBar: { background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 14, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 16 },
  selectProvincia: { background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '8px 12px', color: 'var(--text-primary)', fontFamily: 'Sora, sans-serif', fontSize: 13, fontWeight: 600, outline: 'none', cursor: 'pointer' },
  searchInput: { background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '8px 12px 8px 34px', color: 'var(--text-primary)', fontFamily: 'Sora, sans-serif', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' },
  categoriesRow: { display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 8, marginBottom: 24 },
  categoryBtn: { display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', whiteSpace: 'nowrap' },
  categoryBtnActive: { background: '#2563eb', color: '#fff', borderColor: '#2563eb' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 },
  card: { background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' },
  provinciaBadge: { padding: '3px 8px', borderRadius: 6, background: '#2563eb15', color: '#3b82f6', fontWeight: 800, fontSize: 12, marginRight: 8 },
  categoriaTag: { fontSize: 12, textTransform: 'capitalize', color: 'var(--text-secondary)', fontWeight: 600 },
  verifiedBadge: { display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700 },
  cardTitle: { margin: '8px 0 4px 0', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' },
  referenteText: { fontSize: 12, color: 'var(--text-secondary)', marginBottom: 2 },
  pivaText: { fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)', marginBottom: 12 },
  contactsBox: { background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 },
  contactRow: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-primary)' },
  cardActions: { display: 'flex', gap: 8, alignItems: 'center' },
  btnCall: { flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#10b981', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 12px', fontSize: 12, fontWeight: 700, textDecoration: 'none', textAlign: 'center' },
  btnWhatsapp: { flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: '#25D366', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 12px', fontSize: 12, fontWeight: 700, textDecoration: 'none', textAlign: 'center' },
  btnPreventivo: { background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '9px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  emptyCard: { gridColumn: '1 / -1', background: 'var(--card-bg)', border: '1px dashed var(--border-color)', borderRadius: 16, padding: 40, textAlign: 'center' },
  btnResetFiltri: { background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Sora, sans-serif' }
}
