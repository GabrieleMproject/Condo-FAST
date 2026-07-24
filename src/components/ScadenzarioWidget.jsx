// src/components/ScadenzarioWidget.jsx
import React, { useMemo } from 'react'
import { Calendar, Clock, ChevronRight, CheckCircle2, AlertCircle } from 'lucide-react'

export default function ScadenzarioWidget({ deleghe = [], compact = false, onNavigate }) {
  const oggi = new Date()
  const annoCorrente = oggi.getFullYear()
  const meseCorrente = oggi.getMonth() // 0-based

  const scadenze = useMemo(() => {
    const lista = []

    // 1. Prossimo F24 Mensile (giorno 16 del mese corrente o successivo)
    let dataProssimoF24 = new Date(annoCorrente, meseCorrente, 16)
    if (oggi.getDate() > 16) {
      dataProssimoF24 = new Date(annoCorrente, meseCorrente + 1, 16)
    }
    
    lista.push({
      id: 'f24_mensile',
      titolo: 'Versamento F24 Ritenute d\'Acconto',
      descrizione: 'Versamento ritenute del mese precedente (Codici 1019, 1020, 1040)',
      data: dataProssimoF24.toISOString().split('T')[0],
      categoria: 'fiscale',
      link: '/modulo-fiscale'
    })

    // 2. Scadenze Fisse Ministeriali Italiane
    const dataCU = `${annoCorrente}-03-16`
    const data770 = `${annoCorrente}-10-31`
    const dataDiff1 = `${annoCorrente}-06-30`
    const dataDiff2 = `${annoCorrente}-12-20`

    if (dataCU >= oggi.toISOString().split('T')[0]) {
      lista.push({
        id: 'cu_ministeriale',
        titolo: 'Scadenza Certificazione Unica (CU)',
        descrizione: 'Invio telematico CU all\'Agenzia delle Entrate per compensi fornitori',
        data: dataCU,
        categoria: 'ministeriale',
        link: '/modulo-fiscale'
      })
    }

    if (data770 >= oggi.toISOString().split('T')[0]) {
      lista.push({
        id: '770_ministeriale',
        titolo: 'Scadenza Modello 770',
        descrizione: 'Dichiarazione dei sostituti d\'imposta Agenzia delle Entrate',
        data: data770,
        categoria: 'ministeriale',
        link: '/modulo-fiscale'
      })
    }

    if (dataDiff1 >= oggi.toISOString().split('T')[0]) {
      lista.push({
        id: 'diff_1',
        titolo: 'Differimento Ritenute < 500€ (1° Semestre)',
        descrizione: 'Termine versamento ritenute sotto soglia cumulate nei primi 5 mesi',
        data: dataDiff1,
        categoria: 'fiscale',
        link: '/modulo-fiscale'
      })
    } else if (dataDiff2 >= oggi.toISOString().split('T')[0]) {
      lista.push({
        id: 'diff_2',
        titolo: 'Differimento Ritenute < 500€ (2° Semestre)',
        descrizione: 'Termine versamento ritenute sotto soglia cumulate da giugno a novembre',
        data: dataDiff2,
        categoria: 'fiscale',
        link: '/modulo-fiscale'
      })
    }

    // 3. Deleghe F24 reali "Da Pagare" dal Database
    deleghe.filter(d => d.stato === 'da_pagare' && d.data_scadenza).forEach(d => {
      lista.push({
        id: `f24_db_${d.id}`,
        titolo: `F24 in Scadenza - € ${(parseFloat(d.importo_totale) || 0).toFixed(2)}`,
        descrizione: `Delega F24 in attesa di quietanza o addebito`,
        data: d.data_scadenza,
        categoria: 'f24_db',
        link: '/modulo-fiscale'
      })
    })

    // Ordina per data crescente e calcola giorni rimanenti
    return lista
      .map(item => {
        const target = new Date(item.data)
        const diffTime = target - oggi
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        return { ...item, diffDays }
      })
      .sort((a, b) => a.diffDays - b.diffDays)
  }, [deleghe, oggi, annoCorrente, meseCorrente])

  const getUrgenzaStyle = (days) => {
    if (days < 0) return { label: 'Scaduto', color: '#ef4444', bg: '#ef444415' }
    if (days === 0) return { label: 'OGGI', color: '#ef4444', bg: '#ef444420' }
    if (days <= 5) return { label: `${days} giorni`, color: '#ef4444', bg: '#ef444415' }
    if (days <= 15) return { label: `${days} giorni`, color: '#f59e0b', bg: '#f59e0b15' }
    return { label: `${days} giorni`, color: '#10b981', bg: '#10b98115' }
  }

  const formattaDataLeggibile = (dStr) => {
    if (!dStr) return ''
    const p = dStr.split('-')
    if (p.length !== 3) return dStr
    return `${p[2]}/${p[1]}/${p[0]}`
  }

  return (
    <div style={{
      background: 'var(--card-bg)',
      border: '1px solid var(--border-color)',
      borderRadius: 12,
      padding: compact ? 16 : 20,
      fontFamily: 'Sora, sans-serif'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ background: '#2563eb20', padding: 8, borderRadius: 8 }}>
            <Calendar size={20} color="#60a5fa" />
          </div>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              Scadenzario Fiscale & Amministrativo
            </h3>
            {!compact && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Prossime adempienze ed F24 del periodo</div>}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {scadenze.slice(0, compact ? 3 : 5).map(scad => {
          const urg = getUrgenzaStyle(scad.diffDays)
          return (
            <div
              key={scad.id}
              onClick={() => onNavigate ? onNavigate(scad.link) : window.location.href = scad.link}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: 'var(--app-bg)', border: '1px solid var(--border-color)',
                borderRadius: 8, padding: '10px 14px', cursor: 'pointer', transition: 'all 0.2s'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Clock size={16} color={urg.color} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {scad.titolo}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', marginTop: 2 }}>
                    Scadenza: <b>{formattaDataLeggibile(scad.data)}</b> • {scad.descrizione}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  background: urg.bg, color: urg.color,
                  padding: '3px 10px', borderRadius: 12, fontSize: 11.5, fontWeight: 700
                }}>
                  {urg.label}
                </span>
                <ChevronRight size={16} color="var(--text-muted)" />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
