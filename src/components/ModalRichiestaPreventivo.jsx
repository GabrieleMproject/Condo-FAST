import React, { useState } from 'react'
import { X, Send, Store, ShieldCheck, CheckCircle2 } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { creaRichiestaPreventivo } from '../lib/partnerEngine'

export default function ModalRichiestaPreventivo({ condominio, onClose, onSuccess }) {
  const [categoria, setCategoria] = useState('manutenzione')
  const [titolo, setTitolo] = useState('')
  const [descrizione, setDescrizione] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [inviataSuccesso, setInviataSuccesso] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!titolo.trim() || !descrizione.trim()) {
      toast.error("Compilare il titolo e il dettaglio della richiesta.")
      return
    }

    setSubmitting(true)
    try {
      await creaRichiestaPreventivo({
        condominio_id: condominio?.id || null,
        categoria,
        provincia: condominio?.provincia || 'MI',
        titolo,
        descrizione,
        stato: 'inviata'
      })

      toast.success("Richiesta preventivo inoltrata al Partner Convenzionato di zona!")
      setInviataSuccesso(true)
      if (onSuccess) onSuccess()
    } catch (err) {
      toast.error("Errore invio richiesta: " + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={styles.backdrop} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={styles.iconCircle}>
              <Store size={20} color="#2563eb" />
            </div>
            <div>
              <h3 style={styles.title}>Richiedi Preventivo Gratuito (Partner Convenzionato)</h3>
              <p style={styles.subtitle}>
                {condominio ? `Condominio: ${condominio.nome} (${condominio.provincia || 'MI'})` : 'Servizio per il tuo condominio'}
              </p>
            </div>
          </div>
          <button onClick={onClose} style={styles.closeBtn}>
            <X size={18} />
          </button>
        </div>

        {inviataSuccesso ? (
          <div style={{ textAlign: 'center', padding: '30px 20px' }}>
            <CheckCircle2 size={48} color="#10b981" style={{ margin: '0 auto 16px auto' }} />
            <h4 style={{ margin: '0 0 8px 0', fontSize: 18, color: 'var(--text-primary)' }}>Richiesta Inviata con Successo!</h4>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
              Il fornitore partner qualificato della tua provincia ha ricevuto i dettagli della richiesta e ti ricontatterà al più presto.
            </p>
            <button onClick={onClose} style={styles.btnPrimary}>
              Chiudi
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 16 }}>
            <div style={styles.banner}>
              <ShieldCheck size={18} color="#10b981" />
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                Fornitori verificati per regolarità contributiva (DURC) e copertura assicurativa RCT nella provincia di <strong>{condominio?.provincia || 'riferimento'}</strong>.
              </span>
            </div>

            <div>
              <label style={styles.label}>Categoria Intervento / Servizio</label>
              <select
                value={categoria}
                onChange={e => setCategoria(e.target.value)}
                style={styles.select}
              >
                <option value="manutenzione">Manutenzione Generale</option>
                <option value="idraulico">Idraulico & Termoidraulica</option>
                <option value="elettricista">Elettricista & Impianti</option>
                <option value="spurghi">Spurghi & Fognature</option>
                <option value="ascensori">Ascensori & Elevatori</option>
                <option value="pulizie">Pulizie & Giardinaggio</option>
                <option value="assicurazioni">Polizza Globale Fabbricato</option>
                <option value="energia">Forniture Luce & Gas</option>
                <option value="altro">Altro</option>
              </select>
            </div>

            <div>
              <label style={styles.label}>Oggetto della richiesta *</label>
              <input
                type="text"
                required
                placeholder="Es. Riparazione perdita colonna di scarico o Preventivo Pulizia Scale"
                value={titolo}
                onChange={e => setTitolo(e.target.value)}
                style={styles.input}
              />
            </div>

            <div>
              <label style={styles.label}>Dettagli del lavoro / Capitolato sintetico *</label>
              <textarea
                required
                placeholder="Descrivi l'intervento necessario, urgenza o preferenze di contatto..."
                value={descrizione}
                onChange={e => setDescrizione(e.target.value)}
                style={styles.textarea}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 10 }}>
              <button type="button" onClick={onClose} style={styles.btnSecondary}>
                Annulla
              </button>
              <button type="submit" disabled={submitting} style={styles.btnPrimary}>
                <Send size={15} /> {submitting ? 'Inoltro...' : 'Invia Richiesta al Partner'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

const styles = {
  backdrop: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 },
  modal: { background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: 16, padding: 24, width: '90%', maxWidth: 580, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)', fontFamily: 'Sora, sans-serif' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: 14 },
  iconCircle: { width: 38, height: 38, borderRadius: 10, background: 'rgba(37, 99, 235, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  title: { margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' },
  subtitle: { margin: '2px 0 0 0', fontSize: 12, color: 'var(--text-secondary)' },
  closeBtn: { background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' },
  banner: { display: 'flex', alignItems: 'center', gap: 10, padding: 10, background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: 8 },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 },
  input: { width: '100%', padding: '10px 12px', background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-primary)', fontFamily: 'Sora, sans-serif', fontSize: 13, boxSizing: 'border-box', outline: 'none' },
  select: { width: '100%', padding: '10px 12px', background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-primary)', fontFamily: 'Sora, sans-serif', fontSize: 13, boxSizing: 'border-box', outline: 'none' },
  textarea: { width: '100%', padding: '10px 12px', background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-primary)', fontFamily: 'Sora, sans-serif', fontSize: 13, boxSizing: 'border-box', outline: 'none', minHeight: 90, resize: 'vertical' },
  btnPrimary: { display: 'inline-flex', alignItems: 'center', gap: 8, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Sora, sans-serif' },
  btnSecondary: { display: 'inline-flex', alignItems: 'center', gap: 8, background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Sora, sans-serif' }
}
