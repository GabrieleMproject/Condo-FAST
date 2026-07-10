/**
 * exportXlsx.js — 3 fogli: Anagrafica, Ripartizione, Rate.
 * Allineato a schema post-S8a (rate_unita) e colonne reali spese (criterio, data_spesa).
 * Dipendenza: exceljs
 */
import ExcelJS from 'exceljs';

const COLOR_HEADER_BG = '1E3A5F';
const COLOR_HEADER_FG = 'FFFFFFFF';
const COLOR_BORDER    = '2563EB';
const COLOR_ROW_ALT   = 'F1F5F9';

function fmtData(d) { if (!d) return ''; return new Date(d).toLocaleDateString('it-IT'); }

function styleHeader(row) {
  row.eachCell(cell => {
    cell.font = { bold: true, color: { argb: COLOR_HEADER_FG } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_HEADER_BG } };
    cell.border = { bottom: { style: 'thin', color: { argb: COLOR_BORDER } } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });
  row.height = 22;
}
function styleDataRow(row, idx) {
  if (idx % 2 === 0) row.eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_ROW_ALT } }; });
  row.eachCell(cell => { cell.alignment = { vertical: 'middle' }; });
}

function buildFoglioAnagrafica(ws, unita) {
  ws.columns = [
    { header: 'N° Unità', key: 'numero', width: 12 },
    { header: 'Tipo', key: 'tipo', width: 16 },
    { header: 'Piano', key: 'piano', width: 8 },
    { header: 'Scala', key: 'scala', width: 8 },
    { header: 'Superficie mq', key: 'superficie', width: 14 },
    { header: 'Proprietario', key: 'prop_nome', width: 28 },
    { header: 'Email Prop.', key: 'prop_email', width: 26 },
    { header: 'Inquilino', key: 'inq_nome', width: 28 },
    { header: 'Email Inq.', key: 'inq_email', width: 26 },
    { header: 'Dal', key: 'dal', width: 12 },
    { header: 'Al', key: 'al', width: 12 },
  ];
  styleHeader(ws.getRow(1));
  unita.forEach((u, i) => {
    const prop = u.occupanti?.find(o => (o.ruolo === 'proprietario' || o.tipo_occupante === 'proprietario') && o.attivo !== false);
    const inq  = u.occupanti?.find(o => (o.ruolo === 'inquilino' || o.tipo_occupante === 'inquilino') && o.attivo !== false);
    const row = ws.addRow({
      numero: u.numero, tipo: u.tipo, piano: u.piano ?? '', scala: u.scala ?? '', superficie: u.superficie ?? '',
      prop_nome: prop?.persona?.nominativo || '', prop_email: prop?.persona?.email || '',
      inq_nome: inq?.persona?.nominativo || '', inq_email: inq?.persona?.email || '',
      dal: '', al: '',
    });
    styleDataRow(row, i);
  });
}

function buildFoglioRipartizione(ws, spese, unita, ripartizioni) {
  const colsBase = [
    { header: 'Spesa', key: 'descrizione', width: 30 },
    { header: 'Categoria', key: 'categoria', width: 18 },
    { header: 'Criterio', key: 'criterio', width: 22 },
    { header: 'Data', key: 'data', width: 12 },
    { header: 'Totale €', key: 'totale', width: 14, style: { numFmt: '#,##0.00' } },
  ];
  const colsUnita = unita.map(u => ({ header: `Unità ${u.numero}`, key: `unita_${u.id}`, width: 14, style: { numFmt: '#,##0.00' } }));
  const colsFine = [{ header: 'Totale Ripartito €', key: 'tot_rip', width: 18, style: { numFmt: '#,##0.00' } }];
  ws.columns = [...colsBase, ...colsUnita, ...colsFine];
  styleHeader(ws.getRow(1));

  const totaliUnita = {}; unita.forEach(u => { totaliUnita[u.id] = 0; });
  let totSpese = 0, totRipTot = 0;
  spese.forEach((s, i) => {
    const rips = ripartizioni.filter(r => r.spesa_id === s.id);
    const rowData = {
      descrizione: s.descrizione, categoria: s.categoria || '',
      criterio: s.criterio || '',            // ✅ fix
      data: fmtData(s.data_spesa),           // ✅ fix (era data_competenza)
      totale: s.importo,
    };
    let sommaRip = 0;
    unita.forEach(u => {
      const r = rips.find(r => r.unita_id === u.id);
      const imp = r ? (r.override_manuale ? (r.importo_override ?? r.importo) : r.importo) : 0;
      rowData[`unita_${u.id}`] = imp || '';
      sommaRip += imp || 0; totaliUnita[u.id] += imp || 0;
    });
    rowData.tot_rip = sommaRip; totSpese += s.importo || 0; totRipTot += sommaRip;
    styleDataRow(ws.addRow(rowData), i);
  });
  const totRow = ws.addRow({
    descrizione: 'TOTALE', totale: totSpese,
    ...Object.fromEntries(unita.map(u => [`unita_${u.id}`, totaliUnita[u.id]])), tot_rip: totRipTot,
  });
  totRow.font = { bold: true };
  totRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'DBEAFE' } };
}

