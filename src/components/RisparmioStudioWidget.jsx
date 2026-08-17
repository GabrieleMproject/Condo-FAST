import React from 'react';
import { usePlan } from '../hooks/usePlan';
import { ShieldCheck, TrendingDown, PiggyBank } from 'lucide-react';

export default function RisparmioStudioWidget({ compact = false, onScopriClick }) {
  const { piano, limiti, condominiServizioAttivo, scontoTelematiciMensile, prezzoSaaSFinale } = usePlan();

  if (piano === 'trial') return null; // No billing in trial

  const canoneSaaS = limiti?.canone || 0;
  if (canoneSaaS === 0) return null; // Free plan (if exists) has no discount

  const maxSconto = canoneSaaS * 0.75;
  const percSconto = Math.min(100, Math.round((scontoTelematiciMensile / maxSconto) * 100));

  const formatEuro = (val) => `€ ${parseFloat(val || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  if (compact) {
    return (
      <div style={{
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(5, 150, 105, 0.12) 100%)',
        border: '1px solid rgba(16, 185, 129, 0.2)',
        borderRadius: 12,
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        marginBottom: 24
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <PiggyBank size={18} color="#059669" />
            <span style={{ fontWeight: 600, color: '#065f46', fontSize: 14 }}>Cashback Partner</span>
          </div>
          <span style={{ fontWeight: 700, color: '#059669', fontSize: 15 }}>-{formatEuro(scontoTelematiciMensile)}/mese</span>
        </div>
        
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#065f46', marginBottom: 4 }}>
            <span>{condominiServizioAttivo} condomini attivi</span>
            <span>Max {formatEuro(maxSconto)} (75%)</span>
          </div>
          <div style={{ height: 6, background: 'rgba(16, 185, 129, 0.2)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ width: `${percSconto}%`, height: '100%', background: '#10b981', borderRadius: 4, transition: 'width 0.5s ease' }}></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      background: 'var(--card-bg)',
      border: '1px solid var(--border-color)',
      borderRadius: 16,
      padding: '24px',
      marginBottom: '24px',
      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Decorative background element */}
      <div style={{
        position: 'absolute',
        top: -40,
        right: -40,
        width: 150,
        height: 150,
        background: 'radial-gradient(circle, rgba(16, 185, 129, 0.1) 0%, rgba(255,255,255,0) 70%)',
        borderRadius: '50%',
        pointerEvents: 'none'
      }}></div>

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 300px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: 8, borderRadius: 8 }}>
              <TrendingDown size={22} color="#10b981" />
            </div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>
              Risparmio Studio in Tempo Reale
            </h3>
          </div>
          <p style={{ margin: 0, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 16 }}>
            Per ogni condominio in cui attivi il piano <strong>App Full Access & Live</strong>, ricevi 4,16 € di sconto al mese (pari a 50 € all'anno) sulla tua licenza CondoFAST, fino ad abbattere il 75% del canone.
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20 }}>
            <ShieldCheck size={16} color="#059669" />
            <span>Condomini con modulo attivo: <strong style={{ color: 'var(--text-primary)' }}>{condominiServizioAttivo}</strong></span>
          </div>

          <button 
            onClick={onScopriClick}
            style={{
              padding: '10px 20px',
              background: '#10b981',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background 0.2s',
              boxShadow: '0 2px 4px rgba(16, 185, 129, 0.2)'
            }}
            onMouseOver={(e) => e.target.style.background = '#059669'}
            onMouseOut={(e) => e.target.style.background = '#10b981'}
          >
            Scopri i Pacchetti Condominio
          </button>
        </div>

        <div style={{ flex: '1 1 300px', background: 'var(--app-bg)', padding: 20, borderRadius: 12, border: '1px solid var(--border-color)' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
            <span style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 500 }}>Sconto Accumulato</span>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#10b981' }}>-{formatEuro(scontoTelematiciMensile)}<span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-muted)' }}>/mese</span></div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>pari a {formatEuro(scontoTelematiciMensile * 12)} / anno</div>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
              <span>Avanzamento verso il CAP (75%)</span>
              <span style={{ fontWeight: 600 }}>{percSconto}%</span>
            </div>
            <div style={{ height: 8, background: 'var(--border-color)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${percSconto}%`, height: '100%', background: '#10b981', borderRadius: 4, transition: 'width 0.5s ease' }}></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
              <span>0 €</span>
              <span>Max {formatEuro(maxSconto)}</span>
            </div>
          </div>

          <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 600 }}>Costo Netto Licenza:</span>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)' }}>{formatEuro(prezzoSaaSFinale)} <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-muted)' }}>/mese</span></div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>anziché {formatEuro(canoneSaaS)}/mese</span>
              <span style={{ fontSize: 11, color: '#10b981', fontWeight: 600 }}>Tot. Annuo: {formatEuro(prezzoSaaSFinale * 12)}</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
