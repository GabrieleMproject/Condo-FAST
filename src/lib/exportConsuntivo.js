/**
 * exportConsuntivo.js — generatore PDF del consuntivo annuale (art. 1130-bis c.c.)
 * Branding da profiles (logo_base64 data-URL → jsPDF.addImage diretto).
 * Sezioni A→E + nota sintetica + confronto preventivo, secondo template profilo admin.
 * Dipendenze: jspdf, jspdf-autotable
 */
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { applyWatermark } from './watermark'

const eur = (v) => '€ ' + Number(v || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const sgn = (v) => (Number(v) < 0 ? '-' : '') + '€ ' + Math.abs(Number(v || 0)).toLocaleString('it-IT', { minimumFractionDigits: 2 })
const formattaData = (d) => (d && !isNaN(new Date(d).getTime()) ? new Date(d).toLocaleDateString('it-IT') : '—')

const HEAD = { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 }
const BODY = { font: 'helvetica', fontSize: 8, cellPadding: 2.2, textColor: [20, 20, 20], lineColor: [200, 200, 200] }

function disegnaRiquadroConsumo(doc, x, y, titolo, valoreCorr, valorePrec, variazione, annoCorr, annoPrec, haPrecedente) {
  const W = 82
  const H = 58
  // Riquadro di sfondo chiaro
  doc.setFillColor(248, 250, 252) // slate 50
  doc.setDrawColor(226, 232, 240) // slate 200
  doc.setLineWidth(0.3)
  doc.rect(x, y, W, H, 'FD')

  // Titolo riquadro
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(30, 41, 59) // slate 800
  doc.text(titolo, x + 6, y + 8)

  // Badge variazione
  if (haPrecedente && valorePrec > 0) {
    const isRisparmio = variazione <= 0
    const badgeText = `${isRisparmio ? '' : '+'}${variazione}%`
    const badgeBg = isRisparmio ? [209, 250, 229] : [254, 226, 226] // green 100 vs red 100
    const badgeTextCol = isRisparmio ? [5, 150, 105] : [220, 38, 38] // green 600 vs red 600

    doc.setFillColor(...badgeBg)
    const textWidth = doc.getTextWidth(badgeText)
    const badgeW = textWidth + 5
    const badgeH = 4.5
    const badgeX = x + W - badgeW - 6
    const badgeY = y + 4.5
    doc.rect(badgeX, badgeY, badgeW, badgeH, 'F')
    
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(...badgeTextCol)
    doc.text(badgeText, badgeX + 2.5, badgeY + 3.4)
  }

  // Grafico a barre
  const maxVal = Math.max(valoreCorr, valorePrec, 100)
  const scale = 30 / maxVal // 30mm altezza massima

  const barW = 12
  const space = 10
  
  if (haPrecedente) {
    // Barra Anno Precedente
    const hPrec = valorePrec * scale
    const yPrec = y + 46 - hPrec
    const xPrec = x + 20
    doc.setFillColor(148, 163, 184)
    doc.rect(xPrec, yPrec, barW, hPrec, 'F')
    
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.setTextColor(100, 100, 100)
    doc.text(`€ ${Math.round(valorePrec)}`, xPrec + barW / 2, yPrec - 2, { align: 'center' })
    doc.text(String(annoPrec), xPrec + barW / 2, y + 51, { align: 'center' })

    // Barra Anno Corrente
    const hCorr = valoreCorr * scale
    const yCorr = y + 46 - hCorr
    const xCorr = xPrec + barW + space
    doc.setFillColor(37, 99, 235)
    doc.rect(xCorr, yCorr, barW, hCorr, 'F')
    
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(30, 41, 59)
    doc.text(`€ ${Math.round(valoreCorr)}`, xCorr + barW / 2, yCorr - 2, { align: 'center' })
    doc.text(String(annoCorr), xCorr + barW / 2, y + 51, { align: 'center' })
  } else {
    // Solo corrente
    const hCorr = valoreCorr * scale
    const yCorr = y + 46 - hCorr
    const xCorr = x + W / 2 - barW / 2
    doc.setFillColor(37, 99, 235)
    doc.rect(xCorr, yCorr, barW, hCorr, 'F')
    
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(30, 41, 59)
    doc.text(`€ ${Math.round(valoreCorr)}`, xCorr + barW / 2, yCorr - 2, { align: 'center' })
    
    doc.setFont('helvetica', 'normal')
    doc.text(String(annoCorr), xCorr + barW / 2, y + 51, { align: 'center' })
  }

  // Linea base
  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.2)
  doc.line(x + 10, y + 46, x + W - 10, y + 46)
}

