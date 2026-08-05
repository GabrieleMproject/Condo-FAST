import { useState } from 'react'
import ArchivioVerbaliTab from './ArchivioVerbaliTab'
import GestioneAssembleeView from './GestioneAssembleeView'
import { CalendarRange, Archive } from 'lucide-react'

export default function AssembleeTab({ condominioId }) {
  const [activeSubTab, setActiveSubTab] = useState('gestione') // 'gestione' | 'archivio'

  return (
    <div>
      {/* Sub-nav */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, borderBottom: '1px solid var(--border-color)', paddingBottom: 16 }}>
        <button
          onClick={() => setActiveSubTab('gestione')}
          style={{
            ...S.subTabBtn,
            background: activeSubTab === 'gestione' ? 'var(--btn-primary-bg, #2563eb)' : 'var(--card-bg)',
            color: activeSubTab === 'gestione' ? '#fff' : 'var(--text-secondary)',
            borderColor: activeSubTab === 'gestione' ? 'transparent' : 'var(--border-color)',
          }}
        >
          <CalendarRange size={16} /> Gestione Assemblee
        </button>
        <button
          onClick={() => setActiveSubTab('archivio')}
          style={{
            ...S.subTabBtn,
            background: activeSubTab === 'archivio' ? 'var(--btn-primary-bg, #2563eb)' : 'var(--card-bg)',
            color: activeSubTab === 'archivio' ? '#fff' : 'var(--text-secondary)',
            borderColor: activeSubTab === 'archivio' ? 'transparent' : 'var(--border-color)',
          }}
        >
          <Archive size={16} /> Archivio Storico & AI
        </button>
      </div>

      {activeSubTab === 'gestione' && <GestioneAssembleeView condominioId={condominioId} />}
      {activeSubTab === 'archivio' && <ArchivioVerbaliTab condominioId={condominioId} />}
    </div>
  )
}

const S = {
  subTabBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 16px',
    borderRadius: 8,
    border: '1px solid',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'Sora, sans-serif',
    transition: 'all 0.2s'
  }
}
