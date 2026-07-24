import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { applyWatermark } from './watermark'

const BLU = [15, 23, 42]
const TESTO = [51, 65, 85]
const GRIGIO = [100, 116, 139]

const formattaData = (dataStr) => {
  if (!dataStr) return '—'
  const d = new Date(dataStr)
  return isNaN(d.getTime()) ? dataStr : d.toLocaleDateString('it-IT')
}

export function exportBozzaCU(condominio, anno, fornitori, profile, withWatermark = false) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  
  let y = 20
  
  // Intestazione Sostituto d'Imposta (Condominio)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(...BLU)
  doc.text(`CERTIFICAZIONE UNICA (BOZZA) - ESERCIZIO ${anno}`, 14, y)
  
  y += 8
  doc.setFontSize(10)
  doc.setTextColor(...TESTO)
  doc.text(`SOSTITUTO D'IMPOSTA: ${condominio.nome}`, 14, y)
  doc.text(`C.F.: ${condominio.codice_fiscale || '_______________'}`, 120, y)
  
  y += 5
  doc.setFont('helvetica', 'normal')
  const indirizzoCondominio = [condominio.indirizzo, condominio.cap, condominio.citta, condominio.provincia].filter(Boolean).join(' - ')
  doc.text(`Indirizzo: ${indirizzoCondominio || '____________________'}`, 14, y)
  
  y += 8
  
  // Rappresentante Legale (Amministratore)
  if (profile) {
    doc.setFont('helvetica', 'bold')
    doc.text(`RAPPRESENTANTE LEGALE: ${profile.ragione_sociale || '________________'}`, 14, y)
    doc.setFont('helvetica', 'normal')
    doc.text(`C.F.: ${profile.codice_fiscale || '_______________'} | P.IVA: ${profile.partita_iva || '_______________'}`, 120, y)
    y += 5
    doc.text(`Studio: ${profile.studio_indirizzo || '____________________'}`, 14, y)
  }
  
  y += 10

  let totaleGeneraleRitenute = 0
  let totaleGeneraleImponibile = 0

  fornitori.forEach((fData, i) => {
    // Intestazione fornitore
    if (y > 250) {
      doc.addPage()
      y = 20
    }

    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...BLU)
    doc.text(`Fornitore: ${fData.fornitore.ragione_sociale}`, 14, y)
    
    y += 6
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...TESTO)
    doc.text(`P.IVA: ${fData.fornitore.partita_iva || '_______________'} | C.F.: ${fData.fornitore.codice_fiscale || '_______________'}`, 14, y)
    
    y += 5
    const indirizzoFornitore = [fData.fornitore.indirizzo, fData.fornitore.cap, fData.fornitore.citta, fData.fornitore.provincia].filter(Boolean).join(' - ')
    doc.text(`Indirizzo: ${indirizzoFornitore || '____________________'}`, 14, y)
    doc.text(`Causale (Consigliata): W`, 140, y)

    y += 8

    // Tabella fatture del fornitore
    const body = fData.fatture.map(fat => {
      const imponibile = (fat.importo_totale || 0) - (fat.importo_iva || 0)
      const ritenuta = fat.ritenuta_acconto || 0
      return [
        fat.numero_fattura || '-',
        fat.data_fattura || '-',
        `€ ${imponibile.toFixed(2)}`,
        `€ ${ritenuta.toFixed(2)}`,
        fat.f24_url ? 'Sì (Pagato)' : 'No'
      ]
    })

    autoTable(doc, {
      startY: y,
      head: [['N° Fattura', 'Data Pag.', 'Amm. Lordo Corrisposto', 'Ritenuta (Trattenuta)', 'F24']],
      body,
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: BLU, textColor: [255, 255, 255] },
      margin: { left: 14, right: 14 }
    })

    y = doc.lastAutoTable.finalY + 8

    totaleGeneraleImponibile += fData.totaleImponibile
    totaleGeneraleRitenute += fData.totaleRitenute
  })

  // Totali Generali
  if (y > 250) { doc.addPage(); y = 20; }
  
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...BLU)
  doc.text('RIEPILOGO TOTALI CONDOMINIO', 14, y)
  
  y += 8
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...TESTO)
  doc.text(`Totale Imponibile Erogato: € ${totaleGeneraleImponibile.toFixed(2)}`, 14, y)
  y += 6
  doc.text(`Totale Ritenute Trattenute (da versare in F24): € ${totaleGeneraleRitenute.toFixed(2)}`, 14, y)

  applyWatermark(doc, withWatermark)
  doc.save(`Bozza_CU_${condominio.nome}_${anno}.pdf`)
}

