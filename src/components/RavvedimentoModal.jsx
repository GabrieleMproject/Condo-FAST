// src/components/RavvedimentoModal.jsx
import React, { useState, useMemo } from 'react'
import { X, AlertTriangle, Calculator, Calendar, CheckCircle2, ShieldCheck, Sparkles, Loader2, Landmark } from 'lucide-react'
import { calcolaRavvedimentoCompleto } from '../lib/ravvedimentoEngine'
import { supabase } from '../lib/supabaseClient'
import { toast } from 'react-hot-toast'

export default function RavvedimentoModal({ isOpen, onClose, defaultData = {}, condomini = [], onSuccess }) {
  if (!isOpen) return null

  const [condominioId, setCondominioId] = useState(defaultData.condominio_id || (condomini[0]?.id || ''))
  const [importoImposta, setImportoImposta] = useState(defaultData.importo || defaultData.differenza || 100)
  const [codiceTributo, setCodiceTributo] = useState(defaultData.codice_tributo || '1019')
  const [dataScadenza, setDataScadenza] = useState(defaultData.data_scadenza || new Date(new Date().setMonth(new Date().getMonth() - 1, 16)).toISOString().split('T')[0])
  const [dataVersamento, setDataVersamento] = useState(new Date().toISOString().split('T')[0])
  const [isSaving, setIsSaving] = useState(false)

  const calcolo = useMemo(() => {
    try {
      return calcolaRavvedimentoCompleto({
        importoImposta,
        codiceTributo,
        dataScadenza,
        dataVersamento
      })
    } catch (e) {
      return null
    }
  }, [importoImposta, codiceTributo, dataScadenza, dataVersamento])

  const handleCreaDelegaF24 = async () => {
    if (!calcolo || !condominioId) {
      toast.error("Compila tutti i campi obbligatori.")
      return
    }

    setIsSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Utente non autenticato.")

      // 1. Inserisce la testata della delega F24 di ravvedimento
      const { data: delega, error: errDelega } = await supabase
        .from('f24_deleghe')
        .insert([{
          condominio_id: condominioId,
          data_scadenza: calcolo.dataVersamentoPrevista,
          importo_totale: calcolo.importoTotaleF24,
          stato: 'da_pagare',
          tipo: 'ravvedimento_operoso',
          note: `Ravvedimento Operoso (${calcolo.tipologiaRavvedimento}) - Imposta: €${calcolo.imposta.toFixed(2)}, Sanzione: €${calcolo.importoSanzione.toFixed(2)}, Interessi: €${calcolo.importoInteressi.toFixed(2)}`,
          user_id: user.id
        }])
        .select()
        .single()

      if (errDelega) throw errDelega

      // 2. Inserisce i dettagli tributi (imposta + 8911 + 1992)
      const tributiDaInserire = calcolo.righeTributiF24.map(t => ({
        f24_id: delega.id,
        codice_tributo: t.codice_tributo,
        mese_riferimento: t.mese_riferimento,
        anno_riferimento: t.anno_riferimento,
        importo: t.importo,
        user_id: user.id
      }))

      const { error: errTributi } = await supabase
        .from('f24_dettagli_tributi')
        .insert(tributiDaInserire)

      if (errTributi) throw errTributi

      toast.success("Delega F24 di Ravvedimento creata con successo! Disponibile nello Scadenzario e per la Distinta CBI.")
      if (onSuccess) onSuccess()
      onClose()
    } catch (err) {
      console.error("Errore salvataggio ravvedimento:", err)
      toast.error("Errore creazione F24: " + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const condoSelezionato = condomini.find(c => c.id === condominioId)

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        {/* Header */}
        <div style={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ background: '#f59e0b20', padding: 10, borderRadius: 10, color: '#f59e0b' }}>
              <Calculator size={24} />
            </div>
            <div>
              <h2 style={styles.title}>Calcolatore Ravvedimento Operoso F24</h2>
              <p style={styles.subtitle}>Calcolo automatico sanzioni ridotte (art. 13 D.Lgs. 472/97) e interessi legali</p>
            </div>
          </div>
          <button onClick={onClose} style={styles.closeBtn}><X size={20} /></button>
        </div>

        {/* Body Form */}
        <div style={styles.body}>
          <div style={styles.grid2}>
            <div>
              <label style={styles.label}>Condominio *</label>
              <select 
                value={condominioId} 
                onChange={e => setCondominioId(e.target.value)}
                style={styles.select}
              >
                {condomini.map(c => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={styles.label}>Codice Tributo Imposta Base *</label>
              <select 
                value={codiceTributo} 
                onChange={e => setCodiceTributo(e.target.value)}
                style={styles.select}
              >
                <option value="1019">1019 (Contratti d'appalto 4% - IRPEF)</option>
                <option value="1020">1020 (Contratti d'opera 4% - IRES)</option>
                <option value="1040">1040 (Lavoro autonomo / Professionisti 20%)</option>
                <option value="1038">1038 (Provvigioni agenti / mediatori)</option>
              </select>
            </div>
          </div>

          <div style={styles.grid3}>
            <div>
              <label style={styles.label}>Imposta non versata (€) *</label>
              <input 
                type="number" 
                step="0.01" 
                min="0.01" 
                value={importoImposta} 
                onChange={e => setImportoImposta(parseFloat(e.target.value) || 0)}
                style={styles.input}
              />
            </div>
            <div>
              <label style={styles.label}>Scadenza originaria (16 del mese) *</label>
              <input 
                type="date" 
                value={dataScadenza} 
                onChange={e => setDataScadenza(e.target.value)}
                style={styles.input}
              />
            </div>
            <div>
              <label style={styles.label}>Data prevista versamento *</label>
              <input 
                type="date" 
                value={dataVersamento} 
                onChange={e => setDataVersamento(e.target.value)}
                style={styles.input}
              />
            </div>
          </div>

          {/* Prospetto Calcolo Dinamico */}
          {calcolo && (
            <div style={styles.calcBox}>
              <div style={styles.scaglioneBadge}>
                <Sparkles size={14} /> {calcolo.tipologiaRavvedimento} • {calcolo.giorniRitardo} giorni di ritardo
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 16px' }}>{calcolo.norma}</p>

              <div style={styles.tableRiepilogo}>
                <div style={styles.tableRow}>
                  <span style={{ color: 'var(--text-secondary)' }}>Imposta base dovuta (Cod. {calcolo.codiceTributo}):</span>
                  <strong>€ {calcolo.imposta.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</strong>
                </div>
                <div style={styles.tableRow}>
                  <span style={{ color: 'var(--text-secondary)' }}>Sanzione ridotta ({calcolo.percentualeSanzione}% - Cod. 8911):</span>
                  <strong style={{ color: '#f59e0b' }}>+ € {calcolo.importoSanzione.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</strong>
                </div>
                <div style={styles.tableRow}>
                  <span style={{ color: 'var(--text-secondary)' }}>Interessi legali moratori (Cod. 1992):</span>
                  <strong style={{ color: '#f59e0b' }}>+ € {calcolo.importoInteressi.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</strong>
                </div>
                <div style={{ ...styles.tableRow, borderTop: '1px solid var(--border-color)', paddingTop: 10, marginTop: 6 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>Totale Delega F24 da Versare:</span>
                  <span style={{ fontSize: 18, fontWeight: 800, color: '#10b981' }}>€ {calcolo.importoTotaleF24.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              <div style={{ marginTop: 16, background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: 12, borderRadius: 8, fontSize: 13, color: '#059669', display: 'flex', alignItems: 'center', gap: 10 }}>
                <ShieldCheck size={18} style={{ flexShrink: 0 }} />
                <span>Il versamento estingue completamente la violazione ed evita le sanzioni ordinarie del 30% dell'Agenzia delle Entrate.</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <button onClick={onClose} style={styles.btnSecondary} disabled={isSaving}>Annulla</button>
          <button onClick={handleCreaDelegaF24} style={styles.btnPrimary} disabled={isSaving || !calcolo}>
            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Landmark size={16} />}
            {isSaving ? 'Salvataggio...' : 'Crea Delega F24 di Ravvedimento'}
          </button>
        </div>
      </div>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 9999, padding: 16
  },
  modal: {
    background: 'var(--card-bg)', border: '1px solid var(--border-color)',
    borderRadius: 16, width: '100%', maxWidth: 640,
    boxShadow: '0 20px 40px rgba(0,0,0,0.3)', overflow: 'hidden',
    display: 'flex', flexDirection: 'column'
  },
  header: {
    padding: '20px 24px', borderBottom: '1px solid var(--border-color)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between'
  },
  title: { margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' },
  subtitle: { margin: '4px 0 0', fontSize: 13, color: 'var(--text-secondary)' },
  closeBtn: {
    background: 'transparent', border: 'none', color: 'var(--text-muted)',
    cursor: 'pointer', padding: 4, borderRadius: 6
  },
  body: { padding: 24, display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '80vh', overflowY: 'auto' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  grid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 },
  input: {
    width: '100%', padding: '10px 12px', background: 'var(--app-bg)',
    border: '1px solid var(--border-color)', borderRadius: 8,
    color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: 14, boxSizing: 'border-box'
  },
  select: {
    width: '100%', padding: '10px 12px', background: 'var(--app-bg)',
    border: '1px solid var(--border-color)', borderRadius: 8,
    color: 'var(--text-primary)', fontFamily: 'inherit', fontSize: 14, boxSizing: 'border-box'
  },
  calcBox: {
    background: 'var(--app-bg)', border: '1px solid var(--border-color)',
    borderRadius: 12, padding: 18, marginTop: 8
  },
  scaglioneBadge: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: '#f59e0b15', color: '#d97706', border: '1px solid #f59e0b40',
    padding: '4px 10px', borderRadius: 20, fontSize: 13, fontWeight: 700
  },
  tableRiepilogo: { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 },
  tableRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14 },
  footer: {
    padding: '16px 24px', borderTop: '1px solid var(--border-color)',
    display: 'flex', justifyContent: 'flex-end', gap: 12, background: 'var(--app-bg)'
  },
  btnSecondary: {
    padding: '10px 18px', background: 'transparent', border: '1px solid var(--border-color)',
    borderRadius: 8, color: 'var(--text-primary)', fontSize: 14, fontWeight: 600, cursor: 'pointer'
  },
  btnPrimary: {
    padding: '10px 20px', background: '#10b981', border: 'none',
    borderRadius: 8, color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
  }
}
