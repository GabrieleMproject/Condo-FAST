/**
 * exportVerbaleAssemblea.js
 * Generazione del Verbale Ufficiale di Assemblea Condominiale in formato PDF.
 * Conforme alle prescrizioni dell'art. 1136 c.c. e art. 66-67 disp. att. c.c.
 * 
 * Include:
 * 1. Intestazione Studio & Condominio, Convocazione, Presidente e Segretario
 * 2. Tabella di Costituzione dell'Assemblea e Quorum Costitutivo (Millesimi e Teste)
 * 3. Tabella Presenze e Deleghe nominative
 * 4. Trattazione OdG punto per punto con Quorum Deliberativo e votazione nominativa
 * 5. Chiusura e Spazio Firme
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const BLU = [37, 99, 235];
const DARK = [15, 23, 42];
const TESTO = [51, 65, 85];
const GRIGIO = [100, 116, 139];
const VERDE = [16, 185, 129];
const ROSSO = [239, 68, 68];

function fmtDataOra(isoStr) {
  if (!isoStr) return '—';
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString('it-IT') + ' ore ' + d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return isoStr;
  }
}

function fmtNum(n, decimals = 2) {
  if (n === null || n === undefined || isNaN(n)) return '0,00';
  return Number(n).toLocaleString('it-IT', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function generateVerbaleAssembleaPdf({
  condominio = {},
  assemblea = {},
  odgList = [],
  presenze = [],
  persone = [],
  unita = [],
  tabelle = [],
  presidente = 'Da nominare',
  segretario = 'Da nominare',
  oraFine = '—',
  noteFinali = ''
}) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  // Mappa anagrafiche e millesimi
  const personeMap = new Map(persone.map(p => [p.id, p]));
  const unitaMap = new Map(unita.map(u => [u.id, u]));

  // Calcolo millesimi totali e presenti
  let millesimiTotaliCondominio = 1000.0;
  if (unita.length > 0) {
    const sum = unita.reduce((acc, u) => acc + (parseFloat(u.millesimi_proprieta || u.millesimi || 0) || 0), 0);
    if (sum > 0) millesimiTotaliCondominio = sum;
  }

  const presenzeAttive = presenze.filter(p => p.presente);
  const testePresenti = presenzeAttive.length;

  let millesimiPresenti = 0;
  presenzeAttive.forEach(p => {
    const u = unitaMap.get(p.unita_id);
    const m = parseFloat(u?.millesimi_proprieta || u?.millesimi || 0) || 0;
    millesimiPresenti += m;
  });

  // Quorum costitutivo (art. 1136 c.c. - 2a convocazione: almeno 1/3 dei condomini e 333,33 millesimi)
  const isSecondaConvocazione = assemblea.tipo_convocazione !== 'prima';
  const quorumCostitutivoMillesimiMinimi = isSecondaConvocazione ? (millesimiTotaliCondominio / 3) : (millesimiTotaliCondominio * 2 / 3);
  const quorumCostitutivoValido = millesimiPresenti >= (quorumCostitutivoMillesimiMinimi - 0.01);

  // 1. INTESTAZIONE
  doc.setDrawColor(...BLU);
  doc.setLineWidth(0.8);
  doc.line(14, 38, W - 14, 38);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...BLU);
  doc.text('CONDOFAST — GESTIONALE AMMINISTRAZIONI', 14, 14);

  doc.setFontSize(16);
  doc.setTextColor(...DARK);
  doc.text(condominio.nome || 'Condominio', 14, 22);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...GRIGIO);
  const infoCondo = [
    condominio.indirizzo ? `${condominio.indirizzo} - ${condominio.citta || ''}` : '',
    condominio.codice_fiscale ? `C.F. ${condominio.codice_fiscale}` : ''
  ].filter(Boolean).join(' | ');
  doc.text(infoCondo || 'Documento Ufficiale di Assemblea', 14, 29);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...DARK);
  doc.text('VERBALE DI ASSEMBLEA', W - 14, 20, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...GRIGIO);
  doc.text(`Assemblea ${assemblea.tipo === 'straordinaria' ? 'Straordinaria' : 'Ordinaria'}`, W - 14, 26, { align: 'right' });
  doc.text(isSecondaConvocazione ? 'In Seconda Convocazione' : 'In Prima Convocazione', W - 14, 32, { align: 'right' });

  let y = 46;

  // 2. DATI PRELIMINARI E COSTITUZIONE
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...DARK);
  doc.text('1. COSTITUZIONE DELL’ASSEMBLEA', 14, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...TESTO);

  const introTesto = `In data ${fmtDataOra(assemblea.data_inizio)}, ${assemblea.luogo ? `presso ${assemblea.luogo}` : 'in modalità teleassemblea'}, si è riunita l\'Assemblea dei Condòmini per discutere e deliberare sul seguente Ordine del Giorno.`;
  const splitIntro = doc.splitTextToSize(introTesto, W - 28);
  doc.text(splitIntro, 14, y);
  y += splitIntro.length * 4.5 + 4;

  const costituzioneBox = [
    `• Presidente nominato: ${presidente || '—'}`,
    `• Segretario verbalizzante: ${segretario || '—'}`,
    `• Condomini presenti/rappresentati: ${testePresenti} su ${unita.length || presenze.length || 0} unità aventi diritto`,
    `• Valore millesimale intervenuto: ${fmtNum(millesimiPresenti)} / ${fmtNum(millesimiTotaliCondominio)} ‰`,
    `• Quorum Costitutivo (ex art. 1136 c.c.): ${quorumCostitutivoValido ? 'RAGGIUNTO (Assemblea validamente costituita)' : 'NON RAGGIUNTO'}`
  ];

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, y, W - 28, 28, 2, 2, 'FD');

  y += 5;
  costituzioneBox.forEach(line => {
    doc.text(line, 18, y);
    y += 4.5;
  });
  y += 6;

  // 3. TABELLA PRESENZE E DELEGHE
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...DARK);
  doc.text('2. ELENCO INTERVENUTI E DELEGHE', 14, y);
  y += 4;

  const presenzeRows = presenzeAttive.map((p, idx) => {
    const pers = personeMap.get(p.persona_id);
    const u = unitaMap.get(p.unita_id);
    const delegato = p.delegato_a_persona_id ? personeMap.get(p.delegato_a_persona_id) : null;
    
    return [
      (idx + 1).toString(),
      pers ? `${pers.cognome || ''} ${pers.nome || ''}`.trim() : 'Condòmino',
      u?.scala ? `Sc. ${u.scala} Int. ${u.interno || '-'}` : (u?.interno || 'U.I.'),
      delegato ? `Delega a: ${delegato.cognome} ${delegato.nome}` : 'Presente Diretto',
      fmtNum(parseFloat(u?.millesimi_proprieta || u?.millesimi || 0))
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [['#', 'Condòmino / Intestatario', 'Unità Imm.', 'Modalità Presenza', 'Millesimi ‰']],
    body: presenzeRows.length > 0 ? presenzeRows : [['—', 'Nessun condomino presente registrato', '—', '—', '0,00']],
    theme: 'grid',
    styles: { fontSize: 8.5, textColor: TESTO, cellPadding: 2 },
    headStyles: { fillColor: BLU, textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 65 },
      2: { cellWidth: 35 },
      3: { cellWidth: 50 },
      4: { cellWidth: 22, halign: 'right' },
    },
    margin: { left: 14, right: 14 }
  });

  y = doc.lastAutoTable.finalY + 10;

  // 4. TRATTAZIONE ORDINE DEL GIORNO
  if (y > H - 60) {
    doc.addPage();
    y = 20;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...DARK);
  doc.text('3. DISCUSSIONE E DELIBERAZIONI SUI PUNTI ALL\'ORDINE DEL GIORNO', 14, y);
  y += 8;

  odgList.forEach((item, index) => {
    if (y > H - 65) {
      doc.addPage();
      y = 20;
    }

    const numPunto = item.numero_ordine || (index + 1);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(...BLU);
    doc.text(`Punto ${numPunto}: ${item.titolo}`, 14, y);
    y += 5;

    if (item.descrizione) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...TESTO);
      const descLines = doc.splitTextToSize(item.descrizione, W - 28);
      doc.text(descLines, 14, y);
      y += descLines.length * 4.2 + 3;
    }

    // Dettaglio Quorum & Esito
    const favMil = parseFloat(item.totale_favorevoli_millesimi || 0);
    const conMil = parseFloat(item.totale_contrari_millesimi || 0);
    const astMil = parseFloat(item.totale_astenuti_millesimi || 0);
    const favTes = parseInt(item.totale_favorevoli_teste || 0, 10);
    const conTes = parseInt(item.totale_contrari_teste || 0, 10);
    const astTes = parseInt(item.totale_astenuti_teste || 0, 10);

    const isApprovato = item.esito === 'approvato';
    const isNonVotato = item.esito === 'non_votato' || !item.esito;

    const quorumRichiesto = item.tipo_quorum === 'straordinaria_500' ? '500,00 ‰ (Maggioranza intervenuti)' :
                            item.tipo_quorum === 'innovazioni_667' ? '667,00 ‰ (2/3 dei partecipanti)' :
                            item.tipo_quorum === 'unanimita_1000' ? '1000,00 ‰ (Unanimità)' :
                            item.tipo_quorum === 'personalizzato' ? `${fmtNum(item.quorum_millesimi_richiesto)} ‰ (Personalizzato)` :
                            '333,33 ‰ (1/3 dei partecipanti)';

    autoTable(doc, {
      startY: y,
      head: [['Quorum Richiesto', 'Favorevoli', 'Contrari', 'Astenuti', 'Esito Delibera']],
      body: [[
        quorumRichiesto,
        `${favTes} teste (${fmtNum(favMil)} ‰)`,
        `${conTes} teste (${fmtNum(conMil)} ‰)`,
        `${astTes} teste (${fmtNum(astMil)} ‰)`,
        isNonVotato ? 'NON VOTATO' : (isApprovato ? 'APPROVATO' : 'RESPINTO')
      ]],
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 2.5, halign: 'center' },
      headStyles: { fillColor: [241, 245, 249], textColor: DARK, fontStyle: 'bold' },
      didParseCell: function(data) {
        if (data.section === 'body' && data.column.index === 4) {
          data.cell.styles.fontStyle = 'bold';
          if (isApprovato) {
            data.cell.styles.textColor = VERDE;
          } else if (!isNonVotato) {
            data.cell.styles.textColor = ROSSO;
          }
        }
      },
      margin: { left: 14, right: 14 }
    });

    y = doc.lastAutoTable.finalY + 8;
  });

  // 5. CHIUSURA E FIRME
  if (y > H - 55) {
    doc.addPage();
    y = 20;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...DARK);
  doc.text('4. CHIUSURA DELL\'ASSEMBLEA E SOTTOSCRIZIONE', 14, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...TESTO);
  const chiusuraTesto = `Esauriti i punti all'Ordine del Giorno e null'altro essendovi da deliberare, la seduta viene sciolta alle ore ${oraFine || '—'}. Il presente verbale viene redatto, letto, confermato e sottoscritto.`;
  const splitChiusura = doc.splitTextToSize(chiusuraTesto, W - 28);
  doc.text(splitChiusura, 14, y);
  y += splitChiusura.length * 4.5 + 16;

  // Box Firme
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...DARK);
  doc.text('Il Segretario Verbalizzante', 24, y);
  doc.text('Il Presidente dell\'Assemblea', W - 65, y);
  
  y += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...GRIGIO);
  doc.text(`(${segretario || 'Firma leggibile'})`, 24, y);
  doc.text(`(${presidente || 'Firma leggibile'})`, W - 65, y);

  y += 14;
  doc.setDrawColor(...GRIGIO);
  doc.setLineWidth(0.4);
  doc.line(20, y, 70, y);
  doc.line(W - 75, y, W - 25, y);

  // Footer con numerazione pagine
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...GRIGIO);
    doc.text(
      `Verbale Assemblea - ${condominio.nome || 'Condominio'} | Pagina ${i} di ${totalPages}`,
      W / 2,
      H - 10,
      { align: 'center' }
    );
  }

  return doc;
}

export function downloadVerbaleAssembleaPdf(params) {
  const doc = generateVerbaleAssembleaPdf(params);
  const nomeCondo = (params.condominio?.nome || 'Condominio').replace(/[^a-zA-Z0-9_-]/g, '_');
  const dataAss = params.assemblea?.data_inizio ? new Date(params.assemblea.data_inizio).toISOString().split('T')[0] : 'data';
  doc.save(`Verbale_Assemblea_${nomeCondo}_${dataAss}.pdf`);
}
