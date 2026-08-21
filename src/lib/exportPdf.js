/**
 * exportPdf.js
 * Intestazione condominio + prospetto ripartizione + rate per unità.
 * Allineato a schema post-S8a: rate (colonne) + rate_unita (celle).
 * Dipendenze: jspdf, jspdf-autotable
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { applyWatermark } from './watermark';

const BLU = [37, 99, 235];
const DARK = [15, 23, 42];
const TESTO = [51, 65, 85];
const GRIGIO = [100, 116, 139];
const LINEA_BORDO = [200, 200, 200];
const SFONDO_ALT = [241, 245, 249];

function fmtEuro(v) {
  if (v === null || v === undefined) return '';
  return '€ ' + Number(v).toLocaleString('it-IT', { minimumFractionDigits: 2 });
}
function fmtData(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('it-IT');
}

function disegnaIntestazione(doc, condominio, esercizio, titoloDoc) {
  const W = doc.internal.pageSize.getWidth();
  
  // Testata chiara: nessun rettangolo di sfondo. Disegniamo solo la linea blu divisoria in basso.
  doc.setDrawColor(...BLU); doc.setLineWidth(0.5); doc.line(10, 42, W - 10, 42);

  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...BLU);
  doc.text('CONDOFAST', 12, 12);
  doc.setFontSize(15); doc.setTextColor(...DARK);
  doc.text(condominio?.nome || 'Condominio', 12, 23);
  
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...GRIGIO);
  if (condominio?.indirizzo) {
    doc.text(condominio.indirizzo, 12, 31);
  }
  if (condominio?.codice_fiscale) {
    doc.text(`C.F.: ${condominio.codice_fiscale}`, 12, 38);
  }

  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...DARK);
  doc.text(titoloDoc, W - 14, 18, { align: 'right' });
  if (esercizio) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...GRIGIO);
    doc.text(`Esercizio ${esercizio.anno}`, W - 14, 26, { align: 'right' });
    doc.text(`${fmtData(esercizio.data_inizio)} — ${fmtData(esercizio.data_fine)}`, W - 14, 33, { align: 'right' });
  }
  doc.setFontSize(8); doc.setTextColor(...GRIGIO);
  doc.text(`Stampato il ${new Date().toLocaleDateString('it-IT')}`, W - 14, 40, { align: 'right' });
  return 50;
}

function aggiungiFooter(doc) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    // Footer chiaro: disegnamo una linea sottile grigia orizzontale anziché un rettangolo pieno.
    doc.setDrawColor(...LINEA_BORDO); doc.setLineWidth(0.3); doc.line(10, H - 12, W - 10, H - 12);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...GRIGIO);
    doc.text('CondoFAST — Gestionale Condominiale', 10, H - 5);
    doc.text(`Pagina ${i} di ${pageCount}`, W - 10, H - 5, { align: 'right' });
  }
}

// ─── Export Ripartizione ──────────────────────────────────────────────
export async function exportRipartizionePdf({ condominio, esercizio, spese, unita, ripartizioni }, withWatermark = false) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  let y = disegnaIntestazione(doc, condominio, esercizio, 'PROSPETTO RIPARTIZIONE SPESE');

  const totSpese = spese.reduce((a, s) => a + (s.importo || 0), 0);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...DARK);
  doc.text(`Totale spese esercizio: ${fmtEuro(totSpese)}   |   N° spese: ${spese.length}   |   N° unità: ${unita.length}`, 14, y);
  y += 8;

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
      s.criterio || '',
      fmtEuro(s.importo),
      ...importiPerUnita,
      fmtEuro(totRip),
    ];
  });

  const totaliUnita = unita.map(u => {
    const t = ripartizioni
      .filter(r => r.unita_id === u.id && spese.find(s => s.id === r.spesa_id))
      .reduce((acc, r) => acc + (r.override_manuale ? (r.importo_override ?? r.importo) : r.importo), 0);
    return fmtEuro(t);
  });
  body.push(['TOTALE', '', '', fmtEuro(totSpese), ...totaliUnita, fmtEuro(totSpese)]);

  autoTable(doc, {
    startY: y, head, body, theme: 'grid',
    styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 2.5, textColor: [20, 20, 20], fillColor: [255, 255, 255], lineColor: LINEA_BORDO },
    headStyles: { fillColor: BLU, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7 },
    alternateRowStyles: { fillColor: SFONDO_ALT },
    didParseCell: (data) => {
      if (data.row.index === body.length - 1) {
        data.cell.styles.fillColor = [219, 234, 254];
        data.cell.styles.textColor = [15, 23, 42];
        data.cell.styles.fontStyle = 'bold';
      }
    },
    margin: { left: 10, right: 10 },
  });

  aggiungiFooter(doc);
  applyWatermark(doc, withWatermark);
  doc.save(`CondoFAST_Ripartizione_${condominio?.nome?.replace(/\s+/g, '_') || ''}_${esercizio?.anno || ''}.pdf`);
}

// ─── Export Rate (modello rate_unita) ─────────────────────────────────
// Parametri: rate (colonne), cells (rate_unita), unita, getProprietario?
export async function exportRatePdf({ condominio, esercizio, rate, cells, unita, getProprietario }, withWatermark = false) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  let y = disegnaIntestazione(doc, condominio, esercizio, 'PIANO RATE');

  const cellMap = {};
  (cells || []).forEach(c => { cellMap[`${c.unita_id}_${c.rata_id}`] = c; });
  const rateSorted = [...(rate || [])].sort((a, b) => (a.numero_rata || 0) - (b.numero_rata || 0));

  const body = [];
  (unita || []).forEach(u => {
    const prop = getProprietario ? getProprietario(u) : null;
    rateSorted.forEach(r => {
      const cell = cellMap[`${u.id}_${r.id}`];
      if (!cell) return;
      body.push([
        u.numero || '',
        prop ? `${prop.cognome || ''} ${prop.nome || ''}`.trim() : '',
        r.numero_rata || '',
        fmtData(r.data_scadenza),
        fmtEuro(cell.importo),
        cell.stato || '',
        cell.data_pagamento ? fmtData(cell.data_pagamento) : '',
      ]);
    });
  });

  autoTable(doc, {
    startY: y,
    head: [['Unità', 'Proprietario', 'N° Rata', 'Scadenza', 'Importo', 'Stato', 'Pagato il']],
    body, theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 3, textColor: [20, 20, 20], fillColor: [255, 255, 255], lineColor: LINEA_BORDO },
    headStyles: { fillColor: BLU, textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: SFONDO_ALT },
    columnStyles: { 0: { cellWidth: 16 }, 2: { cellWidth: 18 }, 3: { cellWidth: 24 }, 4: { cellWidth: 24, halign: 'right' }, 5: { cellWidth: 24 }, 6: { cellWidth: 24 } },
    margin: { left: 14, right: 14 },
  });

  aggiungiFooter(doc);
  applyWatermark(doc, withWatermark);
  doc.save(`CondoFAST_Rate_${condominio?.nome?.replace(/\s+/g, '_') || ''}_${esercizio?.anno || ''}.pdf`);
}

// ─── Export Anagrafica ─────────────────────────────────────────────────
export async function exportAnagraficaPdf({ condominio, persone }, withWatermark = false) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  let y = disegnaIntestazione(doc, condominio, null, 'ANAGRAFICA CONDOMINIALE');

  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...DARK);
  doc.text(`Totale residenti/proprietari: ${persone.length}`, 14, y);
  y += 8;

  const head = [['Cognome', 'Nome', 'Ruolo', 'Unità', 'Email', 'Telefono', 'Indirizzo', 'Città']];
  const body = persone.map(p => [
    p.cognome || '',
    p.nome || '',
    p.ruoli || '',
    p.unitaNomi || '',
    p.email || '',
    p.telefono || '',
    p.indirizzo || '',
    p.citta || '',
  ]);

  autoTable(doc, {
    startY: y, head, body, theme: 'grid',
    styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 2.5, textColor: [20, 20, 20], fillColor: [255, 255, 255], lineColor: LINEA_BORDO },
    headStyles: { fillColor: BLU, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7 },
    alternateRowStyles: { fillColor: SFONDO_ALT },
    margin: { left: 10, right: 10 },
  });

  aggiungiFooter(doc);
  applyWatermark(doc, withWatermark);
  doc.save(`Anagrafica_${condominio?.nome?.replace(/\s+/g, '_') || 'Condominio'}.pdf`);
}

// ─── Generatore Lettera di Sollecito & Diffida Legale a 3 Livelli (PDF) ──────────
export function disegnaLetteraSollecitoPagina(doc, {
  condominio,
  esercizio,
  unita,
  destinatario,
  morositaUnita,
  livello = 1,
  studioProfile = {},
  opzioniOverride = {},
  withWatermark = false
}) {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const annoEs = esercizio?.anno || new Date().getFullYear();
  const dataRif = opzioniOverride.dataRiferimento ? new Date(opzioniOverride.dataRiferimento) : new Date();

  // 1. Intestazione Studio / Branding
  doc.setDrawColor(...BLU); doc.setLineWidth(0.5); doc.line(12, 36, W - 12, 36);

  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...BLU);
  doc.text('CONDOFAST', 14, 12);
  
  const studioNome = studioProfile?.ragione_sociale || studioProfile?.studio_nome || 'Studio Amministrazione Condominiale';
  doc.setFontSize(13); doc.setTextColor(...DARK);
  doc.text(studioNome, 14, 19);

  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...GRIGIO);
  const infoStudio = [];
  if (studioProfile?.studio_indirizzo) infoStudio.push(studioProfile.studio_indirizzo);
  if (studioProfile?.partita_iva) infoStudio.push(`P.IVA: ${studioProfile.partita_iva}`);
  if (studioProfile?.codice_fiscale) infoStudio.push(`C.F.: ${studioProfile.codice_fiscale}`);
  if (studioProfile?.studio_telefono) infoStudio.push(`Tel: ${studioProfile.studio_telefono}`);
  if (studioProfile?.studio_pec) infoStudio.push(`PEC: ${studioProfile.studio_pec}`);
  else if (studioProfile?.studio_email) infoStudio.push(`Email: ${studioProfile.studio_email}`);

  doc.text(infoStudio.slice(0, 2).join('  ·  '), 14, 25);
  doc.text(infoStudio.slice(2).join('  ·  '), 14, 30);

  // Titolo Documento a Destra
  doc.setFont('helvetica', 'bold');
  if (livello === 3) {
    doc.setFontSize(10.5); doc.setTextColor(185, 28, 28); // Rosso scuro
    doc.text('DIFFIDA AD ADEMPIERE', W - 14, 16, { align: 'right' });
    doc.setFontSize(8); doc.setTextColor(...DARK);
    doc.text('Ex Art. 1219 c.c. & Art. 63 Disp. Att. c.c.', W - 14, 22, { align: 'right' });
  } else if (livello === 2) {
    doc.setFontSize(10.5); doc.setTextColor(217, 119, 6); // Ambra scuro
    doc.text('2° SOLLECITO DI PAGAMENTO', W - 14, 16, { align: 'right' });
    doc.setFontSize(8); doc.setTextColor(...DARK);
    doc.text('Con Costituzione in Mora & Spese', W - 14, 22, { align: 'right' });
  } else {
    doc.setFontSize(10.5); doc.setTextColor(...BLU);
    doc.text('SOLLECITO DI PAGAMENTO QUOTE', W - 14, 16, { align: 'right' });
    doc.setFontSize(8); doc.setTextColor(...DARK);
    doc.text('Promemoria Scadenze Esercizio', W - 14, 22, { align: 'right' });
  }

  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...GRIGIO);
  doc.text(`Condominio: ${condominio?.nome || 'Condominio'}`, W - 14, 27, { align: 'right' });
  doc.text(`Data: ${dataRif.toLocaleDateString('it-IT')}`, W - 14, 32, { align: 'right' });

  let y = 43;

  // 2. Dati Destinatario (Box Elegante a Destra / Centro)
  const nomeDest = `${destinatario?.cognome || ''} ${destinatario?.nome || ''}`.trim() || 'Condòmino';
  const scalaText = unita?.scala ? `Scala ${unita.scala}, ` : '';
  const pianoText = unita?.piano != null ? `Piano ${unita.piano}, ` : '';
  const unitLabel = `${scalaText}${pianoText}Interno ${unita?.numero || '—'}`;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(...LINEA_BORDO);
  doc.roundedRect(14, y, W - 28, 20, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...DARK);
  doc.text('Spett.le Condòmino / Destinatario:', 18, y + 5.5);
  doc.setFontSize(10); doc.setTextColor(...BLU);
  doc.text(nomeDest, 18, y + 11);

  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...DARK);
  const destCf = destinatario?.codice_fiscale ? `C.F.: ${destinatario.codice_fiscale}` : '';
  const destResidenza = destinatario?.residenza_indirizzo || destinatario?.indirizzo
    ? `Residenza: ${destinatario.residenza_indirizzo || destinatario.indirizzo} (${destinatario.residenza_comune || destinatario.citta || ''})`
    : '';
  const infoDest = [destCf, destResidenza].filter(Boolean).join('  ·  ');
  if (infoDest) {
    doc.text(infoDest, 18, y + 16);
  }

  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...DARK);
  doc.text(`Unità: ${unitLabel}`, W - 18, y + 11, { align: 'right' });
  if (condominio?.codice_fiscale) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...GRIGIO);
    doc.text(`C.F. Condominio: ${condominio.codice_fiscale}`, W - 18, y + 16, { align: 'right' });
  }

  y += 26;

  // 3. Oggetto della Lettera
  let oggettoDoc = '';
  if (livello === 3) {
    oggettoDoc = `OGGETTO: DIFFIDA AD ADEMPIERE E COSTITUZIONE IN MORA EX ART. 1219 C.C. ED ART. 63 DISP. ATT. C.C. - ESERCIZIO ${annoEs}`;
  } else if (livello === 2) {
    oggettoDoc = `OGGETTO: 2° SOLLECITO DI PAGAMENTO QUOTE CONDOMINIALI CON COSTITUZIONE IN MORA - ESERCIZIO ${annoEs}`;
  } else {
    oggettoDoc = `OGGETTO: Sollecito bonario pagamento rate condominiali scadute - Esercizio ${annoEs}`;
  }

  doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5);
  doc.setTextColor(livello === 3 ? 185 : (livello === 2 ? 180 : 37), livello === 3 ? 28 : (livello === 2 ? 83 : 99), livello === 3 ? 28 : (livello === 2 ? 9 : 235));
  doc.text(oggettoDoc, 14, y);

  y += 6;

  // 4. Testo Introduttivo
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...DARK);
  let testoIntro = '';
  if (livello === 3) {
    testoIntro = `In nome e per conto del ${condominio?.nome || 'Condominio'}, si formula formale atto di diffida ad adempiere e costituzione in mora. Dalle verifiche contabili ufficiali, per l'unità immobiliare sopra indicata permangono tuttora insolute le seguenti rate:`;
  } else if (livello === 2) {
    testoIntro = `Facendo seguito al precedente avviso e constatato il mancato riscontro, si trasmette il riepilogo aggiornato delle rate insolute per l'unità ${unitLabel} con addebito delle spese di gestione pratica e calcolo degli interessi maturati ad oggi:`;
  } else {
    testoIntro = `Dalle nostre scritture contabili relative alla gestione condominiale in corso (${condominio?.nome || 'Condominio'}), risulta che ad oggi per la S.V. non è stato regolarizzato il pagamento delle rate di seguito elencate. La invitiamo a verificare il seguente riepilogo:`;
  }

  const splitIntro = doc.splitTextToSize(testoIntro, W - 28);
  doc.text(splitIntro, 14, y);
  y += splitIntro.length * 4.2 + 2;

  // 5. Dati Rate & Calcoli
  const rateDettaglio = morositaUnita?.rateScaduteList || morositaUnita?.rateDettaglio || [];
  const tassoPercentuale = opzioniOverride.tassoPercentuale ?? morositaUnita?.tassoApplicato ?? 2.50;
  const speseApplicate = opzioniOverride.speseApplicate ?? morositaUnita?.speseApplicate ?? 0.00;
  const capInsoluto = morositaUnita?.totaleCapitaleInsoluto || rateDettaglio.reduce((s, r) => s + (parseFloat(r.capitaleInsoluto || r.importo || 0)), 0);
  const intMaturati = morositaUnita?.totaleInteressiMaturati || rateDettaglio.reduce((s, r) => s + (parseFloat(r.interesseMaturato || 0)), 0);
  const totRichiesto = Math.round((capInsoluto + intMaturati + speseApplicate + Number.EPSILON) * 100) / 100;
  const giorniTermine = opzioniOverride.giorniTermine ?? morositaUnita?.giorniTermine ?? (livello === 3 ? 7 : 10);
  const iban = opzioniOverride.iban || condominio?.iban || '';

  // Tabella autoTable
  const bodyTable = rateDettaglio.map(r => [
    r.descrizione || `Rata ${r.numeroRata || r.numero_rata || 1}`,
    fmtData(r.dataScadenza || r.data_scadenza),
    fmtEuro(r.capitaleInsoluto ?? (parseFloat(r.importo || 0) - parseFloat(r.importo_pagato || 0))),
    r.giorniRitardo > 0 ? `${r.giorniRitardo} gg` : '0 gg',
    fmtEuro(r.interesseMaturato || 0),
    fmtEuro(r.totaleRataConInteressi ?? ((parseFloat(r.capitaleInsoluto || r.importo || 0)) + (parseFloat(r.interesseMaturato || 0))))
  ]);

  autoTable(doc, {
    startY: y,
    head: [['Rata / Descrizione', 'Scadenza', 'Quota Capitale', 'Ritardo', `Interessi (${tassoPercentuale}%)`, 'Totale Rata']],
    body: bodyTable,
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 2.5, textColor: DARK, lineColor: LINEA_BORDO },
    headStyles: {
      fillColor: livello === 3 ? [153, 27, 27] : (livello === 2 ? [180, 83, 9] : BLU),
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8
    },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { halign: 'center', cellWidth: 24 },
      2: { halign: 'right', cellWidth: 28, fontStyle: 'bold' },
      3: { halign: 'center', cellWidth: 20 },
      4: { halign: 'right', cellWidth: 26 },
      5: { halign: 'right', cellWidth: 28, fontStyle: 'bold' }
    },
    alternateRowStyles: { fillColor: SFONDO_ALT },
    margin: { left: 14, right: 14 }
  });

  y = doc.lastAutoTable.finalY + 5;

  // 6. Box Quadratura Contabile & Totale
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(...LINEA_BORDO);
  const boxHeight = speseApplicate > 0 || intMaturati > 0 ? 22 : 16;
  doc.roundedRect(14, y, W - 28, boxHeight, 2, 2, 'FD');

  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...DARK);
  doc.text(`Totale Quote Capitale Insolute: ${fmtEuro(capInsoluto)}`, 18, y + 5.5);
  
  if (intMaturati > 0 || speseApplicate > 0) {
    const vociAccessorie = [];
    if (intMaturati > 0) vociAccessorie.push(`Interessi di Mora maturati (${tassoPercentuale}%): ${fmtEuro(intMaturati)}`);
    if (speseApplicate > 0) vociAccessorie.push(`Spese Gestione Pratica / Sollecito: ${fmtEuro(speseApplicate)}`);
    doc.text(vociAccessorie.join('   |   '), 18, y + 10.5);
  }

  doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5);
  doc.setTextColor(livello === 3 ? 185 : (livello === 2 ? 180 : 15), livello === 3 ? 28 : (livello === 2 ? 83 : 23), livello === 3 ? 28 : (livello === 2 ? 9 : 42));
  doc.text(`TOTALE COMPLESSIVO DA VERSARE: ${fmtEuro(totRichiesto)}`, 18, y + (speseApplicate > 0 || intMaturati > 0 ? 17.5 : 12));

  y += boxHeight + 6;

  // 7. Clausola Perentoria & Avvertenze Legali
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...DARK);
  
  if (livello === 3) {
    doc.setFont('helvetica', 'bold'); doc.setTextColor(153, 27, 27);
    doc.text(`INTIMAZIONE E DIFFIDA AD ADEMPIERE:`, 14, y);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...DARK);
    const textDiffida = `La S.V. è formalmente diffidata e intimata a versare l'importo di ${fmtEuro(totRichiesto)} entro e non oltre il termine perentorio di ${giorniTermine} (sette) giorni dal ricevimento della presente.\n\nAVVERTIMENTO EX ART. 63 DISP. ATT. C.C.: In difetto, si procederà senza ulteriore preavviso al ricorso per DECRETO INGIUNTIVO PROVVISORIAMENTE ESECUTIVO (art. 63 c. 1) con addebito integrale di spese legali e perizia, nonché alla SOSPENSIONE DEI SERVIZI COMUNI suscettibili di godimento separato (art. 63 c. 3).`;
    const splitDiffida = doc.splitTextToSize(textDiffida, W - 28);
    doc.text(splitDiffida, 14, y + 4.5);
    y += splitDiffida.length * 3.7 + 5;
  } else if (livello === 2) {
    doc.setFont('helvetica', 'bold'); doc.setTextColor(180, 83, 9);
    doc.text(`TERMINE DI PAGAMENTO:`, 14, y);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...DARK);
    const textMora = `La presente vale quale formale atto di costituzione in mora ex art. 1219 c.c. La invitiamo a saldare l'importo entro e non oltre ${giorniTermine} giorni. Decorso tale termine, la pratica verrà trasmessa al legale per la tutela coattiva del credito in sede giudiziale.`;
    const splitMora = doc.splitTextToSize(textMora, W - 28);
    doc.text(splitMora, 14, y + 4.5);
    y += splitMora.length * 3.7 + 5;
  } else {
    const textBonario = `Certi che si tratti di una mera svista contabile, La invitiamo a voler provvedere al versamento del saldo entro ${giorniTermine} giorni dal ricevimento della presente. (Se ha già provveduto al pagamento, La preghiamo di considerare nullo il presente avviso).`;
    const splitBonario = doc.splitTextToSize(textBonario, W - 28);
    doc.text(splitBonario, 14, y);
    y += splitBonario.length * 3.7 + 5;
  }

  // 8. Box Coordinate Bancarie (IBAN)
  if (iban) {
    doc.setFillColor(239, 246, 255);
    doc.setDrawColor(191, 219, 254);
    doc.roundedRect(14, y, W - 28, 16, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...BLU);
    doc.text('Coordinate Bancarie per il Bonifico:', 18, y + 4.5);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...DARK);
    doc.text(`Intestato a: ${condominio?.nome || 'Condominio'}`, 18, y + 9);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(29, 78, 216);
    doc.text(`IBAN: ${iban}`, 18, y + 13.5);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...DARK);
    doc.text(`Causale: Saldo quote esercizio ${annoEs} - Unità ${unita?.numero || ''} ${nomeDest}`, W - 18, y + 13.5, { align: 'right' });

    y += 20;
  } else {
    y += 4;
  }

  // 9. Firma Amministratore
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...DARK);
  doc.text(`Luogo e Data: ${condominio?.citta || 'Lì'}, ${dataRif.toLocaleDateString('it-IT')}`, 14, y + 4);
  doc.text('L\'Amministrazione Condominiale', W - 18, y + 4, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.text(studioNome, W - 18, y + 9, { align: 'right' });

  // Footer & Watermark
  applyWatermark(doc, withWatermark);
}

// ─── Genera PDF Sollecito Singola Unità (restituisce base64 per email) ──────────
export async function exportLetteraSollecitoPdfBytes({
  condominio,
  esercizio,
  unita,
  destinatario,
  morositaUnita,
  livello = 1,
  studioProfile = {},
  opzioniOverride = {}
}, withWatermark = false) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  disegnaLetteraSollecitoPagina(doc, {
    condominio,
    esercizio,
    unita,
    destinatario,
    morositaUnita,
    livello,
    studioProfile,
    opzioniOverride,
    withWatermark
  });
  aggiungiFooter(doc);

  const pdfOutput = doc.output('datauristring');
  return pdfOutput.split(',')[1];
}

// ─── Genera e Scarica PDF Sollecito Singola Unità ──────────
export function exportLetteraSollecitoPdf({
  condominio,
  esercizio,
  unita,
  destinatario,
  morositaUnita,
  livello = 1,
  studioProfile = {},
  opzioniOverride = {}
}, withWatermark = false) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  disegnaLetteraSollecitoPagina(doc, {
    condominio,
    esercizio,
    unita,
    destinatario,
    morositaUnita,
    livello,
    studioProfile,
    opzioniOverride,
    withWatermark
  });
  aggiungiFooter(doc);

  const prefisso = livello === 3 ? 'Diffida_Legale' : (livello === 2 ? '2_Sollecito' : 'Sollecito_Bonario');
  const nomeFile = `${prefisso}_Unita_${unita?.numero || 'Generica'}_${condominio?.nome?.replace(/\s+/g, '_') || 'Condominio'}.pdf`;
  doc.save(nomeFile);
}

// ─── Genera e Scarica Fascicolo PDF Cumulativo Morosità (Più Unità) ──────────
export function exportFascicoloMorositaPdf({
  condominio,
  esercizio,
  listaMorosi = [],
  studioProfile = {},
  opzioniOverride = {}
}, withWatermark = false) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  listaMorosi.forEach((m, idx) => {
    if (idx > 0) {
      doc.addPage();
    }
    disegnaLetteraSollecitoPagina(doc, {
      condominio,
      esercizio,
      unita: m.unita,
      destinatario: m.debitore,
      morositaUnita: m,
      livello: m.livelloSuggerito || 1,
      studioProfile,
      opzioniOverride,
      withWatermark
    });
  });

  aggiungiFooter(doc);
  const nomeFile = `Fascicolo_Morosita_${condominio?.nome?.replace(/\s+/g, '_') || 'Condominio'}_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(nomeFile);
}

// ─── Retrocompatibilità con funzioni preesistenti ──────────
export async function exportSingolaUnitaRatePdfBytes({ condominio, esercizio, rate, cells, unita, proprietario }, withWatermark = false) {
  return exportLetteraSollecitoPdfBytes({
    condominio,
    esercizio,
    unita,
    destinatario: proprietario,
    morositaUnita: {
      rateScaduteList: (cells || []).map(c => {
        const r = (rate || []).find(rt => rt.id === c.rata_id);
        const imp = parseFloat(c.importo || 0);
        const pag = parseFloat(c.importo_pagato || 0);
        return {
          descrizione: r?.descrizione || 'Rata',
          dataScadenza: r?.data_scadenza,
          capitaleInsoluto: imp - pag,
          giorniRitardo: 0,
          interesseMaturato: 0,
          totaleRataConInteressi: imp - pag
        };
      })
    },
    livello: 1
  }, withWatermark);
}

export async function exportSollecitiMassiviPdf({ condominio, esercizio, rate, proposte }, withWatermark = false) {
  const morosi = proposte.map(p => ({
    unita: p.unita,
    debitore: p.destinatario,
    livelloSuggerito: 1,
    rateScaduteList: (p.cells || []).map(c => {
      const r = (rate || []).find(rt => rt.id === c.rata_id);
      const imp = parseFloat(c.importo || 0);
      const pag = parseFloat(c.importo_pagato || 0);
      return {
        descrizione: r?.descrizione || 'Rata',
        dataScadenza: r?.data_scadenza,
        capitaleInsoluto: imp - pag,
        giorniRitardo: 0,
        interesseMaturato: 0,
        totaleRataConInteressi: imp - pag
      };
    })
  }));

  return exportFascicoloMorositaPdf({
    condominio,
    esercizio,
    listaMorosi: morosi
  }, withWatermark);
}

// ─── ANAGRAFE: Esportazione Registro Anagrafe Condominiale Ufficiale (Art. 1130 c.c.)
export function exportRegistroAnagrafePdf(condominio, righe) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();

  // Testata chiara Landscape: disegniamo solo la linea blu divisoria.
  doc.setDrawColor(...BLU); doc.setLineWidth(0.5); doc.line(10, 36, W - 10, 36);

  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...BLU);
  doc.text('CONDOFAST', 12, 10);
  doc.setFontSize(14); doc.setTextColor(...DARK);
  doc.text(condominio?.nome || 'Condominio', 12, 19);
  
  if (condominio?.indirizzo) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...GRIGIO);
    doc.text(`${condominio.indirizzo} ${condominio.civico || ''} - ${condominio.cap || ''} ${condominio.citta || ''}`, 12, 26);
  }
  if (condominio?.codice_fiscale) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...GRIGIO);
    doc.text(`C.F. Condominio: ${condominio.codice_fiscale}`, 12, 32);
  }

  doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...DARK);
  doc.text('REGISTRO ANAGRAFE CONDOMINIALE', W - 12, 16, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...GRIGIO);
  doc.text(`Art. 1130 comma 1 n. 6 c.c. · Stampato il ${new Date().toLocaleDateString('it-IT')}`, W - 12, 24, { align: 'right' });

  // Prepara righe tabella (5 colonne conformi per legge)
  const body = [];
  
  righe.forEach(u => {
    const unitaDescr = `${u.numero || '-'}${u.scala ? ` (Sc. ${u.scala})` : ''}${u.piano != null ? ` - P.${u.piano}` : ''}`;
    const catastali = [
      u.catasto_foglio ? `F.${u.catasto_foglio}` : '',
      u.catasto_particella ? `P.${u.catasto_particella}` : '',
      u.catasto_subalterno ? `S.${u.catasto_subalterno}` : ''
    ].filter(Boolean).join(' ') || '-';

    const occupantiList = Array.isArray(u.occupanti_unita) ? u.occupanti_unita.filter(o => o.attivo) : [];

    if (occupantiList.length === 0) {
      body.push([
        unitaDescr,
        catastali,
        '-',
        '-',
        '-'
      ]);
    } else {
      occupantiList.forEach((occ, idx) => {
        const p = occ.persona || {};
        const residenza = [
          p.indirizzo,
          p.citta,
          p.provincia ? `(${p.provincia})` : ''
        ].filter(Boolean).join(', ') || '-';

        const ruoloStr = occ.ruolo ? ` (${occ.ruolo.charAt(0).toUpperCase() + occ.ruolo.slice(1)})` : '';
        body.push([
          idx === 0 ? unitaDescr : '',
          idx === 0 ? catastali : '',
          `${`${p.cognome || ''} ${p.nome || ''}`.trim() || '-'}${ruoloStr}`,
          p.codice_fiscale || '-',
          residenza
        ]);
      });
    }
  });

  autoTable(doc, {
    startY: 44,
    head: [['Unità', 'Dati Catastali (F/P/S)', 'Nominativo (Ruolo)', 'Codice Fiscale', 'Indirizzo Residenza']],
    body,
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 4.5, textColor: [20, 20, 20], fillColor: [255, 255, 255], lineColor: LINEA_BORDO },
    headStyles: { fillColor: BLU, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
    alternateRowStyles: { fillColor: SFONDO_ALT },
    margin: { left: 12, right: 12, bottom: 18 }
  });

  // Footer pagina singola/multipla
  const pageCount = doc.internal.getNumberOfPages();
  const H = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    // Linea divisoria per il footer (spostata a H - 12 per allineamento a Portrait)
    doc.setDrawColor(...LINEA_BORDO); doc.setLineWidth(0.3); doc.line(10, H - 12, W - 10, H - 12);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...GRIGIO);
    doc.text(`Pagina ${i} di ${pageCount}`, W - 12, H - 5, { align: 'right' });
    doc.text('Generato automaticamente da CondoFAST', 12, H - 5);
  }

  doc.save(`Registro_Anagrafe_${condominio?.nome?.replace(/\s+/g, '_') || 'Condominio'}.pdf`);
}

// ─── ANAGRAFE: Esportazione Modulo di Autocertificazione Anagrafica e Catastale (Art. 1130 c.c. + GDPR)
export function exportModuloAutocertificazionePdf({ condominio, unita, occupante, profilo }, returnBase64 = false) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  
  // 1. Intestazione Studio Amministrazione (Branding)
  doc.setDrawColor(...BLU); doc.setLineWidth(0.5); doc.line(10, 36, W - 10, 36);

  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...BLU);
  doc.text('CONDOFAST', 12, 12);
  
  // Dati dell'amministratore / studio
  const studioNome = profilo?.ragione_sociale || profilo?.studio_nome || 'Studio Amministrazione';
  doc.setFontSize(13); doc.setTextColor(...DARK);
  doc.text(studioNome, 12, 20);
  
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...GRIGIO);
  let intestazioneStudio = [];
  if (profilo?.studio_indirizzo) intestazioneStudio.push(profilo.studio_indirizzo);
  if (profilo?.partita_iva) intestazioneStudio.push(`P.IVA: ${profilo.partita_iva}`);
  if (profilo?.codice_fiscale) intestazioneStudio.push(`C.F.: ${profilo.codice_fiscale}`);
  if (profilo?.studio_telefono) intestazioneStudio.push(`Tel: ${profilo.studio_telefono}`);
  if (profilo?.studio_email) intestazioneStudio.push(`Email: ${profilo.studio_email}`);
  if (profilo?.studio_pec) intestazioneStudio.push(`PEC: ${profilo.studio_pec}`);
  
  doc.text(intestazioneStudio.slice(0, 2).join('  ·  '), 12, 26);
  doc.text(intestazioneStudio.slice(2).join('  ·  '), 12, 31);

  // Titolo Modulo a destra
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...DARK);
  doc.text('SCHEDA ANAGRAFE CONDOMINIALE', W - 12, 16, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...GRIGIO);
  doc.text('Richiesta dati ai sensi dell\'Art. 1130 c.c.', W - 12, 22, { align: 'right' });
  doc.text(`Data: ${new Date().toLocaleDateString('it-IT')}`, W - 12, 28, { align: 'right' });

  let y = 42;

  // 2. Oggetto e Introduzione di Legge
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...DARK);
  doc.text(`Condominio: ${condominio?.nome || '—'}`, 12, y);
  if (condominio?.indirizzo) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...GRIGIO);
    doc.text(`Indirizzo: ${condominio.indirizzo}`, 12, y + 4.5);
    y += 10;
  } else {
    y += 6;
  }

  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...TESTO);
  const introTxt = `Ai sensi dell'art. 1130, comma 1, n. 6 del Codice Civile, l'amministratore è tenuto a redigere e curare il Registro di Anagrafe Condominiale. La preghiamo di verificare i dati sotto riportati, correggere o integrare quelli mancanti e rispedire il modulo compilato e firmato all'amministrazione, allegando copia del documento di identità e codice fiscale.`;
  const splitIntro = doc.splitTextToSize(introTxt, W - 24);
  doc.text(splitIntro, 12, y);
  y += splitIntro.length * 3.8 + 2;

  // Unità precompilata (se presente)
  const unitaTxt = unita 
    ? `Unità immobiliare di riferimento: Scala ${unita.scala || '—'} · Piano ${unita.piano != null ? unita.piano : '—'} · Interno/N° ${unita.numero || '—'}`
    : 'Unità immobiliare di riferimento: Scala ____ · Piano ____ · Interno ____';
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...DARK);
  doc.text(unitaTxt, 12, y);
  y += 5;

  // 3. Tabella Dati Anagrafici (autoTable)
  const persona = occupante?.persona || {};
  const datiAnagrafici = [
    ['Cognome e Nome / Ragione Sociale', `${persona.cognome || ''} ${persona.nome || ''}`.trim(), ''],
    ['Codice Fiscale / P.IVA', persona.codice_fiscale || '', ''],
    ['Indirizzo di Residenza', [persona.indirizzo, persona.citta].filter(Boolean).join(', ') || '', ''],
    ['Email / PEC', persona.email || '', ''],
    ['Recapito Telefonico', persona.telefono || '', ''],
    ['Ruolo (Proprietario/Inquilino/Usufruttuario)', occupante?.ruolo || '', '']
  ];

  autoTable(doc, {
    startY: y,
    head: [['DATI ANAGRAFICI DEL DICHIARANTE', 'VALORE REGISTRATO', 'CORREZIONI / NUOVI DATI']],
    body: datiAnagrafici,
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 3.5, textColor: [20, 20, 20], lineColor: LINEA_BORDO },
    headStyles: { fillColor: BLU, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
    columnStyles: {
      0: { cellWidth: 55, fontStyle: 'bold', fillColor: SFONDO_ALT },
      1: { cellWidth: 65 },
      2: { cellWidth: W - 12 - 12 - 55 - 65 }
    },
    margin: { left: 12, right: 12 }
  });

  y = doc.lastAutoTable.finalY + 5;

  // 4. Tabella Dati Catastali
  const datiCatastali = [
    ['Foglio Catastale', unita?.catasto_foglio || '', ''],
    ['Particella / Mappale', unita?.catasto_particella || '', ''],
    ['Subalterno Catastale', unita?.catasto_subalterno || '', ''],
    ['Categoria / Classe', unita?.catasto_categoria || '', ''],
    ['Rendita Catastale (€)', unita?.catasto_rendita != null ? fmtEuro(unita.catasto_rendita) : '', '']
  ];

  autoTable(doc, {
    startY: y,
    head: [['DATI CATASTALI DELLO STATO DI FATTO', 'VALORE REGISTRATO', 'CORREZIONI / NUOVI DATI']],
    body: datiCatastali,
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 3.5, textColor: [20, 20, 20], lineColor: LINEA_BORDO },
    headStyles: { fillColor: BLU, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
    columnStyles: {
      0: { cellWidth: 55, fontStyle: 'bold', fillColor: SFONDO_ALT },
      1: { cellWidth: 65 },
      2: { cellWidth: W - 12 - 12 - 55 - 65 }
    },
    margin: { left: 12, right: 12 }
  });

  y = doc.lastAutoTable.finalY + 5;

  // 5. Sezione Accordi Spese (Uscente/Entrante)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...DARK);
  doc.text('ACCORDI SUL RIPARTO DELLE SPESE CONDOMINIALI (In caso di Subentri/Cessioni)', 12, y);
  y += 4;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...TESTO);
  const accordiInfo = 'Specificare eventuali patti tra venditore e acquirente in merito alle spese condominiali dell\'anno in corso (es: ripartizione pro-rata, accollo totale di rate scadute o spese straordinarie approvate).';
  const splitAccordiInfo = doc.splitTextToSize(accordiInfo, W - 24);
  doc.text(splitAccordiInfo, 12, y);
  y += splitAccordiInfo.length * 3.8 + 2;

  // Righe vuote per compilazione accordi
  doc.setDrawColor(...LINEA_BORDO); doc.setLineWidth(0.3);
  doc.line(12, y + 6, W - 12, y + 6);
  doc.line(12, y + 13, W - 12, y + 13);
  y += 18;

  // 6. Informativa Privacy (Art. 13 GDPR)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...DARK);
  doc.text('INFORMATIVA SUL TRATTAMENTO DEI DATI PERSONALI (Regolamento UE 2016/679 - GDPR)', 12, y);
  y += 4;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...GRIGIO);
  const privacyText = `I dati sopra indicati sono raccolti esclusivamente per le finalità connesse alla corretta tenuta del Registro Anagrafe Condominiale obbligatorio ai sensi dell'art. 1130 c.c., e per l'invio delle comunicazioni inerenti la gestione del condominio. Il trattamento avverrà con strumenti informatici e cartacei ad opera del titolare del trattamento [${studioNome}]. I dati non verranno comunicati a terzi al di fuori dei casi espressamente previsti dalla legge. Con la sottoscrizione del presente modulo si autorizza il trattamento dei dati personali per le finalità specificate.`;
  const splitPrivacy = doc.splitTextToSize(privacyText, W - 24);
  doc.text(splitPrivacy, 12, y);
  y += splitPrivacy.length * 3.2 + 8;

  // 7. Firma e data
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...DARK);
  doc.text('Luogo e data: ________________________', 12, y);
  doc.text('Firma del condomino dichiarante: ________________________', W - 12, y, { align: 'right' });

  // Aggiungi footer
  const pageCountMod = doc.internal.getNumberOfPages();
  const HMod = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pageCountMod; i++) {
    doc.setPage(i);
    doc.setDrawColor(...LINEA_BORDO); doc.setLineWidth(0.3); doc.line(10, HMod - 12, W - 10, HMod - 12);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...GRIGIO);
    doc.text(`Pagina ${i} di ${pageCountMod}`, W - 12, HMod - 5, { align: 'right' });
    doc.text(`Richiesta compilazione Registro Anagrafe - ${condominio?.nome || 'Condominio'}`, 12, HMod - 5);
  }

  if (returnBase64) {
    const pdfOutput = doc.output('datauristring');
    const base64 = pdfOutput.split(',')[1];
    return base64;
  }
  
  doc.save(`Modulo_Anagrafe_${condominio?.nome?.replace(/\s+/g, '_') || 'Condominio'}.pdf`);
}