// Rate dal modello rate_unita: rate (colonne) + cells (celle)
function buildFoglioRate(ws, rate, cells, unita, getProprietario) {
  ws.columns = [
    { header: 'Unità', key: 'unita', width: 10 },
    { header: 'Proprietario', key: 'prop', width: 28 },
    { header: 'N° Rata', key: 'n_rata', width: 10 },
    { header: 'Scadenza', key: 'scadenza', width: 14 },
    { header: 'Importo €', key: 'importo', width: 14, style: { numFmt: '#,##0.00' } },
    { header: 'Pagato €', key: 'pagato', width: 14, style: { numFmt: '#,##0.00' } },
    { header: 'Stato', key: 'stato', width: 14 },
    { header: 'Data Pagamento', key: 'data_pag', width: 16 },
  ];
  styleHeader(ws.getRow(1));
  const cellMap = {}; (cells || []).forEach(c => { cellMap[`${c.unita_id}_${c.rata_id}`] = c; });
  const rateSorted = [...(rate || [])].sort((a, b) => (a.numero_rata || 0) - (b.numero_rata || 0));

  let i = 0;
  (unita || []).forEach(u => {
    const prop = getProprietario ? getProprietario(u) : (u.occupanti?.find(o => (o.ruolo === 'proprietario' || o.tipo_occupante === 'proprietario') && o.attivo !== false));
    const propNome = prop ? (prop.persona?.nominativo || `${prop.cognome || ''} ${prop.nome || ''}`.trim()) : '';
    rateSorted.forEach(r => {
      const cell = cellMap[`${u.id}_${r.id}`];
      if (!cell) return;
      const row = ws.addRow({
        unita: u.numero || '', prop: propNome, n_rata: r.numero_rata || '',
        scadenza: fmtData(r.data_scadenza), importo: cell.importo, pagato: cell.importo_pagato,
        stato: cell.stato || '', data_pag: cell.data_pagamento ? fmtData(cell.data_pagamento) : '',
      });
      styleDataRow(row, i++);
      if (cell.stato === 'non_pagata') row.getCell('stato').font = { color: { argb: 'FFDC2626' } };
      else if (cell.stato === 'pagata') row.getCell('stato').font = { color: { argb: 'FF16A34A' } };
    });
  });
}

export async function exportRipartizioneXlsx({ condominio, esercizio, spese, unita, ripartizioni, rate, cells, getProprietario }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'CondoSmart'; wb.created = new Date(); wb.modified = new Date();
  buildFoglioAnagrafica(wb.addWorksheet('Anagrafica'), unita);
  buildFoglioRipartizione(wb.addWorksheet('Ripartizione Spese'), spese, unita, ripartizioni);
  buildFoglioRate(wb.addWorksheet('Rate'), rate, cells, unita, getProprietario);

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `CondoSmart_${(condominio?.nome || 'Condominio').replace(/\s+/g, '_')}_${esercizio?.anno || ''}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportAnagraficaXlsx({ condominio, persone }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'CondoSmart'; wb.created = new Date(); wb.modified = new Date();
  buildFoglioPersone(wb.addWorksheet('Anagrafica'), persone);

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Anagrafica_${(condominio?.nome || 'Condominio').replace(/\s+/g, '_')}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

function buildFoglioPersone(ws, persone) {
  ws.columns = [
    { header: 'Cognome', key: 'cognome', width: 20 },
    { header: 'Nome', key: 'nome', width: 20 },
    { header: 'Ruolo', key: 'ruoli', width: 20 },
    { header: 'Unità', key: 'unita', width: 25 },
    { header: 'Email', key: 'email', width: 30 },
    { header: 'Telefono', key: 'telefono', width: 20 },
    { header: 'Indirizzo', key: 'indirizzo', width: 35 },
    { header: 'Città', key: 'citta', width: 20 },
  ];
  styleHeader(ws.getRow(1));
  persone.forEach((p, i) => {
    const row = ws.addRow({
      cognome: p.cognome || '',
      nome: p.nome || '',
      ruoli: p.ruoli || '',
      unita: p.unitaNomi || '',
      email: p.email || '',
      telefono: p.telefono || '',
      indirizzo: p.indirizzo || '',
      citta: p.citta || '',
    });
    styleDataRow(row, i);
  });
}