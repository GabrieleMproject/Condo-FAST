import React, { useState } from 'react'
import { X, BookOpen, Sparkles, Upload, Receipt, LandPlot, FileSpreadsheet, Mail, CheckCircle2 } from 'lucide-react'

export default function GuidaRapidaModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('import')

  if (!isOpen) return null

  const guideTabs = [
    {
      id: 'import',
      label: '1. Importazione AI',
      icon: Upload,
      title: 'Come importare i tuoi dati in 1 click con l\'IA',
      badge: 'PROCESSO INIZIALE',
      steps: [
        'Dalla barra laterale, seleziona "Migrazione AI" o "Nuovo Condominio".',
        'Trascina il file Excel/CSV o PDF esportato dal tuo vecchio gestionale (es. PGC, Domustudio, Brainware).',
        'L\'IA di Gemini analizzerà automaticamente la struttura ed estrarrà nomi, codici fiscali, unità e millesimi.',
        'Verifica l\'anteprima estratta nella modale e clicca "Conferma ed Importa" per popolare il database.'
      ],
      tip: 'Puoi caricare anche foto o scansioni di schede cartacee: l\'IA estrae i dati catastali senza errori di battitura!'
    },
    {
      id: 'spese',
      label: '2. Spese & Fatture',
      icon: Receipt,
      title: 'Registrazione Spese e Lettura Automatica OCR',
      badge: 'GESTIONE CONTABILE',
      steps: [
        'Entra nel condominio desiderato e clicca sul tab "Spese & Fatture".',
        'Clicca su "+ Nuova Spesa" oppure trascina direttamente il PDF della fattura/scontrino.',
        'L\'IA compila in automatico: Fornitore, Importo Totale, Data Spesa e Ritenuta d\'Acconto (se presente).',
        'Seleziona la tabella millesimale (es. Proprietà generale o Ascensore) per ripartire la spesa in quota per ciascuna unità.'
      ],
      tip: 'Se una fattura contiene la ritenuta del 4% (F24), CondoSmart calcola automaticamente il netto a pagare e registra la scadenza F24 per il 16 del mese successivo.'
    },
    {
      id: 'banca',
      label: '3. Estratto Conto',
      icon: LandPlot,
      title: 'Riconciliazione Bancaria Automatica',
      badge: 'INCASSI E PAGAMENTI',
      steps: [
        'Accedi alla sezione "Estratto Conto" dal condominio corrente.',
        'Importa l\'estratto conto bancario in formato Excel o CSV (oppure colleghi l\'Home Banking).',
        'Clicca su "Riconciliazioni Entrate" o "Riconciliazioni Uscite": il sistema associa ogni bonifico alla rata del condomino o alla fattura del fornitore.',
        'Conferma gli abbinamenti con un solo click.'
      ],
      tip: 'In caso di pagamenti parziali, l\'IA propone l\'abbinamento calcolando automaticamente il residuo da saldare per l\'unità.'
    },
    {
      id: 'consuntivo',
      label: '4. Consuntivo PDF',
      icon: FileSpreadsheet,
      title: 'Generazione Rendiconto & Consuntivo Ufficiale',
      badge: 'REPORTISTICA',
      steps: [
        'Vai nel tab "Preventivo & Consuntivo" del condominio.',
        'Verifica che tutte le spese ed incassi dell\'esercizio siano registrati.',
        'Clicca su "Stampa Consuntivo PDF": verrà generato il prospetto ufficiale strutturato secondo le sezioni A, B, C, D, E dell\'art. 1130-bis c.c.',
        'Il PDF include il logo del tuo studio, l\'intestazione personalizzata e la quadratura di cassa automatica.'
      ],
      tip: 'Il consuntivo in PDF Landscape è ottimizzato per la stampa e pronto per la notifica e l\'approvazione in assemblea.'
    },
    {
      id: 'solleciti',
      label: '5. Solleciti Rate',
      icon: Mail,
      title: 'Solleciti Automatizzati & Gestione Morosità',
      badge: 'COMUNICAZIONI',
      steps: [
        'Accedi al tab "Preventivo & Rate" -> "Griglia Rate".',
        'Clicca sulla singola rata o utilizza il pulsante "Invia Solleciti Massivi" per le rate scadute da oltre 10 giorni.',
        'L\'IA genera una lettera di sollecito personalizzata con l\'estratto conto aggiornato dell\'unità.',
        'Invia direttamente via email (via Resend) o scarica il PDF pronto da inviare a mezzo raccomandata.'
      ],
      tip: 'Il condomino riceverà un\'email professionale contenente le coordinate bancarie IBAN e il riepilogo preciso delle quote insolute.'
    }
  ]

  const currentGuide = guideTabs.find(t => t.id === activeTab) || guideTabs[0]

  return (
    <div style={styles.overlay}>
      <div style={styles.modalCard}>
        <div style={styles.header}>
          <div style={styles.headerTitle}>
            <BookOpen size={22} color="var(--primary-color, #3b82f6)" />
            <h3 style={styles.title}>Centro Guida Rapida & Video Pillole</h3>
          </div>
          <button onClick={onClose} style={styles.btnClose}>
            <X size={20} />
          </button>
        </div>

        <div style={styles.tabsRow}>
          {guideTabs.map(tab => {
            const IconComp = tab.icon
            const isActive = tab.id === activeTab
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  ...styles.tabBtn,
                  borderColor: isActive ? 'var(--primary-color, #2563eb)' : 'transparent',
                  background: isActive ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
                  color: isActive ? 'var(--primary-color, #3b82f6)' : 'var(--text-secondary)'
                }}
              >
                <IconComp size={16} />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>

        <div style={styles.bodyContent}>
          <div style={styles.titleGroup}>
            <span style={styles.badge}>{currentGuide.badge}</span>
            <h3 style={styles.guideTitle}>{currentGuide.title}</h3>
          </div>

          <div style={styles.stepsContainer}>
            {currentGuide.steps.map((st, idx) => (
              <div key={idx} style={styles.stepItem}>
                <div style={styles.stepBadge}>{idx + 1}</div>
                <div style={styles.stepText}>{st}</div>
              </div>
            ))}
          </div>

          <div style={styles.tipBox}>
            <Sparkles size={18} color="#eab308" style={{ flexShrink: 0, marginTop: 2 }} />
            <div style={styles.tipText}>{currentGuide.tip}</div>
          </div>
        </div>

        <div style={styles.footer}>
          <button onClick={onClose} style={styles.btnDone}>
            <CheckCircle2 size={16} style={{ marginRight: 6 }} />
            Ho Capito, Torna al Gestionale
          </button>
        </div>
      </div>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    backdropFilter: 'blur(4px)',
    zIndex: 99999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px'
  },
  modalCard: {
    background: 'var(--card-bg)',
    border: '1px solid var(--border-color)',
    borderRadius: '20px',
    maxWidth: '720px',
    width: '100%',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)'
  },
  header: {
    padding: '20px 24px',
    borderBottom: '1px solid var(--border-color)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  headerTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: '700',
    color: 'var(--text-primary)'
  },
  btnClose: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    padding: '4px'
  },
  tabsRow: {
    display: 'flex',
    overflowX: 'auto',
    borderBottom: '1px solid var(--border-color)',
    background: 'var(--app-bg)',
    padding: '8px 16px',
    gap: '6px'
  },
  tabBtn: {
    border: '1px solid transparent',
    borderRadius: '8px',
    padding: '8px 14px',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    whiteSpace: 'nowrap',
    transition: 'all 0.2s ease'
  },
  bodyContent: {
    padding: '24px',
    overflowY: 'auto',
    flex: 1
  },
  titleGroup: {
    marginBottom: '20px'
  },
  badge: {
    background: 'rgba(59, 130, 246, 0.12)',
    color: 'var(--primary-color, #3b82f6)',
    fontSize: '11px',
    fontWeight: '700',
    padding: '3px 10px',
    borderRadius: '12px',
    display: 'inline-block',
    marginBottom: '8px'
  },
  guideTitle: {
    margin: 0,
    fontSize: '18px',
    fontWeight: '700',
    color: 'var(--text-primary)'
  },
  stepsContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    marginBottom: '24px'
  },
  stepItem: {
    display: 'flex',
    gap: '14px',
    alignItems: 'flex-start',
    background: 'var(--app-bg)',
    border: '1px solid var(--border-color)',
    borderRadius: '12px',
    padding: '14px 16px'
  },
  stepBadge: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    background: 'var(--primary-color, #2563eb)',
    color: '#ffffff',
    fontSize: '13px',
    fontWeight: '700',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  stepText: {
    fontSize: '14px',
    color: 'var(--text-primary)',
    lineHeight: '1.5',
    flex: 1
  },
  tipBox: {
    background: 'rgba(234, 179, 8, 0.1)',
    border: '1px solid rgba(234, 179, 8, 0.3)',
    borderRadius: '12px',
    padding: '14px 16px',
    display: 'flex',
    gap: '12px',
    alignItems: 'flex-start'
  },
  tipText: {
    fontSize: '13px',
    color: 'var(--text-primary)',
    lineHeight: '1.4'
  },
  footer: {
    padding: '16px 24px',
    borderTop: '1px solid var(--border-color)',
    display: 'flex',
    justifyContent: 'flex-end'
  },
  btnDone: {
    background: 'var(--primary-color, #2563eb)',
    color: '#ffffff',
    border: 'none',
    borderRadius: '10px',
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center'
  }
}