export function exportQuietanzaFornitore(condominio, fornitore, fatture, delegaF24, profile, withWatermark = false) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  
  let y = 20
  
  // Intestazione
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(...BLU)
  doc.text(`RICEVUTA DI VERSAMENTO RITENUTA D'ACCONTO`, 14, y)
  
  y += 8
  doc.setFontSize(10)
  doc.setTextColor(...TESTO)
  doc.text(`SOSTITUTO D'IMPOSTA: ${condominio.nome}`, 14, y)
  doc.text(`C.F.: ${condominio.codice_fiscale || '_______________'}`, 120, y)
  
  y += 5
  doc.setFont('helvetica', 'normal')
  const indirizzoCondominio = [condominio.indirizzo, condominio.cap, condominio.citta, condominio.provincia].filter(Boolean).join(' - ')
  doc.text(`Indirizzo: ${indirizzoCondominio || '____________________'}`, 14, y)
  
  y += 8
  
  // Rappresentante Legale (Amministratore)
  if (profile) {
    doc.setFont('helvetica', 'bold')
    doc.text(`RAPPRESENTANTE LEGALE: ${profile.ragione_sociale || '________________'}`, 14, y)
    doc.setFont('helvetica', 'normal')
    doc.text(`C.F.: ${profile.codice_fiscale || '_______________'} | P.IVA: ${profile.partita_iva || '_______________'}`, 120, y)
    y += 5
    doc.text(`Studio: ${profile.studio_indirizzo || '____________________'}`, 14, y)
  }
  
  y += 12
  
  // Dati Percipiente (Fornitore)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...BLU)
  doc.text(`PERCIPIENTE (FORNITORE): ${fornitore.ragione_sociale}`, 14, y)
  
  y += 6
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...TESTO)
  doc.text(`P.IVA: ${fornitore.partita_iva || '_______________'} | C.F.: ${fornitore.codice_fiscale || '_______________'}`, 14, y)
  
  y += 5
  const indirizzoFornitore = [fornitore.indirizzo, fornitore.cap, fornitore.citta, fornitore.provincia].filter(Boolean).join(' - ')
  doc.text(`Indirizzo: ${indirizzoFornitore || '____________________'}`, 14, y)
  
  y += 12
  
  // Testo Certificazione
  doc.setFont('helvetica', 'bold')
  doc.text(`SI CERTIFICA L'AVVENUTO VERSAMENTO DELLA RITENUTA D'ACCONTO`, 14, y)
  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.text(`Si attesta che, in relazione alle fatture sotto indicate corrisposte al percipiente, questo Condominio ha provveduto`, 14, y)
  y += 5
  doc.text(`ad effettuare ed a versare all'Erario la ritenuta d'acconto sul compenso erogato tramite modello F24 cumulativo.`, 14, y)
  
  y += 8
  
  // Tabella Fatture incluse
  const body = fatture.map(fat => {
    const imponibile = fat.imponibile_ritenuta || (fat.importo_totale || 0) - (fat.importo_iva || 0)
    const ritenuta = fat.importo_ritenuta || fat.ritenuta_acconto || 0
    return [
      fat.numero_fattura || '-',
      fat.data_fattura || '-',
      fat.data_pagamento || '-',
      `€ ${imponibile.toFixed(2)}`,
      `${fat.aliquota_ritenuta_percentuale || 0}%`,
      `€ ${ritenuta.toFixed(2)}`
    ]
  })

  autoTable(doc, {
    startY: y,
    head: [['N° Fattura', 'Data Fatt.', 'Data Pag.', 'Imponibile Ritenuta', 'Aliquota', 'Ritenuta']],
    body,
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2.5 },
    headStyles: { fillColor: BLU, textColor: [255, 255, 255] },
    margin: { left: 14, right: 14 }
  })
  
  y = doc.lastAutoTable.finalY + 12
  
  // Dati Versamento F24
  if (y > 230) {
    doc.addPage()
    y = 20
  }
  
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...BLU)
  doc.text(`RIFERIMENTI DEL VERSAMENTO (MODELLO F24)`, 14, y)
  
  y += 6
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...TESTO)
  doc.text(`Stato Versamento: VERSATO (PAGATO)`, 14, y)
  y += 5
  doc.text(`Data di pagamento F24: ${delegaF24.data_pagamento || '_______________'}`, 14, y)
  y += 5
  const codTributo = fatture[0]?.codice_tributo_f24 || '1019';
  doc.text(`Codice Tributo utilizzato: ${codTributo}`, 14, y)
  y += 5
  const totaleRitenutaVersata = fatture.reduce((sum, f) => sum + (f.importo_ritenuta || f.ritenuta_acconto || 0), 0);
  doc.text(`Importo della ritenuta versata: € ${totaleRitenutaVersata.toFixed(2)}`, 14, y)
  y += 6
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(9)
  doc.text(`Nota: La ritenuta del fornitore è stata inclusa nel versamento cumulativo F24 di € ${delegaF24.importo_totale?.toFixed(2)} del Condominio.`, 14, y)
  
  y += 20
  if (y > 260) {
    doc.addPage()
    y = 20
  }
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`Luogo e Data: ________________________`, 14, y)
  doc.text(`Firma dell'Amministratore: ________________________`, 100, y)
  
  applyWatermark(doc, withWatermark)
  doc.save(`Quietanza_Ritenuta_${condominio.nome.replace(/\s+/g, '_')}_${fornitore.ragione_sociale.replace(/\s+/g, '_')}.pdf`)
}

