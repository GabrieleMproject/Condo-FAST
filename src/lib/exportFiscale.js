import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { applyWatermark } from './watermark'

const BLU = [15, 23, 42]
const TESTO = [51, 65, 85]
const GRIGIO = [100, 116, 139]

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
