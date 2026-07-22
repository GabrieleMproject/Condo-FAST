import { Calendar, ChevronDown, Lock, CheckCircle2, AlertCircle, Plus } from 'lucide-react'

const formattaData = (d) => (d && !isNaN(new Date(d).getTime()) ? new Date(d).toLocaleDateString('it-IT') : '—')

export default function EsercizioSelectorHeader({
  esercizi = [],
  esercizioAttivo = null,
  onSelectEsercizio = () => {},
  loading = false,
  onNuovoEsercizio = null,
}) {
  if (loading && !esercizioAttivo) {
    return (
      <div style={S.containerLoading}>
        <Calendar size={15} color="var(--text-muted)" style={{ animation: 'spin 1s infinite' }} />
        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Caricamento esercizio...</span>
      </div>
    )
  }

  if (!esercizi || esercizi.length === 0) {
    return (
      <div style={S.containerEmpty}>
        <AlertCircle size={15} color="#f59e0b" />
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Nessun esercizio presente</span>
        {onNuovoEsercizio && (
          <button style={S.btnNuovoInline} onClick={onNuovoEsercizio}>
            <Plus size={13} style={{ marginRight: 4 }} /> Crea Esercizio
          </button>
        )}
      </div>
    )
  }

  const isChiuso = esercizioAttivo?.stato === 'chiuso'
  const isAperto = esercizioAttivo?.stato === 'aperto' || !esercizioAttivo?.stato

  return (
    <div style={S.container}>
      <div style={S.leftLabelGroup}>
        <div style={S.iconWrap}>
          <Calendar size={16} color="#60a5fa" />
        </div>
        <div>
          <div style={S.labelSub}>Esercizio Amministrativo</div>
          <div style={S.selectWrap}>
            <select
              value={esercizioAttivo?.id || ''}
              onChange={(e) => onSelectEsercizio(e.target.value)}
              style={S.select}
            >
              {esercizi.map((e) => (
                <option key={e.id} value={e.id} style={S.option}>
                  Anno {e.anno} ({formattaData(e.data_inizio)} – {formattaData(e.data_fine)}) {e.stato === 'chiuso' ? '🔒' : ''}
                </option>
              ))}
            </select>
            <ChevronDown size={14} color="var(--text-muted)" style={S.chevron} />
          </div>
        </div>
      </div>

      {/* Dettagli periodo e stato */}
      {esercizioAttivo && (
        <div style={S.rightMetaGroup}>
          <span style={S.dateRangeBadge}>
            📅 {formattaData(esercizioAttivo.data_inizio)} → {formattaData(esercizioAttivo.data_fine)}
          </span>

          <span
            style={{
              ...S.statusPill,
              background: isChiuso ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)',
              color: isChiuso ? '#f87171' : '#34d399',
              border: `1px solid ${isChiuso ? 'rgba(239,68,68,0.25)' : 'rgba(16,185,129,0.25)'}`,
            }}
          >
            {isChiuso ? (
              <>
                <Lock size={12} style={{ marginRight: 5 }} /> Chiuso (Sola Lettura)
              </>
            ) : (
              <>
                <CheckCircle2 size={12} style={{ marginRight: 5 }} /> In Corso
              </>
            )}
          </span>
        </div>
      )}
    </div>
  )
}

const S = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justify: 'space-between',
    background: 'var(--card-bg)',
    borderRadius: 12,
    padding: '10px 16px',
    border: '1px solid var(--border-color)',
    marginBottom: 20,
    flexWrap: 'wrap',
    gap: 12,
  },
  containerLoading: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '12px 16px',
    background: 'var(--card-bg)',
    borderRadius: 12,
    border: '1px solid var(--border-color)',
    marginBottom: 20,
  },
  containerEmpty: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '12px 16px',
    background: 'rgba(245,158,11,0.08)',
    borderRadius: 12,
    border: '1px solid rgba(245,158,11,0.2)',
    marginBottom: 20,
  },
  btnNuovoInline: {
    background: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    padding: '4px 10px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'Sora, sans-serif',
    display: 'inline-flex',
    alignItems: 'center',
  },
  leftLabelGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    background: 'rgba(37,99,235,0.12)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  labelSub: {
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: 2,
  },
  selectWrap: {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
  },
  select: {
    appearance: 'none',
    WebkitAppearance: 'none',
    background: 'var(--app-bg)',
    color: 'var(--text-primary)',
    fontSize: 14,
    fontWeight: 700,
    border: '1px solid var(--border-color)',
    borderRadius: 8,
    padding: '4px 30px 4px 10px',
    fontFamily: 'Sora, sans-serif',
    cursor: 'pointer',
    outline: 'none',
  },
  option: {
    background: 'var(--card-bg)',
    color: 'var(--text-primary)',
  },
  chevron: {
    position: 'absolute',
    right: 8,
    pointerEvents: 'none',
  },
  rightMetaGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  dateRangeBadge: {
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--text-secondary)',
    background: 'var(--app-bg)',
    padding: '4px 10px',
    borderRadius: 6,
    border: '1px solid var(--border-color)',
  },
  statusPill: {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: 12,
    fontWeight: 600,
    padding: '4px 10px',
    borderRadius: 6,
  },
}
