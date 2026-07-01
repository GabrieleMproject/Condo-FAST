import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Landmark, Download, FileSpreadsheet, Building2, User } from 'lucide-react'
import { exportBozzaCU } from '../lib/exportFiscale'
import { usePlan } from '../hooks/usePlan'
import { useWatermark } from '../hooks/useWatermark'

export default function ModuloFiscalePage() {
  const { profile } = usePlan()
  const { checkWatermark, WatermarkModal } = useWatermark()
  const [condomini, setCondomini] = useState([])
  const [fornitori, setFornitori] = useState([])
  const [fatture, setFatture] = useState([])
  const [loading, setLoading] = useState(true)

  // Filtri
  const [annoSelezionato, setAnnoSelezionato] = useState(new Date().getFullYear().toString())
  const [condominioSelezionato, setCondominioSelezionato] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const [resCondomini, resFornitori, resFatture] = await Promise.all([
        supabase.from('condomini').select('id, nome, codice_fiscale, indirizzo, cap, citta, provincia').order('nome'),
        supabase.from('fornitori').select('*'),
        supabase.from('fatture_fornitori').select('*, fornitore_rel:fornitore_id(ragione_sociale, partita_iva, codice_fiscale)').not('ritenuta_acconto', 'is', null)
      ])
      
      setCondomini(resCondomini.data || [])
      setFornitori(resFornitori.data || [])
      setFatture(resFatture.data || [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  // Logica raggruppamento per CU
  const datiRaggruppati = useMemo(() => {
    // 1. Filtriamo per Anno e Condominio (se selezionato)
    const filtrate = fatture.filter(f => {
      if (f.stato !== 'pagata') return false // La ritenuta scatta al pagamento
      if (condominioSelezionato && f.condominio_id !== condominioSelezionato) return false
      
      const annoFattura = f.data_fattura ? f.data_fattura.substring(0, 4) : null
      if (annoFattura !== annoSelezionato) return false
      
      return true
    })

    // 2. Raggruppiamo per Condominio -> Fornitore
    const map = {}
    
    filtrate.forEach(fattura => {
      const cId = fattura.condominio_id
      const fId = fattura.fornitore_id || `sconosciuto-${fattura.fornitore}`
      
      if (!map[cId]) map[cId] = {}
      if (!map[cId][fId]) {
        map[cId][fId] = {
          condominio: condomini.find(c => c.id === cId) || { nome: 'Sconosciuto' },
          fornitore: fornitori.find(fo => fo.id === fId) || { 
            ragione_sociale: fattura.fornitore_rel?.ragione_sociale || fattura.fornitore, 
            partita_iva: fattura.fornitore_rel?.partita_iva || null,
            codice_fiscale: fattura.fornitore_rel?.codice_fiscale || null,
            indirizzo: fattura.fornitore_rel?.indirizzo || null,
            citta: fattura.fornitore_rel?.citta || null,
            cap: fattura.fornitore_rel?.cap || null,
            provincia: fattura.fornitore_rel?.provincia || null
          },
          fatture: [],
          totaleImponibile: 0,
          totaleRitenute: 0
        }
      }
      
      map[cId][fId].fatture.push(fattura)
      map[cId][fId].totaleImponibile += (fattura.importo_totale || 0) - (fattura.importo_iva || 0)
      map[cId][fId].totaleRitenute += (fattura.ritenuta_acconto || 0)
    })
    
    return map
  }, [fatture, annoSelezionato, condominioSelezionato, condomini, fornitori])

  const handleExport = (cId) => {
    checkWatermark((withWatermark) => {
      const condominioData = datiRaggruppati[cId]
      const condominioInfo = condomini.find(c => c.id === cId)
      if (!condominioData) return
      
      const fornitoriList = Object.values(condominioData)
      exportBozzaCU(condominioInfo, annoSelezionato, fornitoriList, profile, withWatermark)
    })
  }

  return (
    <div style={styles.page}>
      <WatermarkModal />
      <div style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ background: '#2563eb20', padding: 12, borderRadius: 12 }}>
            <Landmark size={28} color="#60a5fa" />
          </div>
          <div>
            <h1 style={styles.title}>Modulo Fiscale (CU / 770)</h1>
            <p style={styles.subtitle}>Gestione delle ritenute d'acconto per la Certificazione Unica</p>
          </div>
        </div>
      </div>

      <div style={styles.toolbar}>
        <div style={{ display: 'flex', gap: 16 }}>
          <div>
            <label style={styles.label}>Esercizio (Anno)</label>
            <select value={annoSelezionato} onChange={e => setAnnoSelezionato(e.target.value)} style={styles.select}>
              {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label style={styles.label}>Filtra Condominio</label>
            <select value={condominioSelezionato} onChange={e => setCondominioSelezionato(e.target.value)} style={styles.select}>
              <option value="">Tutti i condomini</option>
              {condomini.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ color: '#94a3b8' }}>Caricamento dati fiscali...</div>
      ) : Object.keys(datiRaggruppati).length === 0 ? (
        <div style={styles.empty}>
          Nessuna ritenuta d'acconto registrata (fatture pagate) per i filtri selezionati.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          {Object.entries(datiRaggruppati).map(([cId, fornitoriMap]) => {
            const fornitoriList = Object.values(fornitoriMap)
            const condName = fornitoriList[0]?.condominio?.nome || 'Condominio'
            
            return (
              <div key={cId} style={styles.section}>
                <div style={styles.sectionHeader}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Building2 size={20} color="#94a3b8" />
                    <h2 style={styles.sectionTitle}>{condName}</h2>
                  </div>
                  <button onClick={() => handleExport(cId)} style={styles.btnExport}>
                    <Download size={16} /> Scarica Bozza CU / 770
                  </button>
                </div>
                
                <div style={styles.tableContainer}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Fornitore</th>
                        <th style={styles.th}>P.IVA / CF</th>
                        <th style={styles.th}>Fatture</th>
                        <th style={styles.th} className="text-right">Imponibile Lordo</th>
                        <th style={styles.th} className="text-right">Ritenuta (Trattenuta)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fornitoriList.map((fData, i) => (
                        <tr key={i} style={styles.tr}>
                          <td style={styles.td}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <User size={14} color="#64748b" />
                              <span style={{ fontWeight: 600, color: '#e2e8f0' }}>{fData.fornitore.ragione_sociale}</span>
                            </div>
                          </td>
                          <td style={styles.td}>
                            {fData.fornitore.partita_iva || fData.fornitore.codice_fiscale ? (
                              <span style={styles.badge}>{fData.fornitore.partita_iva || fData.fornitore.codice_fiscale}</span>
                            ) : (
                              <span style={{ color: '#ef4444', fontSize: 12 }}>Dati mancanti</span>
                            )}
                          </td>
                          <td style={styles.td}>{fData.fatture.length} doc.</td>
                          <td style={{ ...styles.td, textAlign: 'right' }}>€ {fData.totaleImponibile.toFixed(2)}</td>
                          <td style={{ ...styles.td, textAlign: 'right', color: '#f59e0b', fontWeight: 600 }}>€ {fData.totaleRitenute.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const styles = {
  page: { padding: '28px 32px', background: '#0f172a', minHeight: '100vh', fontFamily: 'Sora, sans-serif' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  title: { color: '#f8fafc', fontSize: 24, fontWeight: 700, margin: 0 },
  subtitle: { color: '#94a3b8', fontSize: 14, marginTop: 4 },
  toolbar: { display: 'flex', gap: 16, marginBottom: 24, background: '#1e293b', padding: '16px 20px', borderRadius: 12, border: '1px solid #334155' },
  label: { display: 'block', color: '#94a3b8', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', marginBottom: 6 },
  select: { background: '#0f172a', border: '1px solid #334155', borderRadius: 8, padding: '8px 12px', color: '#f8fafc', fontFamily: 'Sora, sans-serif', fontSize: 14, outline: 'none' },
  empty: { background: '#1e293b', border: '1px dashed #334155', borderRadius: 12, padding: 40, textAlign: 'center', color: '#64748b' },
  section: { background: '#1e293b', borderRadius: 12, border: '1px solid #334155', overflow: 'hidden' },
  sectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #334155', background: '#0f172a' },
  sectionTitle: { color: '#e2e8f0', fontSize: 16, fontWeight: 600, margin: 0 },
  btnExport: { display: 'flex', alignItems: 'center', gap: 6, background: '#1e293b', color: '#f8fafc', border: '1px solid #475569', borderRadius: 6, padding: '6px 12px', fontSize: 13, cursor: 'pointer', fontWeight: 600 },
  tableContainer: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
  th: { padding: '12px 20px', textAlign: 'left', color: '#94a3b8', fontWeight: 600, fontSize: 12, textTransform: 'uppercase', borderBottom: '1px solid #334155' },
  td: { padding: '12px 20px', borderBottom: '1px solid #334155', color: '#cbd5e1' },
  tr: { transition: 'background 0.2s' },
  badge: { background: '#334155', color: '#e2e8f0', padding: '4px 8px', borderRadius: 4, fontSize: 12, fontFamily: 'monospace' }
}
