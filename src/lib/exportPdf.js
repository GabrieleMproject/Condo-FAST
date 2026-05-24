/**
 * exportPdf.js
 * Genera PDF con:
 * - Intestazione condominio
 * - Prospetto ripartizione spese
 * - Tabella rate per unità
 *
 * Dipendenze: npm install jspdf jspdf-autotable
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const BLU = [37, 99, 235];       // #2563eb
const DARK = [15, 23, 42];       // #0f172a
const CARD = [30, 41, 59];       // #1e293b
const TESTO = [226, 232, 240];   // #e2e8f0
const GRIGIO = [100, 116, 139];  // #64748b

function fmtEuro(v) {
  if (v === null || v === undefined) return '';
  return '€ ' + Number(v).toLocaleString('it-IT', { minimumFractionDigits: 2 });
}

function fmtData(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('it-IT');
}

// ─── Intestazione comune ─────────────────────────────────────────────────────
function disegnaIntestazione(doc, condominio, esercizio, titoloDoc) {
  const W = doc.internal.pageSize.getWidth();

  // Sfondo header
  doc.setFillColor(...DARK);
  doc.rect(0, 0, W, 42, 'F');

  // Barra blu a sinistra
  doc.setFillColor(...BLU);
  doc.rect(0, 0, 4, 42, 'F');

  // Logo testo CONDOAI
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...BLU);
  doc.text('CONDOAI', 12, 12);

  // Nome condominio
  doc.setFontSize(15);
  doc.setTextColor(...TESTO);
  doc.text(condominio?.nome || 'Condominio', 12, 23);

  // Indirizzo
  if (condominio?.indirizzo) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...GRIGIO);
    doc.text(condominio.indirizzo, 12, 31);
  }

  // Codice fiscale
  if (condominio?.codice_fiscale) {
    doc.text(`C.F.: ${condominio.codice_fiscale}`, 12, 38);
  }

  // Titolo documento (destra)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...TESTO);
  doc.text(titoloDoc, W - 14, 18, { align: 'right' });

  // Esercizio
  if (esercizio) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...GRIGIO);
    doc.text(`Esercizio ${esercizio.anno}`, W - 14, 26, { align: 'right' });
    doc.text(`${fmtData(esercizio.data_inizio)} — ${fmtData(esercizio.data_fine)}`, W - 14, 33, { align: 'right' });
  }

  // Data stampa
  doc.setFontSize(8);
  doc.setTextColor(...GRIGIO);
  doc.text(`Stampato il ${new Date().toLocaleDateString('it-IT')}`, W - 14, 40, { align: 'right' });

  return 50; // y iniziale contenuto
}

// ─── Footer pagina ────────────────────────────────────────────────────────────
function aggiungiFooter(doc) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const pageCount = doc.internal.getNumberOfPages();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFillColor(30, 41, 59);
    doc.rect(0, H - 12, W, 12, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...GRIGIO);
    doc.text('CondoAI — Gestionale Condominiale', 10, H - 4);
    doc.text(`Pagina ${i} di ${pageCount}`, W - 10, H - 4, { align: 'right' });
  }
}

// ─── Export Ripartizione ──────────────────────────────────────────────────────
export async function exportRipartizionePdf({ condominio, esercizio, spese, unita, ripartizioni }) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  let y = disegnaIntestazione(doc, condominio, esercizio, 'PROSPETTO RIPARTIZIONE SPESE');

  // Riepilogo KPI
  const totSpese = spese.reduce((a, s) => a + (s.importo || 0), 0);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...TESTO);
  doc.text(`Totale spese esercizio: ${fmtEuro(totSpese)}   |   N° spese: ${spese.length}   |   N° unità: ${unita.length}`, 14, y);
  y += 8;

  // Costruisci colonne dinamiche (prima 4 fisse + una per ogni unità)
  const unitaHeader = unita.map(u => `Un. ${u.numero}`);
  const head = [['Descrizione spesa', 'Categoria', 'Criterio', 'Totale €', ...unitaHeader, 'Tot. Rip.']];

  const body = spese.map(s => {
    const rips = ripartizioni.filter(r => r.spesa_id === s.id);
    const importiPerUnita = unita.map(u => {
      const r = rips.find(r => r.unita_id === u.id);
      if (!r) return '';
      const imp = r.override_manuale ? (r.importo_override ?? r.importo) : r.importo;
      return fmtEuro(imp);
    });
    const totRip = rips.reduce((acc, r) => acc + (r.override_manuale ? (r.importo_override ?? r.importo) : r.importo), 0);
    return [
      s.descrizione,
      s.categoria || '',
      s.criterio_ripartizione || '',
      fmtEuro(s.importo),
      ...importiPerUnita,
      fmtEuro(totRip),
    ];
  });

  // Riga totali
  const totaliUnita = unita.map(u => {
    const t = ripartizioni
      .filter(r => r.unita_id === u.id && spese.find(s => s.id === r.spesa_id))
      .reduce((acc, r) => acc + (r.override_manuale ? (r.importo_override ?? r.importo) : r.importo), 0);
    return fmtEuro(t);
  });
  body.push(['TOTALE', '', '', fmtEuro(totSpese), ...totaliUnita, fmtEuro(totSpese)]);

  autoTable(doc, {
    startY: y,
    head,
    body,
    theme: 'grid',
    styles: {
      font: 'helvetica', fontSize: 7.5,
      cellPadding: 2.5, textColor: [226, 232, 240],
      fillColor: [15, 23, 42], lineColor: [30, 41, 59],
    },
    headStyles: {
      fillColor: BLU, textColor: [255, 255, 255],
      fontStyle: 'bold', fontSize: 7,
    },
    alternateRowStyles: { fillColor: [24, 35, 55] },
    foot: [],
    didParseCell: (data) => {
      // Evidenzia riga totali
      if (data.row.index === body.length - 1) {
        data.cell.styles.fillColor = [37, 99, 235];
        data.cell.styles.textColor = [255, 255, 255];
        data.cell.styles.fontStyle = 'bold';
      }
    },
    margin: { left: 10, right: 10 },
  });

  aggiungiFooter(doc);

  doc.save(`CondoAI_Ripartizione_${condominio?.nome?.replace(/\s+/g, '_') || ''}_${esercizio?.anno || ''}.pdf`);
}

// ─── Export Rate ──────────────────────────────────────────────────────────────
export async function exportRatePdf({ condominio, esercizio, rate, unita }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  let y = disegnaIntestazione(doc, condominio, esercizio, 'PIANO RATE');

  const body = [...(rate || [])].sort((a, b) => {
    const ua = unita.find(u => u.id === a.unita_id)?.numero || '';
    const ub = unita.find(u => u.id === b.unita_id)?.numero || '';
    if (ua !== ub) return ua.localeCompare(ub);
    return new Date(a.data_scadenza) - new Date(b.data_scadenza);
  }).map(r => {
    const u = unita.find(un => un.id === r.unita_id);
    const prop = u?.occupanti?.find(o => o.tipo_occupante === 'proprietario');
    return [
      u?.numero || '',
      prop?.persona?.nominativo || '',
      r.numero_rata || '',
      fmtData(r.data_scadenza),
      fmtEuro(r.importo),
      r.stato || '',
      r.data_pagamento ? fmtData(r.data_pagamento) : '',
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [['Unità', 'Proprietario', 'N° Rata', 'Scadenza', 'Importo', 'Stato', 'Pagato il']],
    body,
    theme: 'grid',
    styles: {
      font: 'helvetica', fontSize: 8.5,
      cellPadding: 3, textColor: [226, 232, 240],
      fillColor: [15, 23, 42], lineColor: [30, 41, 59],
    },
    headStyles: { fillColor: BLU, textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [24, 35, 55] },
    columnStyles: {
      0: { cellWidth: 16 },
      2: { cellWidth: 18 },
      3: { cellWidth: 24 },
      4: { cellWidth: 24, halign: 'right' },
      5: { cellWidth: 22 },
      6: { cellWidth: 24 },
    },
    margin: { left: 14, right: 14 },
  });

  aggiungiFooter(doc);
  doc.save(`CondoAI_Rate_${condominio?.nome?.replace(/\s+/g, '_') || ''}_${esercizio?.anno || ''}.pdf`);
}