/**
 * Genera il PDF della quietanza fornitore in memoria e lo restituisce come stringa Base64
 * (utilizzabile come allegato nell'inoltro via email con Resend).
 */
export function generaPdfQuietanzaBase64(condominio, fornitore, fatture, delegaF24, profile, withWatermark = false) {
  const doc = new jsPDF()
  
  const BLU = [37, 99, 235]
  const SCURO = [30, 41, 59]
  const TESTO = [71, 85, 105]

  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...BLU)
  doc.text('CERTIFICAZIONE DI VERSAMENTO RITENUTA D\'ACCONTO', 14, 20)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...TESTO)
  doc.text(`Rilasciata ai sensi dell'art. 25-ter del D.P.R. 600/1973`, 14, 26)

  let y = 38
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...BLU)
  doc.text('SOSTITUTO D\'IMPOSTA (CONDOMINIO)', 14, y)

  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...SCURO)
  doc.text(`Denominazione: ${condominio?.nome || '—'}`, 14, y)
  y += 5
  doc.text(`Codice Fiscale: ${condominio?.codice_fiscale || '—'}`, 14, y)
  y += 5
  doc.text(`Indirizzo: ${condominio?.indirizzo || ''} ${condominio?.cap || ''} ${condominio?.citta || ''} (${condominio?.provincia || ''})`, 14, y)

  y += 10
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...BLU)
  doc.text('PERCIPIENTE (FORNITORE)', 14, y)

  y += 6
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...SCURO)
  doc.text(`Ragione Sociale: ${fornitore?.ragione_sociale || '—'}`, 14, y)
  y += 5
  doc.text(`Codice Fiscale / P.IVA: ${fornitore?.codice_fiscale || fornitore?.partita_iva || '—'}`, 14, y)

  y += 12
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...BLU)
  doc.text('DETTAGLIO COMPENSI E RITENUTE APPLICATE', 14, y)

  y += 6
  const body = fatture.map(f => [
    f.numero_fattura ? `N° ${f.numero_fattura}` : '—',
    formattaData(f.data_fattura),
    formattaData(f.data_pagamento),
    `€ ${(parseFloat(f.imponibile_ritenuta) || 0).toFixed(2)}`,
    `${parseFloat(f.aliquota_ritenuta_percentuale || 4)}%`,
    `€ ${(parseFloat(f.importo_ritenuta || f.ritenuta_acconto || 0)).toFixed(2)}`
  ])

  autoTable(doc, {
    startY: y,
    head: [['N° Fattura', 'Data Fatt.', 'Data Pag.', 'Imponibile Ritenuta', 'Aliquota', 'Ritenuta']],
    body,
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 2.5 },
    headStyles: { fillColor: BLU, textColor: [255, 255, 255] },
    margin: { left: 14, right: 14 }
  })
  
  y = doc.lastAutoTable.finalY + 12

  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...BLU)
  doc.text(`RIFERIMENTI DEL VERSAMENTO (MODELLO F24)`, 14, y)
  
  y += 6
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...TESTO)
  doc.text(`Stato Versamento: VERSATO (PAGATO)`, 14, y)
  y += 5
  doc.text(`Data di pagamento F24: ${formattaData(delegaF24?.data_pagamento)}`, 14, y)
  y += 5
  const codTributo = fatture[0]?.codice_tributo_f24 || '1019';
  doc.text(`Codice Tributo utilizzato: ${codTributo}`, 14, y)
  y += 5
  const totaleRitenutaVersata = fatture.reduce((sum, f) => sum + (parseFloat(f.importo_ritenuta || f.ritenuta_acconto || 0)), 0);
  doc.text(`Importo della ritenuta versata: € ${totaleRitenutaVersata.toFixed(2)}`, 14, y)
  
  applyWatermark(doc, withWatermark)
  
  const pdfOutput = doc.output('datauristring')
  const base64Data = pdfOutput.split(',')[1] || ''
  const filename = `Quietanza_Ritenuta_${(condominio?.nome || 'Condominio').replace(/\s+/g, '_')}_${(fornitore?.ragione_sociale || 'Fornitore').replace(/\s+/g, '_')}.pdf`

  return { base64Data, filename }
}
