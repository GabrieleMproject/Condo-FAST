/**
 * xmlFatturaParser.js
 * Parser nativo JavaScript in 0ms / 0 crediti AI per Fatture Elettroniche PA/B2B (.xml e .p7m).
 * Estrae i dati fiscali e contabili conformi allo standard SDI dell'Agenzia delle Entrate.
 */

export async function parseFatturaXmlP7m(file) {
  if (!file) {
    throw new Error('Nessun file selezionato.');
  }

  // 1. Estrai il testo XML dal file (.xml puro o .xml.p7m PKCS#7 enveloped)
  const rawText = await readFileAsTextOrExtractP7m(file);
  
  // 2. Parsa l'XML usando il DOMParser nativo del browser
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(rawText, 'application/xml');

  const parserError = xmlDoc.querySelector('parsererror');
  if (parserError) {
    throw new Error('Impossibile decodificare la Struttura XML della Fattura Elettronica: file corrotto o non valido.');
  }

  // Ignora file di notifica o metadati SDI privi di corpo fattura
  const hasFatturaBody = xmlDoc.querySelector('FatturaElettronicaBody') || xmlDoc.getElementsByTagName('FatturaElettronicaBody').length > 0;
  const hasCedente = xmlDoc.querySelector('CedentePrestatore') || xmlDoc.getElementsByTagName('CedentePrestatore').length > 0;
  if (!hasFatturaBody && !hasCedente) {
    throw new Error('Il file XML non contiene una Fattura Elettronica valida (file di notifica, metadati SDI o formato non conforme).');
  }

  // 3. Helper per cercare elementi ignorando prefissi namespace (es. p:FatturaElettronica, ns2:Header...)
  const getTag = (parent, tagName) => {
    if (!parent) return null;
    const all = parent.getElementsByTagName('*');
    for (let i = 0; i < all.length; i++) {
      const nodeName = all[i].nodeName.toLowerCase();
      if (nodeName === tagName.toLowerCase() || nodeName.endsWith(':' + tagName.toLowerCase())) {
        return all[i];
      }
    }
    return null;
  };

  const getTags = (parent, tagName) => {
    if (!parent) return [];
    const results = [];
    const all = parent.getElementsByTagName('*');
    for (let i = 0; i < all.length; i++) {
      const nodeName = all[i].nodeName.toLowerCase();
      if (nodeName === tagName.toLowerCase() || nodeName.endsWith(':' + tagName.toLowerCase())) {
        results.push(all[i]);
      }
    }
    return results;
  };

  const getVal = (parent, tagName) => {
    const el = getTag(parent, tagName);
    return el ? el.textContent.trim() : null;
  };

  // 4. Estrazione Dati Cedente / Prestatore (Fornitore)
  const cedente = getTag(xmlDoc, 'CedentePrestatore');
  let fornitoreNome = null;
  let pIvaFornitore = null;
  let cfFornitore = null;

  if (cedente) {
    const anagrafica = getTag(cedente, 'Anagrafica');
    if (anagrafica) {
      const den = getVal(anagrafica, 'Denominazione');
      const nom = getVal(anagrafica, 'Nome');
      const cog = getVal(anagrafica, 'Cognome');
      fornitoreNome = den || [nom, cog].filter(Boolean).join(' ') || 'Fornitore sconosciuto';
    }
    
    const idFiscale = getTag(cedente, 'IdFiscaleIVA');
    if (idFiscale) {
      pIvaFornitore = getVal(idFiscale, 'IdCodice');
    }
    cfFornitore = getVal(cedente, 'CodiceFiscale') || pIvaFornitore;
  }

  // 5. Estrazione Dati Cessionario / Committente (Condominio Destinatario)
  const cessionario = getTag(xmlDoc, 'CessionarioCommittente');
  let condoNome = null;
  let condoCf = null;
  if (cessionario) {
    const anagrafica = getTag(cessionario, 'Anagrafica');
    if (anagrafica) {
      condoNome = getVal(anagrafica, 'Denominazione') || [getVal(anagrafica, 'Nome'), getVal(anagrafica, 'Cognome')].filter(Boolean).join(' ');
    }
    condoCf = getVal(cessionario, 'CodiceFiscale');
  }

  // 6. Estrazione Dati Generali Documento
  const datiGeneraliDoc = getTag(xmlDoc, 'DatiGeneraliDocumento');
  const numeroFattura = getVal(datiGeneraliDoc, 'Numero');
  let dataFattura = getVal(datiGeneraliDoc, 'Data'); // formato YYYY-MM-DD
  const importoTotaleDoc = parseFloat(getVal(datiGeneraliDoc, 'ImportoTotaleDocumento')) || 0;

  // Normalizza data fattura
  if (dataFattura && dataFattura.includes('T')) {
    dataFattura = dataFattura.split('T')[0];
  }

  // 7. Estrazione Linee di Dettaglio e Descrizione
  const linee = getTags(xmlDoc, 'DettaglioLinee');
  const descrizioni = [];
  linee.forEach(l => {
    const d = getVal(l, 'Descrizione');
    if (d) descrizioni.push(d);
  });
  const descrizioneSintetica = descrizioni.join(' · ') || 'Fattura Elettronica SDI';

  // 8. Estrazione Riepilogo IVA e Imponibile
  const riepiloghi = getTags(xmlDoc, 'DatiRiepilogo');
  let importoNetto = 0;
  let importoIva = 0;
  let aliquotaIva = 0;

  riepiloghi.forEach(r => {
    const imp = parseFloat(getVal(r, 'ImponibileImporto')) || 0;
    const iva = parseFloat(getVal(r, 'Imposta')) || 0;
    const aliq = parseFloat(getVal(r, 'AliquotaIVA')) || 0;

    importoNetto += imp;
    importoIva += iva;
    if (aliq > aliquotaIva) aliquotaIva = aliq;
  });

  const totaleFattura = importoTotaleDoc > 0 ? importoTotaleDoc : (importoNetto + importoIva);

  // 9. Estrazione Ritenuta d'Acconto e Codice Tributo F24
  const datiRitenuta = getTag(xmlDoc, 'DatiRitenuta');
  let imponibileRitenuta = 0;
  let aliquotaRitenuta = 0;
  let importoRitenuta = 0;
  let codiceTributoF24 = null;

  if (datiRitenuta) {
    importoRitenuta = parseFloat(getVal(datiRitenuta, 'ImportoRitenuta')) || 0;
    aliquotaRitenuta = parseFloat(getVal(datiRitenuta, 'AliquotaRitenuta')) || 0;
    const causalePagamento = (getVal(datiRitenuta, 'CausalePagamento') || '').toUpperCase();

    if (importoRitenuta > 0 && aliquotaRitenuta > 0) {
      imponibileRitenuta = parseFloat((importoRitenuta * 100 / aliquotaRitenuta).toFixed(2));
    } else if (importoRitenuta > 0) {
      imponibileRitenuta = importoNetto;
    }

    // Auto-mappatura del codice tributo F24
    if (aliquotaRitenuta === 4 || causalePagamento === 'W' || causalePagamento === 'Y') {
      codiceTributoF24 = '1019'; // Contratti d'appalto condominio (4%)
    } else if (causalePagamento === 'S') {
      codiceTributoF24 = '1020'; // Contratti d'opera (4%)
    } else if (aliquotaRitenuta === 20 || ['A', 'Z', 'M', 'O', 'Q', 'R'].includes(causalePagamento)) {
      codiceTributoF24 = '1040'; // Professionisti / lavoro autonomo (20%)
    } else if (importoRitenuta > 0) {
      codiceTributoF24 = aliquotaRitenuta <= 4 ? '1019' : '1040';
    }
  }

  // 10. Estrazione Dati Pagamento (Scadenza e IBAN)
  const datiPagamento = getTag(xmlDoc, 'DettaglioPagamento');
  let dataScadenza = null;

  if (datiPagamento) {
    dataScadenza = getVal(datiPagamento, 'DataScadenzaPagamento');
    if (dataScadenza && dataScadenza.includes('T')) {
      dataScadenza = dataScadenza.split('T')[0];
    }
  }

  // 11. Inferenza Categoria
  const categoria = inferisciCategoria(descrizioneSintetica, fornitoreNome);

  // 12. Ritorna l'oggetto dati unificato perfettamente compatibile con estraiFattura
  return {
    is_valido: true,
    dati: {
      fornitore: fornitoreNome || 'Fornitore sconosciuto',
      partita_iva_fornitore: pIvaFornitore || cfFornitore,
      numero_fattura: numeroFattura || null,
      data_fattura: dataFattura || new Date().toISOString().split('T')[0],
      data_scadenza: dataScadenza || null,
      importo_totale: parseFloat(totaleFattura.toFixed(2)),
      importo_netto: parseFloat(importoNetto.toFixed(2)),
      importo_iva: parseFloat(importoIva.toFixed(2)),
      aliquota_iva: aliquotaIva,
      descrizione: descrizioneSintetica,
      categoria: categoria,
      imponibile_ritenuta: parseFloat(imponibileRitenuta.toFixed(2)),
      aliquota_ritenuta_percentuale: aliquotaRitenuta,
      importo_ritenuta: parseFloat(importoRitenuta.toFixed(2)),
      codice_tributo_f24: codiceTributoF24,
      condominio_destinatario_nome: condoNome,
      condominio_destinatario_codice_fiscale: condoCf,
      fonte_estrazione: 'sdi_xml_nativo'
    }
  };
}

