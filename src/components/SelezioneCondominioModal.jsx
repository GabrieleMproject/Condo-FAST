import React, { useState } from 'react';
import { X, Building2, ArrowRight } from 'lucide-react';
import { useCondomini } from '../hooks/useCondomini';

export default function SelezioneCondominioModal({ pacchetto, onClose, onConferma }) {
  const { condomini, loading } = useCondomini();
  const [selectedCondominioId, setSelectedCondominioId] = useState('');

  const handleConferma = () => {
    if (!selectedCondominioId) return;
    const condominio = condomini.find(c => c.id === selectedCondominioId);
    if (condominio) {
      onConferma(condominio, pacchetto);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1001, padding: 20 }}>
      <div className="modal-content" style={{ maxWidth: 500, width: '100%', padding: 32 }}>
        <button className="modal-close" onClick={onClose}><X size={24} /></button>
        
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ 
            width: 56, height: 56, borderRadius: '50%', background: 'var(--accent-glow)', 
            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' 
          }}>
            <Building2 size={28} style={{ color: 'var(--accent)' }} />
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 8px 0', color: 'var(--text-primary)' }}>
            Seleziona Condominio
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, margin: 0, lineHeight: 1.5 }}>
            Stai attivando <strong>{pacchetto?.nome}</strong>.<br />
            Su quale condominio vuoi applicare questo pacchetto?
          </p>
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
            Scegli dalla lista
          </label>
          <select 
            value={selectedCondominioId}
            onChange={(e) => setSelectedCondominioId(e.target.value)}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: 8,
              border: '1px solid var(--border-color)',
              background: 'var(--app-bg)',
              color: 'var(--text-primary)',
              fontSize: 15,
              outline: 'none',
              cursor: 'pointer'
            }}
            disabled={loading}
          >
            <option value="">-- Seleziona un condominio --</option>
            {condomini.map(c => (
              <option key={c.id} value={c.id}>{c.denominazione}</option>
            ))}
          </select>
          {loading && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>Caricamento condomini in corso...</div>}
        </div>

        <button 
          onClick={handleConferma}
          disabled={!selectedCondominioId}
          style={{
            width: '100%',
            padding: '12px',
            background: selectedCondominioId ? 'var(--accent)' : 'var(--border-color)',
            color: selectedCondominioId ? '#fff' : 'var(--text-muted)',
            border: 'none',
            borderRadius: 8,
            fontSize: 15,
            fontWeight: 600,
            cursor: selectedCondominioId ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            transition: 'all 0.2s'
          }}
        >
          Procedi con l'Attivazione <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}
