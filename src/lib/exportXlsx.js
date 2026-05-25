/**
 * exportXlsx.js
 * Esporta i dati CondoAI in un file XLSX con 3 fogli:
 * 1. Anagrafica (unità + proprietari/inquilini)
 * 2. Ripartizione spese
 * 3. Rate
 *
 * Dipendenza: npm install exceljs
 */
import ExcelJS from 'exceljs';

// ─── Colori tema ──────────────────────────────────────────────────────────────
const COLOR_HEADER_BG = '1E3A5F';
const COLOR_HEADER_FG = 'FFFFFFFF';
const COLOR_BORDER    = '2563EB';
const COLOR_ROW_ALT   = 'F1F5F9';

// ─── Helper ───────────────────────────────────────────────────────────────────
function fmtData(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('it-IT');
}

// ─── Stile intestazione ───────────────────────────────────────────────────────
function styleHeader(row) {
  row.eachCell(cell => {
    cell.font   = { bold: true, color: { argb: COLOR_HEADER_FG } };
    cell.fill   = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_HEADER_BG } };
    cell.border = { bottom: { style: 'thin', color: { argb: COLOR_BORDER } } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });
  row.height = 22;
}

// ─── Stile riga dati ──────────────────────────────────────────────────────────
function styleDataRow(row, idx) {
  if (idx % 2 === 0) {
    row.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_ROW_ALT } };
    });
  }
  row.eachCell(cell => {
    cell.alignment = { vertical: 'middle' };
  });
}

// ─── Foglio 1: Anagrafica ─────────────────────────────────────────────────────
function buildFoglioAnagrafica(ws, unita) {
  ws.columns = [
    { header: 'N° Unità',        key: 'numero',     width: 12 },
    { header: 'Tipo',            key: 'tipo',        width: 16 },
    { header: 'Piano',           key: 'piano',       width: 8  },
    { header: 'Scala',           key: 'scala',       width: 8  },
    { header: 'Superficie mq',   key: 'superficie',  width: 14 },
    { header: 'Proprietario',    key: 'prop_nome',   width: 28 },
    { header: 'Email Prop.',     key: 'prop_email',  width: 26 },
    { header: 'Inquilino',       key: 'inq_nome',    width: 28 },
    { header: 'Email Inq.',      key: 'inq_email',   width: 26 },
    { header: 'Dal',             key: 'dal',         width: 12 },
    { header: 'Al',              key: 'al',          width: 12 },
  ];

  styleHeader(ws.getRow(1));

  unita.forEach((u, i) => {
    const prop = u.occupanti?.find(o => o.tipo_occupante === 'proprietario');
    const inq  = u.occupanti?.find(o => o.tipo_occupante === 'inquilino');
    const row  = ws.addRow({
      numero:     u.numero,
      tipo:       u.tipo,
      piano:      u.piano ?? '',
      scala:      u.scala ?? '',
      superficie: u.superficie ?? '',
      prop_nome:  prop?.persona?.nominativo || '',
      prop_email: prop?.persona?.email || '',
      inq_nome:   inq?.persona?.nominativo || '',
      inq_email:  inq?.persona?.email || '',
      dal:        inq ? fmtData(inq.data_inizio) : '',
      al:         inq ? fmtData(inq.data_fine)   : '',
    });
    styleDataRow(row, i);
  });
}

