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
    const occList = u.occupanti || u.occupanti_unita;
    const prop = occList?.find(o => (o.ruolo === 'proprietario' || o.tipo_occupante === 'proprietario') && o.attivo !== false);
    const inq  = occList?.find(o => (o.ruolo === 'inquilino' || o.tipo_occupante === 'inquilino') && o.attivo !== false);
    const propNome = prop?.persona ? `${prop.persona.nome || ''} ${prop.persona.cognome || ''}`.trim() : '';
    const inqNome = inq?.persona ? `${inq.persona.nome || ''} ${inq.persona.cognome || ''}`.trim() : '';
    const row = ws.addRow({
      numero: u.numero, tipo: u.tipo, piano: u.piano ?? '', scala: u.scala ?? '', superficie: u.mq ?? '',
      prop_nome: propNome, prop_email: prop?.persona?.email || '',
      inq_nome: inqNome, inq_email: inq?.persona?.email || '',
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
      criterio: s.criterio || '',            // fix
      data: fmtData(s.data_spesa),           // fix (era data_competenza)
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
    const prop = getProprietario ? getProprietario(u) : ((u.occupanti || u.occupanti_unita)?.find(o => (o.ruolo === 'proprietario' || o.tipo_occupante === 'proprietario') && o.attivo !== false));
    const propNome = prop ? (prop.persona ? `${prop.persona.nome || ''} ${prop.persona.cognome || ''}`.trim() : `${prop.nome || ''} ${prop.cognome || ''}`.trim()) : '';
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
  wb.creator = 'CondoFAST'; wb.created = new Date(); wb.modified = new Date();
  buildFoglioAnagrafica(wb.addWorksheet('Anagrafica'), unita);
  buildFoglioRipartizione(wb.addWorksheet('Ripartizione Spese'), spese, unita, ripartizioni);
  buildFoglioRate(wb.addWorksheet('Rate'), rate, cells, unita, getProprietario);

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `CondoFAST_${(condominio?.nome || 'Condominio').replace(/\s+/g, '_')}_${esercizio?.anno || ''}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportAnagraficaXlsx({ condominio, persone }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'CondoFAST'; wb.created = new Date(); wb.modified = new Date();
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

export async function exportConsuntivoXlsx({ condominio, consuntivo, template, unita, getProprietario, getMillesimiUnita, tabellaMillId }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'CondoFAST'; wb.created = new Date(); wb.modified = new Date();

  // FOGLIO 1: Competenza
  const wsComp = wb.addWorksheet('Competenza');
  wsComp.columns = [
    { header: 'Categoria', key: 'categoria', width: 30 },
    { header: 'Tipo', key: 'tipo', width: 20 },
    { header: 'Importo €', key: 'importo', width: 15, style: { numFmt: '#,##0.00' } },
  ];
  styleHeader(wsComp.getRow(1));
  let i = 0;
  const ord = template?.ordine_categorie || Object.keys(consuntivo.competenza.catMap);
  const catKeys = [...new Set([...ord, ...Object.keys(consuntivo.competenza.catMap)])];
  catKeys.forEach(k => {
    const v = consuntivo.competenza.catMap[k];
    if (v) {
      const tot = v.ordinaria + v.straordinaria;
      if (tot) {
        styleDataRow(wsComp.addRow({
          categoria: template?.etichette_categorie?.[k] || k.toUpperCase(),
          tipo: v.straordinaria > 0 ? 'straordinaria' : 'ordinaria',
          importo: tot
        }), i++);
      }
    }
  });
  const totComp = wsComp.addRow({ categoria: 'TOTALE CONSUNTIVO', tipo: '', importo: consuntivo.competenza.totSpese });
  totComp.font = { bold: true };
  totComp.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'DBEAFE' } };

  // FOGLIO 2: Riparto
  const wsRip = wb.addWorksheet('Riparto');
  wsRip.columns = [
    { header: 'Unità', key: 'unita', width: 12 },
    { header: 'Proprietario', key: 'prop', width: 30 },
    { header: 'Millesimi', key: 'mill', width: 12 },
    { header: 'Dovuto €', key: 'dovuto', width: 15, style: { numFmt: '#,##0.00' } },
    { header: 'Versato €', key: 'versato', width: 15, style: { numFmt: '#,##0.00' } },
    { header: 'Saldo Iniz. €', key: 'saldo_iniz', width: 15, style: { numFmt: '#,##0.00' } },
    { header: 'Conguaglio €', key: 'conguaglio', width: 15, style: { numFmt: '#,##0.00' } },
    { header: 'Arretrati €', key: 'arretrati', width: 15, style: { numFmt: '#,##0.00' } },
  ];
  styleHeader(wsRip.getRow(1));
  i = 0;
  (unita || []).forEach(u => {
    const r = consuntivo.riparto.unitaRows.find(x => x.unita_id === u.id) || { dovuto: 0, versato: 0, saldoIniz: 0, conguaglio: 0, arretrati: 0 };
    const p = getProprietario ? getProprietario(u) : null;
    const mill = getMillesimiUnita ? getMillesimiUnita(tabellaMillId, u.id) : '';
    styleDataRow(wsRip.addRow({
      unita: `U.${u.numero}`,
      prop: p ? `${p.cognome || ''} ${p.nome || ''}`.trim() : '',
      mill: mill ? Number(mill) : '',
      dovuto: r.dovuto,
      versato: r.versato,
      saldo_iniz: r.saldoIniz,
      conguaglio: r.conguaglio,
      arretrati: r.arretrati
    }), i++);
  });
  const totRip = wsRip.addRow({
    unita: 'TOTALI', prop: '', mill: '',
    dovuto: consuntivo.riparto.tot.dovuto,
    versato: consuntivo.riparto.tot.versato,
    saldo_iniz: consuntivo.riparto.tot.saldoIniz,
    conguaglio: consuntivo.riparto.tot.conguaglio,
    arretrati: consuntivo.riparto.tot.arretrati
  });
  totRip.font = { bold: true };
  totRip.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'DBEAFE' } };

  // FOGLIO 3: Cassa
  const wsCassa = wb.addWorksheet('Cassa');
  wsCassa.columns = [
    { header: 'Voce', key: 'voce', width: 40 },
    { header: 'Importo €', key: 'importo', width: 15, style: { numFmt: '#,##0.00' } },
  ];
  styleHeader(wsCassa.getRow(1));
  i = 0;
  [
    { voce: 'Saldo cassa iniziale', importo: consuntivo.cassa.saldoInizCassa },
    { voce: 'Entrate periodo', importo: consuntivo.cassa.entrate },
    { voce: 'Uscite periodo', importo: consuntivo.cassa.uscite > 0 ? -consuntivo.cassa.uscite : 0 },
    { voce: 'Saldo cassa finale', importo: consuntivo.cassa.saldoFinaleCassa },
    { voce: 'Risultato di competenza (versato − spese)', importo: consuntivo.cassa.saldoCompetenza },
    { voce: 'Quadratura competenza ↔ cassa', importo: consuntivo.cassa.scartoQuadratura },
  ].forEach(r => styleDataRow(wsCassa.addRow(r), i++));

  // FOGLIO 4: Fatture
  if (consuntivo.fatture.rows.length > 0) {
    const wsFatture = wb.addWorksheet('Fatture');
    wsFatture.columns = [
      { header: 'Fornitore', key: 'fornitore', width: 30 },
      { header: 'N° Fattura', key: 'numero', width: 15 },
      { header: 'Data', key: 'data', width: 15 },
      { header: 'Importo €', key: 'importo', width: 15, style: { numFmt: '#,##0.00' } },
      { header: 'Stato', key: 'stato', width: 15 },
      { header: 'Ritenuta/F24', key: 'ritenuta', width: 20 },
    ];
    styleHeader(wsFatture.getRow(1));
    i = 0;
    consuntivo.fatture.rows.forEach(f => {
      styleDataRow(wsFatture.addRow({
        fornitore: f.fornitore,
        numero: f.numero_fattura || '',
        data: f.data_fattura ? fmtData(f.data_fattura) : '',
        importo: f.importo_totale,
        stato: f.stato,
        ritenuta: f.ritenutaBadge || ''
      }), i++);
    });
  }

  // FOGLIO 5: Confronto
  if (consuntivo.confronto.rows.length > 0) {
    const wsConf = wb.addWorksheet('Confronto Prev-Cons');
    wsConf.columns = [
      { header: 'Categoria', key: 'categoria', width: 30 },
      { header: 'Preventivo €', key: 'prev', width: 15, style: { numFmt: '#,##0.00' } },
      { header: 'Consuntivo €', key: 'cons', width: 15, style: { numFmt: '#,##0.00' } },
      { header: 'Differenza €', key: 'diff', width: 15, style: { numFmt: '#,##0.00' } },
    ];
    styleHeader(wsConf.getRow(1));
    i = 0;
    consuntivo.confronto.rows.forEach(r => {
      styleDataRow(wsConf.addRow({
        categoria: template?.etichette_categorie?.[r.categoria] || r.categoria.toUpperCase(),
        prev: r.preventivo,
        cons: r.consuntivo,
        diff: r.differenza
      }), i++);
    });
    const totConf = wsConf.addRow({
      categoria: 'TOTALE',
      prev: consuntivo.confronto.tot.preventivo,
      cons: consuntivo.confronto.tot.consuntivo,
      diff: consuntivo.confronto.tot.differenza
    });
    totConf.font = { bold: true };
    totConf.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'DBEAFE' } };
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Consuntivo_${(condominio?.nome || 'Condominio').replace(/\s+/g, '_')}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}