/**
 * Legge il file come testo ed estrae l'XML (supporta anche l'envelope PKCS#7 .p7m)
 */
async function readFileAsTextOrExtractP7m(file) {
  const isP7m = file.name.toLowerCase().endsWith('.p7m');

  if (!isP7m) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsText(file, 'UTF-8');
    });
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const content = reader.result;
      
      // Trova l'inizio del tag XML (<FatturaElettronica o <?xml)
      const xmlStartMatch = content.match(/<\??(p:)?FatturaElettronica|<\?xml/i);
      if (!xmlStartMatch) {
        reject(new Error('Impossibile individuare il contenuto XML all\'interno del file .p7m.'));
        return;
      }

      const startIndex = xmlStartMatch.index;
      
      // Trova la chiusura del tag XML (</FatturaElettronica> o </p:FatturaElettronica>)
      const xmlEndMatch = content.match(/<\/(p:)?FatturaElettronica>/i);
      if (!xmlEndMatch) {
        reject(new Error('Il file .p7m risulta incompleto o interrotto.'));
        return;
      }

      const endIndex = xmlEndMatch.index + xmlEndMatch[0].length;
      const xmlContent = content.substring(startIndex, endIndex);
      resolve(xmlContent);
    };
    reader.onerror = reject;
    reader.readAsText(file, 'ISO-8859-1');
  });
}

/**
 * Assegna la categoria di spesa contabile basandosi sulla descrizione o nome fornitore
 */
function inferisciCategoria(desc, fornitore) {
  const testo = `${desc} ${fornitore}`.toLowerCase();
  
  if (testo.includes('puliz') || testo.includes('igiene') || testo.includes('sanificaz')) return 'pulizie';
  if (testo.includes('luce') || testo.includes('gas') || testo.includes('acqua') || testo.includes('energia') || testo.includes('servizio elettrico') || testo.includes('enel') || testo.includes('eni') || testo.includes('a2a')) return 'utenze';
  if (testo.includes('assicuraz') || testo.includes('polizza') || testo.includes('premio') || testo.includes('generali') || testo.includes('unipol') || testo.includes('allianz')) return 'assicurazione';
  if (testo.includes('onorario') || testo.includes('compenso') || testo.includes('amministraz') || testo.includes('studio')) return 'amministrazione';
  if (testo.includes('manutenz') || testo.includes('riparaz') || testo.includes('ascensore') || testo.includes('autoclave') || testo.includes('giardin') || testo.includes('cancello') || testo.includes('edile')) return 'manutenzione';
  
  return 'altro';
}
