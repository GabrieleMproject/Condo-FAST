import React from 'react';
import { X, CheckCircle2, ShieldCheck, Globe, Smartphone, ArrowRight } from 'lucide-react';

const PACCHETTI = [
  {
    id: 'base',
    nome: 'Modulo Fiscale Base',
    icon: <ShieldCheck size={28} color="#3b82f6" />,
    costo: 36,
    sconto: 12,
    scontoMensile: 1.00,
    descrizione: 'Copre solo la burocrazia pura. Gestione dei file per gli adempimenti fiscali obbligatori.',
    benefits: [
      'Export file per Adempimenti',
      'Archiviazione sicura a norma',
      'Ideale per condomini base'
    ],
    color: '#3b82f6',
    bgColor: 'rgba(59, 130, 246, 0.1)'
  },
  {
    id: 'web',
    nome: 'Condo Web Access',
    icon: <Globe size={28} color="#8b5cf6" />,
    costo: 100,
    sconto: 30,
    scontoMensile: 2.50,
    descrizione: 'Accesso web per i condòmini. Aumenta la trasparenza e riduce drasticamente le telefonate in studio per richieste di informazioni.',
    benefits: [
      'Tutto il piano Fiscale Base',
      'Accesso Web per i Condòmini',
      'Bacheca avvisi digitale',
      'Riduzione chiamate allo studio'
    ],
    color: '#8b5cf6',
    bgColor: 'rgba(139, 92, 246, 0.1)'
  },
  {
    id: 'app_full',
    nome: 'App Full Access & Live',
    icon: <Smartphone size={28} color="#10b981" />,
    costo: 150,
    sconto: 50,
    scontoMensile: 4.16,
    descrizione: 'L\'esperienza top. Web App interattiva (senza download) e assemblee live. Elimina il carico di telefonate dando totale autonomia ai condòmini.',
    benefits: [
      'Tutto il piano Web Access',
      'Web App completa accessibile da Browser',
      'Voto elettronico in assemblea',
      'Proposte argomenti all\'OdG',
      'Segnalazione guasti con foto',
      'Esperienza Premium per i condòmini'
    ],
    color: '#10b981',
    bgColor: 'rgba(16, 185, 129, 0.1)'
  }
];

export default function PanoramicaPacchettiModal({ onClose, onSelectPacchetto }) {
  return (
    <div className="modal-overlay" style={{ zIndex: 1000, padding: 20 }}>
      <div className="modal-content" style={{ background: 'var(--app-bg)', borderRadius: 24, boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)', position: 'relative', maxWidth: 1100, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: 40 }}>
        <button className="modal-close" onClick={onClose}><X size={24} /></button>
        
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h2 style={{ fontSize: 32, fontWeight: 800, margin: '0 0 12px 0', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Scegli il livello di servizio per il Condominio
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 16, margin: 0, maxWidth: 600, marginLeft: 'auto', marginRight: 'auto' }}>
            Offri un servizio di maggior valore ai tuoi condòmini e ottieni uno sconto immediato sul tuo canone di licenza CondoFAST.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
          {PACCHETTI.map(pkg => (
            <div key={pkg.id} style={{
              background: 'var(--app-bg)',
              border: `2px solid ${pkg.id === 'app_full' ? pkg.color : 'var(--border-color)'}`,
              borderRadius: 16,
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              boxShadow: pkg.id === 'app_full' ? '0 10px 25px -5px rgba(16, 185, 129, 0.15)' : 'none'
            }}>
              {pkg.id === 'app_full' && (
                <div style={{
                  position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                  background: pkg.color, color: '#fff', fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 20, letterSpacing: '0.05em', textTransform: 'uppercase'
                }}>
                  Il Più Scelto
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <div style={{ background: pkg.bgColor, padding: 12, borderRadius: 12 }}>
                  {pkg.icon}
                </div>
                <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>{pkg.nome}</h3>
              </div>

              <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.5, margin: '0 0 24px 0', minHeight: 42 }}>
                {pkg.descrizione}
              </p>

              <div style={{ padding: '16px 0', borderTop: '1px solid var(--border-color-2)', borderBottom: '1px solid var(--border-color-2)', marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                  <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Costo al Condominio:</span>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>{pkg.costo}€</span>
                    <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>/anno</span>
                  </div>
                </div>
                
                <div style={{ background: pkg.bgColor, borderRadius: 8, padding: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: pkg.color }}>Tuo Sconto Licenza:</span>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: 16, fontWeight: 800, color: pkg.color }}>-{pkg.scontoMensile.toLocaleString('it-IT', {minimumFractionDigits: 2})}€<span style={{ fontSize: 12, fontWeight: 500 }}>/mese</span></span>
                    <div style={{ fontSize: 11, color: pkg.color, opacity: 0.8 }}>(pari a {pkg.sconto}€ annui)</div>
                  </div>
                </div>
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>Cosa include:</div>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {pkg.benefits.map((benefit, i) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 14, color: 'var(--text-secondary)' }}>
                      <CheckCircle2 size={18} color={pkg.color} style={{ flexShrink: 0, marginTop: 1 }} />
                      <span>{benefit}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <button 
                onClick={() => onSelectPacchetto(pkg)}
                style={{
                  marginTop: 32,
                  width: '100%',
                  padding: '12px 20px',
                  background: pkg.id === 'app_full' ? pkg.color : 'var(--card-bg)',
                  color: pkg.id === 'app_full' ? '#fff' : 'var(--text-primary)',
                  border: `1px solid ${pkg.id === 'app_full' ? pkg.color : 'var(--border-color)'}`,
                  borderRadius: 8,
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  transition: 'all 0.2s'
                }}
                onMouseOver={(e) => {
                  if (pkg.id !== 'app_full') e.target.style.background = 'var(--border-color-2)';
                  else e.target.style.background = '#059669';
                }}
                onMouseOut={(e) => {
                  if (pkg.id !== 'app_full') e.target.style.background = 'var(--card-bg)';
                  else e.target.style.background = pkg.color;
                }}
              >
                Seleziona Pacchetto <ArrowRight size={18} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