function disegnaGraficoCategorie(doc, x, y, categorie, valoriCorr, valoriPrec, etichette, titolo, labelCorr, labelPrec, haPrecedente) {
  const W = 178
  const H = 68
  
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(30, 41, 59)
  doc.text(titolo, x, y - 4)

  // Legenda
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  
  doc.setFillColor(37, 99, 235)
  doc.rect(x + W - 56, y - 7.5, 3, 3, 'F')
  doc.setTextColor(80, 80, 80)
  doc.text(labelCorr, x + W - 51, y - 5)

  doc.setFillColor(148, 163, 184)
  doc.rect(x + W - 28, y - 7.5, 3, 3, 'F')
  doc.text(labelPrec, x + W - 23, y - 5)

  const graphH = 46
  const graphW = W - 22
  const startX = x + 18
  const endY = y + graphH

  const allVals = [...valoriCorr, ...valoriPrec]
  const maxVal = Math.max(...allVals, 100)
  const scale = (graphH - 8) / maxVal

  doc.setLineWidth(0.1)
  doc.setDrawColor(240, 240, 240)
  doc.setFontSize(6.5)
  doc.setTextColor(150, 150, 150)
  for (let i = 0; i <= 4; i++) {
    const val = Math.round((maxVal / 4) * i)
    const gridY = endY - (val * scale)
    doc.line(startX, gridY, x + W, gridY)
    doc.text(`€ ${val.toLocaleString('it-IT')}`, startX - 2, gridY + 2, { align: 'right' })
  }

  const numCats = categorie.length
  const groupW = graphW / numCats
  const barW = Math.min(8, groupW * 0.3)
  const space = barW * 0.25
  
  categorie.forEach((cat, idx) => {
    const valCorr = valoriCorr[idx] || 0
    const valPrec = valoriPrec[idx] || 0
    const centerX = startX + (groupW * idx) + (groupW / 2)
    
    if (haPrecedente) {
      const hPrec = valPrec * scale
      const yPrec = endY - hPrec
      const xPrec = centerX - barW - space / 2
      doc.setFillColor(148, 163, 184)
      doc.rect(xPrec, yPrec, barW, hPrec, 'F')
      if (valPrec > 0) {
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(6)
        doc.setTextColor(120, 120, 120)
        doc.text(Math.round(valPrec).toLocaleString('it-IT'), xPrec + barW / 2, yPrec - 1.5, { align: 'center' })
      }

      const hCorr = valCorr * scale
      const yCorr = endY - hCorr
      const xCorr = centerX + space / 2
      doc.setFillColor(37, 99, 235)
      doc.rect(xCorr, yCorr, barW, hCorr, 'F')
      if (valCorr > 0) {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(6)
        doc.setTextColor(30, 41, 59)
        doc.text(Math.round(valCorr).toLocaleString('it-IT'), xCorr + barW / 2, yCorr - 1.5, { align: 'center' })
      }
    } else {
      const hCorr = valCorr * scale
      const yCorr = endY - hCorr
      const xCorr = centerX - barW / 2
      doc.setFillColor(37, 99, 235)
      doc.rect(xCorr, yCorr, barW, hCorr, 'F')
      if (valCorr > 0) {
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(6)
        doc.setTextColor(30, 41, 59)
        doc.text(Math.round(valCorr).toLocaleString('it-IT'), xCorr + barW / 2, yCorr - 1.5, { align: 'center' })
      }
    }

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(80, 80, 80)
    const label = etichette[cat] || cat.toUpperCase()
    const displayLabel = label.length > 15 ? label.substring(0, 13) + '.' : label
    doc.text(displayLabel, centerX, endY + 4, { align: 'center' })
  })

  doc.setLineWidth(0.3)
  doc.setDrawColor(180, 180, 180)
  doc.line(startX, endY, x + W, endY)
}

