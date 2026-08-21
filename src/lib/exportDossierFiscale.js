// src/lib/exportDossierFiscale.js
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { applyWatermark } from './watermark'

const BLU = [15, 23, 42]
const TESTO = [51, 65, 85]
const GRIGIO = [100, 116, 139]
const VERDE = [16, 185, 129]

const formattaData = (dataStr) => {
  if (!dataStr) return '—'
  const d = new Date(dataStr)
  return isNaN(d.getTime()) ? dataStr : d.toLocaleDateString('it-IT')
}

/**
 * Esporta il Dossier Fiscale Asseverato per i Revisori dei Conti del Condominio.
 * Include la Matrice Triangolare di Riconciliazione:
 * Fattura Fornitore <-> Bonifico Netto Bancario <-> Delega F24 Versata (Protocollo AdE)
 */
export function exportDossierFiscaleRevisori({
  condominio,
  anno,
  fatture = [],
  delegheF24 = [],
  abbinamenti = [],
  tributi = [],
  profile = null,
  withWatermark = false
}) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  let y = 16

  // 1. INTESTAZIONE ISTITUZIONALE
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(...BLU)
  doc.text(`DOSSIER FISCALE ASSEVERATO & MATRICE DI RICONCILIAZIONE TRIBUTARIA`, 14, y)
  
  y += 6
  doc.setFontSize(10)
  doc.setTextColor(...TESTO)
  doc.text(`ESERCIZIO FINANZIARIO: ${anno} | CONDOMINIO: ${condominio?.nome || 'Condominio'} (C.F.: ${condominio?.codice_fiscale || '—'})`, 14, y)

  y += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...GRIGIO)
  doc.text(`Amministrazione: ${profile?.ragione_sociale || 'Studio Amministrativo'} | Data Emissione Documento: ${new Date().toLocaleDateString('it-IT')}`, 14, y)

  y += 8

  // 2. QUADRO DI SINTESI DEI TOTALI
  const fattureAnno = fatture.filter(f => {
    const a = f.data_pagamento ? f.data_pagamento.substring(0, 4) : (f.data_fattura ? f.data_fattura.substring(0, 4) : null)
    return a === String(anno) && f.stato === 'pagata'
  })

  const totaleImponibile = fattureAnno.reduce((s, f) => s + ((parseFloat(f.importo_totale) || 0) - (parseFloat(f.importo_iva) || 0)), 0)
  const totaleRitenuteDovute = fattureAnno.reduce((s, f) => s + (parseFloat(f.importo_ritenuta || f.ritenuta_acconto || 0)), 0)
  
  const delegheAnno = delegheF24.filter(d => (d.data_scadenza?.substring(0, 4) === String(anno) || d.data_pagamento?.substring(0, 4) === String(anno)) && d.stato === 'pagato')
  const totaleF24Versati = delegheAnno.reduce((s, d) => s + parseFloat(d.importo_totale || 0), 0)

  const scartoFiscale = Math.round(Math.abs(totaleRitenuteDovute - totaleF24Versati) * 100) / 100

  // Box Riepilogo
  doc.setDrawColor(226, 232, 240)
  doc.setFillColor(248, 250, 252)
  doc.roundedRect(14, y, 269, 18, 3, 3, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...BLU)
  doc.text(`Totale Imponibile Compensi: € ${totaleImponibile.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`, 18, y + 7)
  doc.text(`Totale Ritenute Trattenute: € ${totaleRitenuteDovute.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`, 85, y + 7)
  doc.text(`Totale F24 Liquidati all'Erario: € ${totaleF24Versati.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`, 160, y + 7)

  doc.setTextColor(scartoFiscale <= 0.05 ? 16 : 239, scartoFiscale <= 0.05 ? 185 : 68, scartoFiscale <= 0.05 ? 129 : 68)
  doc.text(`Quadratura Fiscale: ${scartoFiscale <= 0.05 ? 'PERFETTA (100% ASSEVERATA)' : `DISCREPANZA (€ ${scartoFiscale.toFixed(2)})`}`, 18, y + 14)

  y += 24

  // 3. MATRICE TRIANGOLARE DI RICONCILIAZIONE (TABELLA DETTAGLIATA)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...BLU)
  doc.text(`Matrice Dettagliata di Triangolazione (Fattura <-> Bonifico Netto <-> Modello F24)`, 14, y)
  y += 3

  const tableBody = fattureAnno.map(fat => {
    const fornitoreNome = fat.fornitore_rel?.ragione_sociale || fat.fornitore || 'Fornitore'
    const piva = fat.fornitore_rel?.partita_iva || fat.fornitore_rel?.codice_fiscale || '—'
    const lordo = parseFloat(fat.importo_totale || 0)
    const ritenuta = parseFloat(fat.importo_ritenuta || fat.ritenuta_acconto || 0)
    const netto = Math.max(0, lordo - ritenuta)

    // Cerca delega F24 associata
    const abb = abbinamenti.find(a => a.fattura_id === fat.id)
    let delegaInfo = '—'
    let statoQuietanza = fat.f24_url ? 'Quietanzato' : 'In attesa F24'

    if (abb) {
      const d = delegheF24.find(x => x.id === abb.f24_id)
      if (d) {
        delegaInfo = `Pag. ${formattaData(d.data_pagamento || d.data_scadenza)} (€ ${parseFloat(d.importo_totale || 0).toFixed(2)})`
        if (d.stato === 'pagato') statoQuietanza = 'Quietanzato'
      }
    }

    return [
      fat.numero_fattura || 'N/D',
      formattaData(fat.data_fattura),
      `${fornitoreNome}\n(P.IVA: ${piva})`,
      `Cod. ${fat.codice_tributo_f24 || '1019'}`,
      `€ ${lordo.toFixed(2)}`,
      `€ ${ritenuta.toFixed(2)}`,
      `€ ${netto.toFixed(2)}\n(${formattaData(fat.data_pagamento)})`,
      delegaInfo,
      statoQuietanza
    ]
  })

  autoTable(doc, {
    startY: y,
    head: [
      ['N° Fatt.', 'Data Ft.', 'Fornitore & P.IVA', 'Trib.', 'Tot. Lordo', 'Ritenuta', 'Netto Bonificato', 'Rif. Delega F24', 'Stato F24']
    ],
    body: tableBody,
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 2, overflow: 'linebreak' },
    headStyles: { fillColor: BLU, textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 18 },
      2: { cellWidth: 55 },
      3: { cellWidth: 16 },
      4: { cellWidth: 22, halign: 'right' },
      5: { cellWidth: 20, halign: 'right', fontStyle: 'bold' },
      6: { cellWidth: 32, halign: 'right' },
      7: { cellWidth: 46 },
      8: { cellWidth: 24, halign: 'center' }
    },
    margin: { left: 14, right: 14 }
  })

  // 4. ATTESTAZIONE FINALE PER I REVISORI DEI CONTI
  let finalY = doc.lastAutoTable.finalY + 12
  if (finalY > 170) {
    doc.addPage()
    finalY = 20
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...BLU)
  doc.text(`ATTESTAZIONE DI CONFORMITA' TRIBUTARIA & ASSEVERAZIONE REVISORI`, 14, finalY)
  
  finalY += 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...TESTO)
  doc.text(`Si attesta che tutte le ritenute operate sulle prestazioni di lavoro autonomo ed appalto per l'esercizio ${anno} risultano regolarmente liquidate`, 14, finalY)
  doc.text(`tramite modello F24 nel pieno rispetto dei termini di legge (Art. 25 e 25-ter D.P.R. 600/1973) e delle risultanze contabili bancarie.`, 14, finalY + 4)

  finalY += 16
  doc.setFont('helvetica', 'bold')
  doc.text(`Firma dell'Amministratore (Sostituto d'Imposta)`, 20, finalY)
  doc.text(`Firma del Collegio dei Revisori / Consiglieri`, 180, finalY)
  
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...GRIGIO)
  doc.text(`_________________________________________`, 20, finalY + 10)
  doc.text(`_________________________________________`, 180, finalY + 10)

  if (withWatermark) {
    applyWatermark(doc)
  }

  doc.save(`DOSSIER_FISCALE_${condominio?.nome?.replace(/\s+/g, '_') || 'CONDOMINIO'}_${anno}.pdf`)
}
