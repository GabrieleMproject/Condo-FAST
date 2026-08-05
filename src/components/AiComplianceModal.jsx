import React from 'react';
import { X, Sparkles, ShieldCheck, UserCheck } from 'lucide-react';

export default function AiComplianceModal({ onClose }) {
  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: 600, maxHeight: '90vh', overflowY: 'auto' }}>
        <button className="modal-close" onClick={onClose}><X size={20} /></button>
        
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ 
            width: 56, height: 56, borderRadius: '50%', background: 'rgba(37, 99, 235, 0.1)', 
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' 
          }}>
            <Sparkles size={28} style={{ color: 'var(--accent)' }} />
          </div>
          <h2 style={{ fontSize: 24, margin: '0 0 8px 0', color: 'var(--text-primary)' }}>Conformità AI Act (UE)</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: 0 }}>
            Regolamento 2024/1689 sull'Intelligenza Artificiale
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flexShrink: 0, color: 'var(--accent)' }}>
              <ShieldCheck size={24} />
            </div>
            <div>
              <h4 style={{ margin: '0 0 4px 0', fontSize: 15, color: 'var(--text-primary)' }}>Sistemi a Basso Rischio</h4>
              <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                CondoFAST utilizza l'intelligenza artificiale generativa (come Google Gemini) 
                esclusivamente come strumento di supporto all'estrazione dati (OCR intelligente). 
                Non prendiamo decisioni critiche automatizzate, nel pieno rispetto dei requisiti di trasparenza.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ flexShrink: 0, color: 'var(--accent)' }}>
              <UserCheck size={24} />
            </div>
            <div>
              <h4 style={{ margin: '0 0 4px 0', fontSize: 15, color: 'var(--text-primary)' }}>Principio di "Procura & Conferma"</h4>
              <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Tutti i suggerimenti dell'IA sono etichettati visivamente con un badge apposito. 
                Spetta sempre a te, l'amministratore, l'esclusiva responsabilità di verificare la correttezza 
                dei dati (es. importi fatture, dati catastali) prima di salvarli nel database.
              </p>
            </div>
          </div>

          <div style={{ padding: 16, background: 'rgba(37, 99, 235, 0.05)', borderRadius: 8, border: '1px solid rgba(37, 99, 235, 0.1)' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: 14, color: 'var(--text-primary)' }}>Nessun Addestramento sui tuoi Dati</h4>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Le richieste inviate ai nostri partner (Stateless API) non vengono archiviate né utilizzate 
              per l'addestramento dei modelli linguistici, a garanzia della massima riservatezza (GDPR Art. 28).
            </p>
          </div>
        </div>

        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <button className="btn btn--primary" onClick={onClose} style={{ width: '100%', justifyContent: 'center' }}>
            Ho compreso
          </button>
        </div>
      </div>
    </div>
  );
}