function intestazione(doc, condominio, esercizio, branding) {
  const W = doc.internal.pageSize.getWidth()
  let y = 14
  if (branding?.logo_base64) {
    try {
      let format = 'PNG'
      if (branding.logo_base64.includes('image/jpeg') || branding.logo_base64.includes('image/jpg')) {
        format = 'JPEG'
      } else if (branding.logo_base64.includes('image/webp')) {
        format = 'WEBP'
      }
      doc.addImage(branding.logo_base64, format, 14, 10, 28, 28)
    } catch (e) {
      console.warn('Errore rendering logo nel PDF:', e)
    }
  }
  const x = branding?.logo_base64 ? 48 : 14
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(15, 23, 42)
  doc.text(branding?.ragione_sociale || branding?.studio_nome || 'Amministrazione', x, y); y += 6
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(80, 80, 80)
  if (branding?.studio_indirizzo) { doc.text(branding.studio_indirizzo, x, y); y += 5 }
  if (branding?.partita_iva) { doc.text(`P.IVA: ${branding.partita_iva}`, x, y); y += 4.5 }
  if (branding?.codice_fiscale) { doc.text(`C.F.: ${branding.codice_fiscale}`, x, y); y += 4.5 }
  if (branding?.studio_contatti) {
    String(branding.studio_contatti).split('\n').forEach(line => { if (line.trim()) { doc.text(line.trim(), x, y); y += 4.5 } })
  }
  y = Math.max(y, 42)
  doc.setDrawColor(37, 99, 235); doc.setLineWidth(0.5); doc.line(14, y, W - 14, y); y += 8
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(15, 23, 42)
  doc.text(`CONSUNTIVO ${esercizio?.anno || ''}`, 14, y)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(80, 80, 80)
  doc.text(condominio?.nome || 'Condominio', W - 14, y - 5, { align: 'right' })
  if (condominio?.indirizzo) doc.text(condominio.indirizzo, W - 14, y, { align: 'right' })
  if (condominio?.codice_fiscale) doc.text(`c.f. ${condominio.codice_fiscale}`, W - 14, y + 5, { align: 'right' })
  return y + 12
}

function footer(doc) {
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight()
  const n = doc.internal.getNumberOfPages()
  for (let i = 1; i <= n; i++) {
    doc.setPage(i); doc.setFontSize(7.5); doc.setTextColor(120, 120, 120)
    doc.text('Generato con CondoSmart — documento di sintesi, ex art. 1130-bis c.c.', 14, H - 8)
    doc.text(`Pagina ${i} di ${n}`, W - 14, H - 8, { align: 'right' })
  }
}

function sezioneTitolo(doc, y, testo) {
  if (y > doc.internal.pageSize.getHeight() - 40) { doc.addPage(); y = 20 }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(37, 99, 235)
  doc.text(testo, 14, y)
  return y + 4
}

