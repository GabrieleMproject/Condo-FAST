/**
 * exportPassaggioConsegne.js — Generazione pacchetto di Passaggio Consegne (Art. 20 GDPR / Artt. 1129-1130 c.c.)
 * Contiene:
 * 1) Super-file Excel multifoglio (Condominio, Anagrafica, Unità, Millesimi, Saldi, Spese).
 * 2) Raccolta di tutti i documenti di archivio da Supabase Storage all'interno di un unico .zip.
 */
import ExcelJS from 'exceljs';
import JSZip from 'jszip';

const COLOR_HEADER_BG = '1E3A5F';
const COLOR_HEADER_FG = 'FFFFFFFF';
const COLOR_BORDER    = '2563EB';
const COLOR_ROW_ALT   = 'F1F5F9';

function styleHeader(row) {
  row.eachCell(cell => {
    cell.font = { bold: true, color: { argb: COLOR_HEADER_FG }, name: 'Segoe UI', size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_HEADER_BG } };
    cell.border = { bottom: { style: 'thin', color: { argb: COLOR_BORDER } } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });
  row.height = 24;
}

function styleDataRow(row, idx) {
  if (idx % 2 === 0) {
    row.eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLOR_ROW_ALT } }; });
  }
  row.eachCell(cell => {
    cell.font = { name: 'Segoe UI', size: 10 };
    cell.alignment = { vertical: 'middle' };
  });
}

/**
 * Genera il buffer del file Excel multifoglio
 */