// ─── Foglio 2: Ripartizione Spese ─────────────────────────────────────────────
function buildFoglioRipartizione(ws, spese, unita, ripartizioni) {
  // Colonne fisse + una per unità + totale ripartito
  const colsBase = [
    { header: 'Spesa',              key: 'descrizione',  width: 30 },
    { header: 'Categoria',          key: 'categoria',    width: 18 },
    { header: 'Criterio',           key: 'criterio',     width: 22 },
    { header: 'Data',               key: 'data',         width: 12 },
    { header: 'Totale €',           key: 'totale',       width: 14, style: { numFmt: '#,##0.00' } },
  ];
  const colsUnita = unita.map(u => ({
    header: `Unità ${u.numero}`,
    key:    `unita_${u.id}`,
    width:  14,
    style:  { numFmt: '#,##0.00' },
  }));
  const colsFine = [
    { header: 'Totale Ripartito €', key: 'tot_rip', width: 18, style: { numFmt: '#,##0.00' } },
  ];

  ws.columns = [...colsBase, ...colsUnita, ...colsFine];
  styleHeader(ws.getRow(1));

  const totaliUnita = {};
  unita.forEach(u => { totaliUnita[u.id] = 0; });
  let totSpese = 0;
  let totRipTot = 0;

  spese.forEach((s, i) => {
    const rips = ripartizioni.filter(r => r.spesa_id === s.id);
    const rowData = {
      descrizione: s.descrizione,
      categoria:   s.categoria || '',
      criterio:    s.criterio_ripartizione || '',
      data:        fmtData(s.data_competenza),
      totale:      s.importo,
    };
    let sommaRip = 0;
    unita.forEach(u => {
      const r = rips.find(r => r.unita_id === u.id);
      const imp = r ? (r.override_manuale ? (r.importo_override ?? r.importo) : r.importo) : 0;
      rowData[`unita_${u.id}`] = imp || '';
      sommaRip += imp || 0;
      totaliUnita[u.id] += imp || 0;
    });
    rowData.tot_rip = sommaRip;
    totSpese   += s.importo || 0;
    totRipTot  += sommaRip;

    const row = ws.addRow(rowData);
    styleDataRow(row, i);
  });

  // Riga totali
  const totRow = ws.addRow({
    descrizione: 'TOTALE',
    totale:      totSpese,
    ...Object.fromEntries(unita.map(u => [`unita_${u.id}`, totaliUnita[u.id]])),
    tot_rip:     totRipTot,
  });
  totRow.font = { bold: true };
  totRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'DBEAFE' } };
}

// ─── Foglio 3: Rate ───────────────────────────────────────────────────────────
function buildFoglioRate(ws, rate, unita) {
  ws.columns = [
    { header: 'Unità',           key: 'unita',       width: 10 },
    { header: 'Proprietario',    key: 'prop',        width: 28 },
    { header: 'N° Rata',         key: 'n_rata',      width: 10 },
    { header: 'Scadenza',        key: 'scadenza',    width: 14 },
    { header: 'Importo €',       key: 'importo',     width: 14, style: { numFmt: '#,##0.00' } },
    { header: 'Stato',           key: 'stato',       width: 14 },
    { header: 'Data Pagamento',  key: 'data_pag',    width: 16 },
  ];

  styleHeader(ws.getRow(1));

  const rateSorted = [...(rate || [])].sort((a, b) => {
    const ua = unita.find(u => u.id === a.unita_id)?.numero || '';
    const ub = unita.find(u => u.id === b.unita_id)?.numero || '';
    if (ua !== ub) return String(ua).localeCompare(String(ub));
    return new Date(a.data_scadenza) - new Date(b.data_scadenza);
  });

  rateSorted.forEach((r, i) => {
    const u    = unita.find(un => un.id === r.unita_id);
    const prop = u?.occupanti?.find(o => o.tipo_occupante === 'proprietario');
    const row  = ws.addRow({
      unita:    u?.numero || '',
      prop:     prop?.persona?.nominativo || '',
      n_rata:   r.numero_rata || '',
      scadenza: fmtData(r.data_scadenza),
      importo:  r.importo,
      stato:    r.stato || '',
      data_pag: r.data_pagamento ? fmtData(r.data_pagamento) : '',
    });
    styleDataRow(row, i);

    // Colora riga in base allo stato
    if (r.stato === 'scaduta') {
      row.getCell('stato').font = { color: { argb: 'FFDC2626' } };
    } else if (r.stato === 'pagata') {
      row.getCell('stato').font = { color: { argb: 'FF16A34A' } };
    }
  });
}

// ─── Export principale ────────────────────────────────────────────────────────
export async function exportRipartizioneXlsx({ condominio, esercizio, spese, unita, ripartizioni, rate }) {
  const wb = new ExcelJS.Workbook();
  wb.creator  = 'CondoAI';
  wb.created  = new Date();
  wb.modified = new Date();

  // Foglio 1
  const wsAna = wb.addWorksheet('Anagrafica');
  buildFoglioAnagrafica(wsAna, unita);

  // Foglio 2
  const wsRip = wb.addWorksheet('Ripartizione Spese');
  buildFoglioRipartizione(wsRip, spese, unita, ripartizioni);

  // Foglio 3
  const wsRate = wb.addWorksheet('Rate');
  buildFoglioRate(wsRate, rate, unita);

  // Download via blob
  const buffer   = await wb.xlsx.writeBuffer();
  const blob     = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url      = URL.createObjectURL(blob);
  const a        = document.createElement('a');
  const nomeFile = `CondoAI_${(condominio?.nome || 'Condominio').replace(/\s+/g, '_')}_${esercizio?.anno || ''}.xlsx`;
  a.href         = url;
  a.download     = nomeFile;
  a.click();
  URL.revokeObjectURL(url);
}