export async function exportConsuntivoPdf({ condominio, consuntivo, template, unita, getProprietario, getMillesimiUnita, getTotaleTabella, tabellaMillId, withWatermark = false }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const c = consuntivo
  let y = intestazione(doc, condominio, c.esercizio, c.branding)
  const sez = template?.sezioni || {}
  const etich = template?.etichette_categorie || {}
  const ordine = template?.ordine_categorie || Object.keys(c?.competenza?.catMap || {})
  const catLabel = (k) => etich[k] || k.toUpperCase()

  if (sez.competenza?.attiva !== false) {
    y = sezioneTitolo(doc, y, sez.competenza?.titolo || 'B — Rendiconto di competenza')
    const cats = [...ordine, ...Object.keys(c?.competenza?.catMap || {}).filter(k => !ordine.includes(k))]
    const body = []
    cats.forEach(k => {
      const v = c.competenza.catMap[k]
      if (!v) return
      const tot = v.ordinaria + v.straordinaria
      if (tot === 0) return
      body.push([catLabel(k), v.straordinaria > 0 ? 'straordinaria' : 'ordinaria', eur(tot)])
    })
    body.push(['TOTALE SPESE ORDINARIE', '', eur(c.competenza.totOrd)])
    if (c.competenza.totStr > 0) body.push(['TOTALE SPESE STRAORDINARIE', '', eur(c.competenza.totStr)])
    body.push(['TOTALE CONSUNTIVO', '', eur(c.competenza.totSpese)])
    autoTable(doc, { startY: y, head: [['Categoria', 'Tipo', 'Importo']], body,
      theme: 'grid', styles: BODY, headStyles: HEAD, margin: { left: 14, right: 14 },
      columnStyles: { 2: { halign: 'right' } },
      didParseCell: (d) => { if (d.section === 'body' && d.row.index >= body.length - (c.competenza.totStr > 0 ? 3 : 2)) { d.cell.styles.fontStyle = 'bold'; d.cell.styles.fillColor = [219, 234, 254] } } })
    y = doc.lastAutoTable.finalY + 10
  }

  if (sez.riparto?.attiva !== false) {
    y = sezioneTitolo(doc, y, sez.riparto?.titolo || 'C — Riparto per unità')
    const totMill = getTotaleTabella ? (getTotaleTabella(tabellaMillId) || 0) : 0
    const head = [['Unità', 'Proprietario', 'Millesimi', 'Dovuto', 'Versato', 'Saldo iniz.', 'Conguaglio', 'Arretrati']]
    const rowByUnit = {}; c.riparto.unitaRows.forEach(r => { rowByUnit[r.unita_id] = r })
    const body = (unita || []).map(u => {
      const r = rowByUnit[u.id] || { dovuto: 0, versato: 0, saldoIniz: 0, conguaglio: 0, arretrati: 0 }
      const p = getProprietario ? getProprietario(u) : null
      const mill = getMillesimiUnita ? getMillesimiUnita(tabellaMillId, u.id) : ''
      return [
        `U. ${u.numero}`,
        p ? `${p.cognome || ''} ${p.nome || ''}`.trim() : '',
        mill ? Number(mill).toLocaleString('it-IT', { minimumFractionDigits: 2 }) : '',
        eur(r.dovuto), eur(r.versato), sgn(r.saldoIniz), sgn(r.conguaglio), eur(r.arretrati),
      ]
    })
    const t = c.riparto.tot
    body.push(['TOTALI', '', totMill ? Number(totMill).toLocaleString('it-IT', { minimumFractionDigits: 2 }) : '',
      eur(t.dovuto), eur(t.versato), sgn(t.saldoIniz), sgn(t.conguaglio), eur(t.arretrati)])
    autoTable(doc, { startY: y, head, body, theme: 'grid', styles: { ...BODY, fontSize: 7.5 }, headStyles: HEAD,
      margin: { left: 10, right: 10 },
      columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right' }, 7: { halign: 'right' } },
      didParseCell: (d) => {
        if (d.section === 'body' && d.row.index === body.length - 1) { d.cell.styles.fontStyle = 'bold'; d.cell.styles.fillColor = [219, 234, 254] }
        if (d.section === 'body' && d.column.index === 6) { const raw = d.cell.raw || ''; if (String(raw).includes('-')) d.cell.styles.textColor = [220, 38, 38]; else if (String(raw) !== '€ 0,00') d.cell.styles.textColor = [22, 163, 74] }
      } })
    doc.setFontSize(7.5); doc.setTextColor(120, 120, 120)
    doc.text('(*) Saldo negativo = debito verso il Condominio; positivo = credito a favore del condomino.', 14, doc.lastAutoTable.finalY + 5)
    y = doc.lastAutoTable.finalY + 12
  }

  if (sez.cassa?.attiva !== false) {
    y = sezioneTitolo(doc, y, sez.cassa?.titolo || 'D — Situazione di cassa')
    const d = c.cassa
    autoTable(doc, { startY: y, theme: 'plain', styles: BODY, margin: { left: 14, right: 14 },
      body: [
        ['Saldo cassa iniziale', eur(d.saldoInizCassa)],
        ['Totale entrate periodo', eur(d.entrate)],
        ['Totale uscite periodo', d.uscite > 0 ? ('-' + eur(d.uscite)) : eur(0)],
        ['Saldo cassa finale', sgn(d.saldoFinaleCassa)],
        ['Risultato di competenza (versato − spese)', sgn(d.saldoCompetenza)],
        ['Quadratura competenza ↔ cassa', sgn(d.scartoQuadratura)],
      ],
      columnStyles: { 1: { halign: 'right' } },
      didParseCell: (x) => { if (x.row.index === 3 || x.row.index === 5) { x.cell.styles.fontStyle = 'bold' } } })
    doc.setFontSize(7.5); doc.setTextColor(120, 120, 120)
    doc.text('Nota: il fondo di riserva non è gestito automaticamente; va riportato manualmente se presente.', 14, doc.lastAutoTable.finalY + 5)
    y = doc.lastAutoTable.finalY + 12
  }

  if (sez.fatture?.attiva !== false && c.fatture.rows.length) {
    y = sezioneTitolo(doc, y, sez.fatture?.titolo || 'E — Situazione fatture')
    const body = c.fatture.rows.map(f => [
      f.fornitore || '', f.numero_fattura || '—',
      f.data_fattura ? formattaData(f.data_fattura) : '',
      eur(f.importo_totale), f.stato || '', f.ritenutaBadge || '—',
    ])
    body.push(['TOTALE', '', '', eur(c.fatture.tot.totale), `pagate ${eur(c.fatture.tot.pagate)}`, c.fatture.tot.attesaF24 ? `${c.fatture.tot.attesaF24} att. F24` : ''])
    autoTable(doc, { startY: y, head: [['Fornitore', 'N° fatt.', 'Data', 'Importo', 'Stato', 'Ritenuta/F24']],
      body, theme: 'grid', styles: { ...BODY, fontSize: 7.5 }, headStyles: HEAD, margin: { left: 14, right: 14 },
      columnStyles: { 3: { halign: 'right' } },
      didParseCell: (d) => { if (d.section === 'body' && d.row.index === body.length - 1) { d.cell.styles.fontStyle = 'bold'; d.cell.styles.fillColor = [219, 234, 254] } } })
    y = doc.lastAutoTable.finalY + 12
  }

  if (sez.confronto_prev?.attiva !== false && c.confronto.rows.length) {
    y = sezioneTitolo(doc, y, sez.confronto_prev?.titolo || 'Confronto Preventivo / Consuntivo')
    const body = c.confronto.rows.map(r => [catLabel(r.categoria), eur(r.preventivo), eur(r.consuntivo), sgn(r.differenza)])
    body.push(['TOTALE', eur(c.confronto.tot.preventivo), eur(c.confronto.tot.consuntivo), sgn(c.confronto.tot.differenza)])
    autoTable(doc, { startY: y, head: [['Categoria', 'Preventivo', 'Consuntivo', 'Differenza']],
      body, theme: 'grid', styles: BODY, headStyles: HEAD, margin: { left: 14, right: 14 },
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
      didParseCell: (d) => { if (d.section === 'body' && d.row.index === body.length - 1) { d.cell.styles.fontStyle = 'bold'; d.cell.styles.fillColor = [219, 234, 254] } } })
    y = doc.lastAutoTable.finalY + 12
  }

  // SEZIONE F — Grafici & Analisi Storica dei Consumi
  const storico = c?.storico
  if (storico) {
    doc.addPage()
    y = 20
    y = sezioneTitolo(doc, y, 'F — Grafici & Analisi Storica dei Consumi')
    y += 10

    // Disegno grafico Categorie principali (le prime 5 categorie)
    const cats = [...ordine, ...Object.keys(c?.competenza?.catMap || {}).filter(k => !ordine.includes(k))]
    const activeCats = cats.filter(k => {
      const v = c?.competenza?.catMap?.[k]
      return v && (v.ordinaria + v.straordinaria) > 0
    }).slice(0, 5)
    
    const valoriCorr = activeCats.map(k => {
      const v = c?.competenza?.catMap?.[k]
      return v ? (v.ordinaria + v.straordinaria) : 0
    })
    const valoriPrec = activeCats.map(k => (storico?.speseCategoriePrec?.[k]) || 0)

    const labelCorr = `Consuntivo ${c.esercizio?.anno || ''}`
    const labelPrec = storico.haPrecedente ? `Consuntivo ${storico.annoPrecedente}` : 'Preventivo (N.D.)'

    disegnaGraficoCategorie(
      doc, 16, y, activeCats, valoriCorr, valoriPrec, etich, 
      'Confronto Spese per Categoria (€)', labelCorr, labelPrec, storico.haPrecedente
    )
    
    y += 62

    // Disegno riquadri per consumi specifici
    const xEnergia = 16
    const xGas = 112
    
    disegnaRiquadroConsumo(
      doc, xEnergia, y, 'CONSUMI ENERGIA ELETTRICA', 
      storico?.energia?.corrente || 0, storico?.energia?.precedente || 0, storico?.energia?.variazione || 0, 
      c.esercizio?.anno, storico.annoPrecedente, storico.haPrecedente
    )
    
    disegnaRiquadroConsumo(
      doc, xGas, y, 'CONSUMI RISCALDAMENTO & GAS', 
      storico?.riscaldamento?.corrente || 0, storico?.riscaldamento?.precedente || 0, storico?.riscaldamento?.variazione || 0, 
      c.esercizio?.anno, storico.annoPrecedente, storico.haPrecedente
    )
    
    y += 70
  }

  if (sez.nota_sintetica?.attiva !== false) {
    if (y > doc.internal.pageSize.getHeight() - 60) { doc.addPage(); y = 20 }
    y = sezioneTitolo(doc, y, sez.nota_sintetica?.titolo || 'Nota sintetica esplicativa')
    const dis = c.competenza.totSpese - c.riparto.tot.versato
    const esito = dis > 0 ? `un disavanzo di ${eur(dis)}` : dis < 0 ? `un avanzo di ${eur(-dis)}` : 'un pareggio'
    const txt =
      `La gestione ${c.esercizio?.anno || ''} si è chiusa con ${esito}: a fronte di versamenti per ` +
      `${eur(c.riparto.tot.versato)} sono state sostenute spese di competenza per ${eur(c.competenza.totSpese)}. ` +
      `Il riparto per unità e i relativi conguagli sono dettagliati nella sezione "Riparto per unità". ` +
      `Ai sensi dell'art. 1130-bis c.c., i condomini e i titolari di diritti reali o di godimento sulle unità ` +
      `immobiliari possono prendere visione dei documenti giustificativi di spesa in ogni tempo ed estrarne copia a proprie spese.`
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(40, 40, 40)
    const lines = doc.splitTextToSize(txt, doc.internal.pageSize.getWidth() - 28)
    doc.text(lines, 14, y + 2)
    y += lines.length * 5 + 10
  }

  // Riepilogo Attività & Gestione Studio (Pro-Admin)
  if (c.attivitaStudio) {
    if (y > doc.internal.pageSize.getHeight() - 55) { doc.addPage(); y = 20 }
    y = sezioneTitolo(doc, y, 'Riepilogo Attività & Gestione Studio')
    
    autoTable(doc, {
      startY: y + 2,
      head: [['Attività Operativa', 'Dettaglio Esecuzione']],
      body: [
        ['Fatture e Giustificativi di Spesa Elaborati', `${c.attivitaStudio.fattureElaborate || 0} documenti registrati e verificati`],
        ['Pratiche Ritenute d\'Acconto e F24', `${c.attivitaStudio.ritenuteGestite || 0} ritenute elaborate per la dichiarazione`],
        ['Riconciliazioni Bancarie Effettuate', `${c.attivitaStudio.movimentiRiconciliati || 0} movimenti bancari abbinati`],
        ['Comunicazioni e Solleciti Gestiti', `${c.attivitaStudio.comunicazioniInviate || 0} invii di sollecito/avviso registrati`],
      ],
      headStyles: HEAD,
      bodyStyles: BODY,
      margin: { left: 14, right: 14 },
    })
  }

  footer(doc)
  applyWatermark(doc, withWatermark)
  if (c.returnDoc) {
    return doc.output('arraybuffer')
  }
  doc.save(`Consuntivo_${(condominio?.nome || '').replace(/\s+/g, '_')}_${c.esercizio?.anno || ''}.pdf`)
}