export async function generatePassaggioExcelBuffer({ condominio, unita = [], persone = [], tabelle = [], spese = [], esercizi = [], saldi = [] }) {
  const unitaList   = unita || [];
  const personeList = persone || [];
  const tabelleList = tabelle || [];
  const speseList   = spese || [];
  const saldiList   = saldi || [];

  const wb = new ExcelJS.Workbook();
  wb.creator = 'CondoAI - Gestionale Amministratore';
  wb.created = new Date();
  wb.modified = new Date();

  // FOGLIO 1: CONDOMINIO & FISCALITÀ
  const wsCondo = wb.addWorksheet('Condominio & Fiscalità');
  wsCondo.columns = [
    { header: 'Parametro', key: 'param', width: 28 },
    { header: 'Valore Registrato', key: 'val', width: 45 },
  ];
  styleHeader(wsCondo.getRow(1));
  const infoCondo = [
    { param: 'Denominazione', val: condominio?.nome || 'Condominio' },
    { param: 'Codice Fiscale', val: condominio?.codice_fiscale || 'Non specificato' },
    { param: 'IBAN Conto Corrente', val: condominio?.iban || 'Non specificato' },
    { param: 'Indirizzo', val: condominio?.indirizzo || 'Non specificato' },
    { param: 'Città', val: condominio?.citta || 'Non specificata' },
    { param: 'CAP', val: condominio?.cap || '' },
    { param: 'Fondo Cassa Iniziale / Bilancio', val: condominio?.fondo_cassa ? `€ ${Number(condominio.fondo_cassa).toLocaleString('it-IT', { minimumFractionDigits: 2 })}` : '€ 0,00' },
    { param: 'Totale Unità Immobiliari', val: String(unitaList.length) },
    { param: 'Totale Persone Censite', val: String(personeList.length) },
    { param: 'Data Generazione Export', val: new Date().toLocaleDateString('it-IT') },
  ];
  infoCondo.forEach((item, idx) => {
    const row = wsCondo.addRow(item);
    styleDataRow(row, idx + 1);
  });

  // FOGLIO 2: ANAGRAFICA CONDÒMINI & INQUILINI
  const wsPersone = wb.addWorksheet('Anagrafica Condòmini');
  wsPersone.columns = [
    { header: 'Cognome', key: 'cognome', width: 22 },
    { header: 'Nome', key: 'nome', width: 22 },
    { header: 'Codice Fiscale / P.IVA', key: 'cf', width: 22 },
    { header: 'Ruoli', key: 'ruoli', width: 20 },
    { header: 'Unità Associate', key: 'unita', width: 25 },
    { header: 'Email', key: 'email', width: 30 },
    { header: 'Telefono', key: 'telefono', width: 20 },
    { header: 'Indirizzo e Città', key: 'indirizzo', width: 35 },
  ];
  styleHeader(wsPersone.getRow(1));
  personeList.forEach((p, idx) => {
    const row = wsPersone.addRow({
      cognome: p.cognome || '',
      nome: p.nome || '',
      cf: p.codice_fiscale || '',
      ruoli: p.ruoli || '',
      unita: p.unitaNomi || '',
      email: p.email || '',
      telefono: p.telefono || '',
      indirizzo: `${p.indirizzo || ''} ${p.citta || ''}`.trim(),
    });
    styleDataRow(row, idx + 1);
  });

  // FOGLIO 3: UNITÀ IMMOBILIARI
  const wsUnita = wb.addWorksheet('Unità Immobiliari');
  wsUnita.columns = [
    { header: 'N° Unità / Identificativo', key: 'numero', width: 20 },
    { header: 'Scala', key: 'scala', width: 12 },
    { header: 'Piano', key: 'piano', width: 12 },
    { header: 'Superficie mq', key: 'mq', width: 15 },
    { header: 'Proprietario Principale', key: 'prop', width: 30 },
    { header: 'Inquilino', key: 'inq', width: 30 },
  ];
  styleHeader(wsUnita.getRow(1));
  unitaList.forEach((u, idx) => {
    const propObj = u.occupanti_unita?.find(o => o.ruolo === 'proprietario' && o.attivo !== false)?.persone || u.occupanti?.find(o => o.tipo_occupante === 'proprietario' || o.ruolo === 'proprietario');
    const inqObj  = u.occupanti_unita?.find(o => o.ruolo === 'inquilino' && o.attivo !== false)?.persone || u.occupanti?.find(o => o.tipo_occupante === 'inquilino' || o.ruolo === 'inquilino');
    
    const propNome = propObj ? `${propObj.cognome || ''} ${propObj.nome || ''}`.trim() || propObj.persona_nome || '—' : '—';
    const inqNome  = inqObj  ? `${inqObj.cognome || ''} ${inqObj.nome || ''}`.trim() || inqObj.persona_nome || '—' : '—';

    const row = wsUnita.addRow({
      numero: u.nome || u.numero || `Unità ${idx + 1}`,
      scala: u.scala || '',
      piano: u.piano || '',
      mq: u.mq || u.superficie || '',
      prop: propNome,
      inq: inqNome,
    });
    styleDataRow(row, idx + 1);
  });

  // FOGLIO 4: TABELLE MILLESIMALI
  if (tabelleList && tabelleList.length > 0) {
    const wsMillesimi = wb.addWorksheet('Tabelle Millesimali');
    const cols = [{ header: 'Unità / Identificativo', key: 'unita', width: 25 }];
    tabelleList.forEach(t => {
      cols.push({ header: `${t.nome || 'Tabella'} (${t.codice || ''})`, key: `tab_${t.id}`, width: 22 });
    });
    wsMillesimi.columns = cols;
    styleHeader(wsMillesimi.getRow(1));

    unitaList.forEach((u, idx) => {
      const rowData = { unita: u.nome || u.numero || `Unità ${idx + 1}` };
      tabelleList.forEach(t => {
        const val = u.millesimi_unita?.find(m => m.tabella_id === t.id)?.valore || u.millesimi?.[t.id] || 0;
        rowData[`tab_${t.id}`] = Number(val).toLocaleString('it-IT', { minimumFractionDigits: 2 });
      });
      const row = wsMillesimi.addRow(rowData);
      styleDataRow(row, idx + 1);
    });
  }

  // FOGLIO 5: SALDI FINANZIARI & SITUAZIONE UNITA'
  if (saldiList && saldiList.length > 0) {
    const wsSaldi = wb.addWorksheet('Saldi Contabili Unità');
    wsSaldi.columns = [
      { header: 'Unità Immobiliare', key: 'unita', width: 25 },
      { header: 'Proprietario / Riferimento', key: 'prop', width: 30 },
      { header: 'Saldo Finale (Debito / Credito)', key: 'saldo', width: 25 },
      { header: 'Arretrati Pregressi', key: 'arretrati', width: 20 },
      { header: 'Quote Versate (Incassate)', key: 'versato', width: 22 },
      { header: 'Dovuto Totale Esercizio', key: 'dovuto', width: 22 },
    ];
    styleHeader(wsSaldi.getRow(1));
    saldiList.forEach((s, idx) => {
      const row = wsSaldi.addRow({
        unita: s.unita_nome || s.nome || `Unità ${idx + 1}`,
        prop: s.proprietario || '—',
        saldo: `€ ${Number(s.saldo || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}`,
        arretrati: `€ ${Number(s.arretrati || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}`,
        versato: `€ ${Number(s.versato || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}`,
        dovuto: `€ ${Number(s.dovuto || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}`,
      });
      styleDataRow(row, idx + 1);
    });
  }

  // FOGLIO 6: STORICO SPESE
  const wsSpese = wb.addWorksheet('Storico Spese & Fornitori');
  wsSpese.columns = [
    { header: 'Data Spesa', key: 'data', width: 14 },
    { header: 'Fornitore / Ragione Sociale', key: 'fornitore', width: 30 },
    { header: 'Descrizione / Causale', key: 'descrizione', width: 40 },
    { header: 'Importo Totale (€)', key: 'importo', width: 18 },
    { header: 'Esercizio Contabile', key: 'esercizio', width: 22 },
  ];
  styleHeader(wsSpese.getRow(1));
  speseList.forEach((sp, idx) => {
    const nomeEs = sp.esercizi?.anno ? `Esercizio ${sp.esercizi.anno}` : sp.esercizi?.nome || sp.esercizio_nome || '—';
    const row = wsSpese.addRow({
      data: sp.data_spesa || sp.data_fattura || '',
      fornitore: sp.fornitore_nome || sp.fornitori?.ragione_sociale || '—',
      descrizione: sp.descrizione || '',
      importo: `€ ${Number(sp.importo || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}`,
      esercizio: nomeEs,
    });
    styleDataRow(row, idx + 1);
  });

  return await wb.xlsx.writeBuffer();
}

