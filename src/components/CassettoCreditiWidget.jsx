// src/components/CassettoCreditiWidget.jsx
import React, { useState } from 'react'
import { Landmark, Sparkles, ArrowDownRight, CheckCircle2, ShieldCheck, Plus, X, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { toast } from 'react-hot-toast'

export default function CassettoCreditiWidget({ creditoDisponibile = 0, listaCrediti = [], condominioId, onRefresh }) {
  const [showAddModal, setShowAddModal] = useState(false)
  const [importoNuovoCredito, setImportoNuovoCredito] = useState('')
  const [descrizioneNuovoCredito, setDescrizioneNuovoCredito] = useState('')
  const [saving, setSaving] = useState(false)

  const handleAggiungiCreditoManuale = async (e) => {
    e.preventDefault()
    const val = parseFloat(importoNuovoCredito)
    if (!val || val <= 0 || !condominioId) {
      toast.error("Inserisci un importo valido per il credito.")
      return
    }

    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('f24_deleghe').insert([{
        condominio_id: condominioId,
        data_scadenza: new Date().toISOString().split('T')[0],
        data_pagamento: new Date().toISOString().split('T')[0],
        importo_totale: 0,
        credito_erario_generato: val,
        stato: 'pagato',
        tipo: 'credito_imposta',
        note: descrizioneNuovoCredito || `Credito d'imposta registrato manualmente (€ ${val.toFixed(2)})`,
        user_id: user.id
      }])

      if (error) throw error

      toast.success("Credito d'imposta aggiunto con successo al cassetto fiscale!")
      setShowAddModal(false)
      setImportoNuovoCredito('')
      setDescrizioneNuovoCredito('')
      if (onRefresh) onRefresh()
    } catch (err) {
      toast.error("Errore salvataggio credito: " + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={styles.iconBox}>
            <Landmark size={20} color="#10b981" />
          </div>
          <div>
            <h3 style={styles.title}>Cassetto Crediti Erario Condominiale</h3>
            <p style={styles.subtitle}>Crediti d'imposta e versamenti F24 in eccesso disponibili per compensazione</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={styles.saldoBox}>
            <span style={styles.saldoLabel}>Credito Disponibile:</span>
            <span style={styles.saldoVal}>€ {creditoDisponibile.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>
          </div>
          <button onClick={() => setShowAddModal(true)} style={styles.btnAdd}>
            <Plus size={14} /> Registra Credito
          </button>
        </div>
      </div>

      {listaCrediti.length > 0 ? (
        <div style={styles.creditiList}>
          {listaCrediti.map((cr, i) => (
            <div key={i} style={styles.creditoChip}>
              <ArrowDownRight size={14} color="#10b981" />
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>€ {cr.importo.toFixed(2)}</span>
              <span style={{ color: 'var(--text-secondary)' }}>• {cr.descrizione}</span>
            </div>
          ))}
        </div>
      ) : (
        <div style={styles.emptyNote}>
          Nessun credito d'imposta residuo per il condominio selezionato. I versamenti in eccedenza verranno accreditati qui automaticamente.
        </div>
      )}

      {/* Modal Aggiungi Credito */}
      {showAddModal && (
        <div style={styles.overlay}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Registra Credito Fiscale</h3>
              <button onClick={() => setShowAddModal(false)} style={styles.closeBtn}><X size={18} /></button>
            </div>
            <form onSubmit={handleAggiungiCreditoManuale} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={styles.label}>Importo Credito (€) *</label>
                <input 
                  type="number" 
                  step="0.01" 
                  min="0.01" 
                  required
                  value={importoNuovoCredito} 
                  onChange={e => setImportoNuovoCredito(e.target.value)}
                  placeholder="Es. 150.00"
                  style={styles.input}
                />
              </div>
              <div>
                <label style={styles.label}>Descrizione / Motivo del Credito</label>
                <input 
                  type="text" 
                  value={descrizioneNuovoCredito} 
                  onChange={e => setDescrizioneNuovoCredito(e.target.value)}
                  placeholder="Es. Credito da dichiarazione 770 anno precedente o bonus"
                  style={styles.input}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button type="button" onClick={() => setShowAddModal(false)} style={styles.btnSecondary}>Annulla</button>
                <button type="submit" disabled={saving} style={styles.btnPrimary}>
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
                  {saving ? 'Salvataggio...' : 'Conferma Credito'}
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
  container: {
    background: 'var(--card-bg)', border: '1px solid var(--border-color)',
    borderRadius: 12, padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12,
    boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12
  },
  iconBox: {
    background: '#10b98115', padding: 8, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center'
  },
  title: { margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' },
  subtitle: { margin: '2px 0 0', fontSize: 12, color: 'var(--text-secondary)' },
  saldoBox: {
    background: 'var(--app-bg)', border: '1px solid var(--border-color)',
    padding: '6px 14px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 8
  },
  saldoLabel: { fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 },
  saldoVal: { fontSize: 15, fontWeight: 800, color: '#10b981' },
  btnAdd: {
    background: 'transparent', border: '1px dashed #10b981', color: '#10b981',
    padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', gap: 6
  },
  creditiList: {
    display: 'flex', flexWrap: 'wrap', gap: 8, paddingTop: 6, borderTop: '1px solid var(--border-color)'
  },
  creditoChip: {
    background: 'var(--app-bg)', border: '1px solid var(--border-color)',
    borderRadius: 6, padding: '4px 10px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6
  },
  emptyNote: {
    fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', paddingTop: 4
  },
  overlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16
  },
  modal: {
    background: 'var(--card-bg)', border: '1px solid var(--border-color)',
    borderRadius: 14, width: '100%', maxWidth: 440, overflow: 'hidden', boxShadow: '0 16px 32px rgba(0,0,0,0.3)'
  },
  modalHeader: {
    padding: '16px 20px', borderBottom: '1px solid var(--border-color)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between'
  },
  closeBtn: { background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 },
  input: {
    width: '100%', padding: '9px 12px', background: 'var(--app-bg)',
    border: '1px solid var(--border-color)', borderRadius: 8, color: 'var(--text-primary)',
    fontFamily: 'inherit', fontSize: 13, boxSizing: 'border-box'
  },
  btnSecondary: {
    padding: '8px 14px', background: 'transparent', border: '1px solid var(--border-color)',
    borderRadius: 6, color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer'
  },
  btnPrimary: {
    padding: '8px 16px', background: '#10b981', border: 'none',
    borderRadius: 6, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 6
  }
}
