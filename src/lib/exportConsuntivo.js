/**
 * exportConsuntivo.js — generatore PDF del consuntivo annuale (art. 1130-bis c.c.)
 * Branding da profiles (logo_base64 data-URL → jsPDF.addImage diretto).
 * Sezioni A→E + nota sintetica + confronto preventivo, secondo template profilo admin.
 * Dipendenze: jspdf, jspdf-autotable
 */
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

const eur = (v) => '€ ' + Number(v || 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const sgn = (v) => (Number(v) < 0 ? '−' : '') + '€ ' + Math.abs(Number(v || 0)).toLocaleString('it-IT', { minimumFractionDigits: 2 })

const HEAD = { fillColor: [37, 99, 235], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 }
const BODY = { font: 'helvetica', fontSize: 8, cellPadding: 2.2, textColor: [20, 20, 20], lineColor: [200, 200, 200] }

function intestazione(doc, condominio, esercizio, branding) {
  const W = doc.internal.pageSize.getWidth()
  let y = 14
  if (branding?.logo_base64) {
    try { doc.addImage(branding.logo_base64, 'PNG', 14, 10, 28, 28) } catch { /* ignore */ }
  }
  const x = branding?.logo_base64 ? 48 : 14
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(15, 23, 42)
  doc.text(branding?.studio_nome || 'Amministrazione', x, y); y += 6
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(80, 80, 80)
  if (branding?.studio_indirizzo) { doc.text(branding.studio_indirizzo, x, y); y += 5 }
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
    doc.text('Generato con CondoAI — documento di sintesi, ex art. 1130-bis c.c.', 14, H - 8)
    doc.text(`Pagina ${i} di ${n}`, W - 14, H - 8, { align: 'right' })
  }
}

function sezioneTitolo(doc, y, testo) {
  if (y > doc.internal.pageSize.getHeight() - 40) { doc.addPage(); y = 20 }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(37, 99, 235)
  doc.text(testo, 14, y)
  return y + 4
}

export async function exportConsuntivoPdf({ condominio, consuntivo, template, unita, getProprietario, getMillesimiUnita, getTotaleTabella, tabellaMillId }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const c = consuntivo
  let y = intestazione(doc, condominio, c.esercizio, c.branding)
  const sez = template?.sezioni || {}
  const etich = template?.etichette_categorie || {}
  const ordine = template?.ordine_categorie || Object.keys(c.competenza.catMap)
  const catLabel = (k) => etich[k] || k.toUpperCase()

  if (sez.competenza?.attiva !== false) {
    y = sezioneTitolo(doc, y, sez.competenza?.titolo || 'A — Rendiconto di competenza')
    const cats = [...ordine, ...Object.keys(c.competenza.catMap).filter(k => !ordine.includes(k))]
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
        if (d.section === 'body' && d.column.index === 6) { const raw = d.cell.raw || ''; if (String(raw).includes('−')) d.cell.styles.textColor = [220, 38, 38]; else if (String(raw) !== '€ 0,00') d.cell.styles.textColor = [22, 163, 74] }
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
        ['Totale uscite periodo', '−' + eur(d.uscite)],
    ['Saldo cassa finale', eur(d.saldoFinaleCassa)],
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
      f.data_fattura ? new Date(f.data_fattura).toLocaleDateString('it-IT') : '',
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
  }

  footer(doc)
  doc.save(`Consuntivo_${(condominio?.nome || '').replace(/\s+/g, '_')}_${c.esercizio?.anno || ''}.pdf`)
}
