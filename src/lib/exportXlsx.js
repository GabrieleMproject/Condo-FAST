/**
 * exportXlsx.js
 * Esporta i dati CondoAI in un file XLSX con 3 fogli:
 * 1. Anagrafica (unità + proprietari/inquilini)
 * 2. Ripartizione spese
 * 3. Rate
 *
 * Dipendenza: npm install xlsx
 */
import * as XLSX from 'xlsx';

// ─── Helper ──────────────────────────────────────────────────────────────────
function fmtEuro(v) {
  if (v === null || v === undefined) return '';
  return Number(v).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtData(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('it-IT');
}

// ─── Foglio 1: Anagrafica ────────────────────────────────────────────────────
function buildFoglioAnagrafica(unita) {
  const rows = [
    ['N° Unità', 'Tipo', 'Piano', 'Scala', 'Superficie mq', 'Proprietario', 'Email Prop.', 'Inquilino', 'Email Inq.', 'Dal', 'Al'],
  ];

  unita.forEach(u => {
    const prop = u.occupanti?.find(o => o.tipo_occupante === 'proprietario');
    const inq = u.occupanti?.find(o => o.tipo_occupante === 'inquilino');
    rows.push([
      u.numero,
      u.tipo,
      u.piano ?? '',
      u.scala ?? '',
      u.superficie ?? '',
      prop?.persona?.nominativo || '',
      prop?.persona?.email || '',
      inq?.persona?.nominativo || '',
      inq?.persona?.email || '',
      inq ? fmtData(inq.data_inizio) : '',
      inq ? fmtData(inq.data_fine) : '',
    ]);
  });

  return rows;
}

// ─── Foglio 2: Ripartizione Spese ────────────────────────────────────────────
function buildFoglioRipartizione(spese, unita, ripartizioni) {
  // Header
  const unitaHeader = unita.map(u => `Unità ${u.numero}`);
  const rows = [
    ['Spesa', 'Categoria', 'Criterio', 'Data', 'Totale €', ...unitaHeader, 'Totale Ripartito €'],
  ];

  spese.forEach(s => {
    const rips = ripartizioni.filter(r => r.spesa_id === s.id);
    const importiPerUnita = unita.map(u => {
      const r = rips.find(r => r.unita_id === u.id);
      if (!r) return '';
      return r.override_manuale ? (r.importo_override ?? r.importo) : r.importo;
    });
    const totRip = importiPerUnita.reduce((acc, v) => acc + (Number(v) || 0), 0);

    rows.push([
      s.descrizione,
      s.categoria || '',
      s.criterio_ripartizione || '',
      fmtData(s.data_competenza),
      s.importo,
      ...importiPerUnita,
      totRip,
    ]);
  });

  // Riga totali
  const totaliUnita = unita.map(u => {
    return ripartizioni
      .filter(r => r.unita_id === u.id && spese.find(s => s.id === r.spesa_id))
      .reduce((acc, r) => acc + (r.override_manuale ? (r.importo_override ?? r.importo) : r.importo), 0);
  });
  const totaleGenerale = totaliUnita.reduce((a, v) => a + v, 0);
  rows.push(['TOTALE', '', '', '', spese.reduce((a, s) => a + (s.importo || 0), 0), ...totaliUnita, totaleGenerale]);

  return rows;
}

// ─── Foglio 3: Rate ──────────────────────────────────────────────────────────
function buildFoglioRate(rate, unita) {
  const rows = [
    ['Unità', 'Proprietario', 'N° Rata', 'Scadenza', 'Importo €', 'Stato', 'Data Pagamento'],
  ];

  // Ordina per unità poi per data
  const rateSorted = [...(rate || [])].sort((a, b) => {
    const ua = unita.find(u => u.id === a.unita_id)?.numero || '';
    const ub = unita.find(u => u.id === b.unita_id)?.numero || '';
    if (ua !== ub) return ua.localeCompare(ub);
    return new Date(a.data_scadenza) - new Date(b.data_scadenza);
  });

  rateSorted.forEach(r => {
    const u = unita.find(un => un.id === r.unita_id);
    const prop = u?.occupanti?.find(o => o.tipo_occupante === 'proprietario');
    rows.push([
      u?.numero || '',
      prop?.persona?.nominativo || '',
      r.numero_rata || '',
      fmtData(r.data_scadenza),
      r.importo,
      r.stato || '',
      r.data_pagamento ? fmtData(r.data_pagamento) : '',
    ]);
  });

  return rows;
}

// ─── Stile celle intestazione ─────────────────────────────────────────────────
function styleSheet(ws, colCount) {
  const headerStyle = {
    font: { bold: true, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '1E3A5F' } },
    alignment: { horizontal: 'center' },
    border: {
      bottom: { style: 'thin', color: { rgb: '2563EB' } },
    },
  };

  // Applica stile alla prima riga
  for (let c = 0; c < colCount; c++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c });
    if (ws[cellRef]) {
      ws[cellRef].s = headerStyle;
    }
  }

  return ws;
}

// ─── Export principale ───────────────────────────────────────────────────────
export async function exportRipartizioneXlsx({ condominio, esercizio, spese, unita, ripartizioni, rate }) {
  const wb = XLSX.utils.book_new();

  // Foglio 1: Anagrafica
  const rowsAna = buildFoglioAnagrafica(unita);
  const wsAna = XLSX.utils.aoa_to_sheet(rowsAna);
  wsAna['!cols'] = [
    { wch: 10 }, { wch: 16 }, { wch: 8 }, { wch: 8 }, { wch: 14 },
    { wch: 28 }, { wch: 26 }, { wch: 28 }, { wch: 26 }, { wch: 12 }, { wch: 12 },
  ];
  styleSheet(wsAna, 11);
  XLSX.utils.book_append_sheet(wb, wsAna, 'Anagrafica');

  // Foglio 2: Ripartizione
  const rowsRip = buildFoglioRipartizione(spese, unita, ripartizioni);
  const wsRip = XLSX.utils.aoa_to_sheet(rowsRip);
  const ripCols = [{ wch: 30 }, { wch: 18 }, { wch: 22 }, { wch: 12 }, { wch: 14 }];
  unita.forEach(() => ripCols.push({ wch: 14 }));
  ripCols.push({ wch: 18 });
  wsRip['!cols'] = ripCols;
  styleSheet(wsRip, rowsRip[0].length);
  XLSX.utils.book_append_sheet(wb, wsRip, 'Ripartizione Spese');

  // Foglio 3: Rate
  const rowsRate = buildFoglioRate(rate, unita);
  const wsRate = XLSX.utils.aoa_to_sheet(rowsRate);
  wsRate['!cols'] = [
    { wch: 10 }, { wch: 28 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 16 },
  ];
  styleSheet(wsRate, 7);
  XLSX.utils.book_append_sheet(wb, wsRate, 'Rate');

  // Download
  const nomeFile = `CondoAI_${(condominio?.nome || 'Condominio').replace(/\s+/g, '_')}_${esercizio?.anno || ''}.xlsx`;
  XLSX.writeFile(wb, nomeFile);
}