/**
 * Crea e avvia il download dell'archivio .ZIP di Passaggio Consegne
 */
export async function exportPassaggioConsegneZip({
  condominio, unita = [], persone = [], tabelle = [], spese = [], esercizi = [], saldi = [],
  documenti = [], getSignedUrl, onProgress = () => {}
}) {
  const zip = new JSZip();
  const nomeCondo = (condominio?.nome || 'Condominio').replace(/[^a-zA-Z0-9_-]/g, '_');

  // 1) Generazione del Super-File Excel Multifoglio
  onProgress('Generazione registro contabile e anagrafico Excel...');
  const excelBuffer = await generatePassaggioExcelBuffer({ condominio, unita, persone, tabelle, spese, esercizi, saldi });
  zip.file(`1_REGISTRO_CONTABILE_E_ANAGRAFICO_${nomeCondo}.xlsx`, excelBuffer);

  // 2) Raccolta documenti di archivio da Supabase Storage
  if (documenti && documenti.length > 0 && typeof getSignedUrl === 'function') {
    const docFolder = zip.folder('2_DOCUMENTI_E_ARCHIVIO');
    let contatore = 0;

    for (const doc of documenti) {
      contatore++;
      onProgress(`Scaricamento documento ${contatore}/${documenti.length}: ${doc.nome || 'File'}...`);
      try {
        if (!doc.url_storage) continue;
        const signedUrl = await getSignedUrl(doc.url_storage);
        if (!signedUrl) continue;

        const resp = await fetch(signedUrl);
        if (!resp.ok) continue;
        const blob = await resp.blob();

        // Organizzazione per categorie normative
        let catDir = 'Altri_Documenti';
        if (doc.tipo === 'regolamento') catDir = 'Regolamento_Condominio';
        else if (doc.tipo === 'tabella_millesimale_doc') catDir = 'Tabelle_Millesimali';
        else if (doc.tipo === 'verbale') catDir = 'Verbali_Assemblea';
        else if (doc.tipo === 'estratto_conto' || doc.tipo === 'estratto_conto_archivio') catDir = 'Estratti_Conto_Bancari';
        else if (doc.tipo === 'contratto') catDir = 'Contratti_e_Appalti';

        // Estrazione sicura estensione
        const partiStorage = (doc.url_storage || '').split('.');
        const estensione = partiStorage.length > 1 ? partiStorage.pop() : (doc.nome || '').split('.').pop() || 'pdf';
        let nomePulito = (doc.nome || `Documento_${contatore}`).replace(/[^a-zA-Z0-9_.-]/g, '_');
        if (!nomePulito.toLowerCase().endsWith(`.${estensione.toLowerCase()}`)) {
          nomePulito += `.${estensione}`;
        }

        docFolder.folder(catDir).file(nomePulito, blob);
      } catch (errDoc) {
        console.warn(`Impossibile includere nello zip il documento "${doc.nome}":`, errDoc);
      }
    }
  }

  // 3) Generazione archivio compresso
  onProgress('Compressione cartella di passaggio consegne in corso...');
  const zipBlob = await zip.generateAsync({ type: 'blob' }, (metadata) => {
    onProgress(`Compressione ZIP: ${metadata.percent.toFixed(0)}%`);
  });

  // 4) Avvio download
  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `PASSAGGIO_CONSEGNE_${nomeCondo}_${new Date().toISOString().split('T')[0]}.zip`;
  a.click();
  URL.revokeObjectURL(url);
  onProgress('');
}
