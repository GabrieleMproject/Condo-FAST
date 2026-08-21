// src/lib/ravvedimentoEngine.js
/**
 * Motore per il calcolo del Ravvedimento Operoso (Art. 13 D.Lgs. 472/1997 e ss.mm.ii.)
 * per ritenute d'acconto condominiali non versate o versate in ritardo/difetto.
 */

// Tassi di interesse legale annui in vigore in Italia
export const TASSI_INTERESSE_LEGALE = {
  2023: 0.05,    // 5.0%
  2024: 0.025,   // 2.5%
  2025: 0.02,    // 2.0%
  2026: 0.02,    // 2.0% (default di legge)
};

/**
 * Restituisce il tasso di interesse legale annuo per una determinata data.
 */
export function getTassoInteresseLegale(anno) {
  return TASSI_INTERESSE_LEGALE[anno] ?? 0.02;
}

/**
 * Calcola la frazione di sanzione ridotta applicabile in base ai giorni di ritardo
 * dalla scadenza naturale (giorno 16 del mese di scadenza).
 * 
 * @param {number} giorniRitardo 
 * @returns {object} { percentualeSanzione, tipologiaRavvedimento, norma }
 */
export function calcolaScaglioneSanzione(giorniRitardo) {
  if (giorniRitardo <= 0) {
    return {
      percentualeSanzione: 0,
      tipologiaRavvedimento: 'Nessun ritardo',
      norma: 'Versamento tempestivo'
    };
  }

  // 1. Ravvedimento Sprint (entro 14 giorni): 0.1% al giorno (1/10 del 15% / 15 gg = 0.1% gg)
  if (giorniRitardo <= 14) {
    const perc = Math.round((giorniRitardo * 0.1) * 100) / 100;
    return {
      percentualeSanzione: perc,
      tipologiaRavvedimento: 'Ravvedimento Sprint (1-14 gg)',
      norma: 'Art. 13 c. 1 lett. a-bis D.Lgs. 472/97 (0,1% per ciascun giorno)'
    };
  }

  // 2. Ravvedimento Breve (dal 15° al 30° giorno): 1.50% (1/10 della sanzione ordinaria del 15%)
  if (giorniRitardo <= 30) {
    return {
      percentualeSanzione: 1.50,
      tipologiaRavvedimento: 'Ravvedimento Breve (15-30 gg)',
      norma: 'Art. 13 c. 1 lett. a D.Lgs. 472/97 (1/10 del minimo edittale 15%)'
    };
  }

  // 3. Ravvedimento Medio (dal 31° al 90° giorno): 1.67% (1/9 del 15%)
  if (giorniRitardo <= 90) {
    return {
      percentualeSanzione: 1.67,
      tipologiaRavvedimento: 'Ravvedimento Medio (31-90 gg)',
      norma: 'Art. 13 c. 1 lett. a-bis D.Lgs. 472/97 (1/9 del minimo edittale 15%)'
    };
  }

  // 4. Ravvedimento Lungo (dal 91° giorno entro 1 anno o termine dichiarazione 770 dell'anno): 3.75% (1/8 del 30%)
  if (giorniRitardo <= 365) {
    return {
      percentualeSanzione: 3.75,
      tipologiaRavvedimento: 'Ravvedimento Lungo (entro 1 anno)',
      norma: 'Art. 13 c. 1 lett. b D.Lgs. 472/97 (1/8 del 30%)'
    };
  }

  // 5. Ravvedimento Lunghissimo (oltre 1 anno ed entro 2 anni): 4.29% (1/7 del 30%)
  return {
    percentualeSanzione: 4.29,
    tipologiaRavvedimento: 'Ravvedimento Lunghissimo (oltre 1 anno)',
    norma: 'Art. 13 c. 1 lett. b-bis D.Lgs. 472/97 (1/7 del 30%)'
  };
}

/**
 * Calcola giorno per giorno gli interessi legali moratori esatti
 * tenendo conto di eventuali cambi di tasso annuo a cavallo d'anno.
 * 
 * @param {number} importoImposta - Quota di imposta non versata
 * @param {Date} dataScadenza - Data scadenza originaria (es. 16 del mese)
 * @param {Date} dataPagamento - Data in cui si esegue il versamento con ravvedimento
 * @returns {number} Interessi legali totali arrotondati al centesimo
 */
export function calcolaInteressiLegali(importoImposta, dataScadenza, dataPagamento) {
  if (!importoImposta || importoImposta <= 0) return 0;
  if (!dataScadenza || !dataPagamento || dataPagamento <= dataScadenza) return 0;

  const msPerGiorno = 1000 * 60 * 60 * 24;
  const giorniTotali = Math.floor((dataPagamento.getTime() - dataScadenza.getTime()) / msPerGiorno);
  if (giorniTotali <= 0) return 0;

  let interessiTotali = 0;
  let dataCorrente = new Date(dataScadenza.getTime());

  // Itera giorno per giorno per applicare il tasso legale dell'anno corrispondente
  for (let i = 0; i < giorniTotali; i++) {
    dataCorrente.setDate(dataCorrente.getDate() + 1);
    const anno = dataCorrente.getFullYear();
    const tassoAnnuo = getTassoInteresseLegale(anno);
    const isBisestile = (anno % 4 === 0 && anno % 100 !== 0) || (anno % 400 === 0);
    const giorniAnno = isBisestile ? 366 : 365;

    interessiTotali += (importoImposta * tassoAnnuo) / giorniAnno;
  }

  return Math.round(interessiTotali * 100) / 100;
}

/**
 * Esegue il calcolo completo del Ravvedimento Operoso e genera la distinta tributi per l'F24.
 * 
 * @param {object} params
 * @param {number} params.importoImposta - Importo tributo dovuto non versato
 * @param {string} params.codiceTributo - 1019, 1020, 1040 o 1038
 * @param {string|Date} params.dataScadenza - Data scadenza originaria YYYY-MM-DD
 * @param {string|Date} [params.dataVersamento] - Data prevista versamento (default: oggi)
 * @param {number} [params.meseRiferimento] - 1..12
 * @param {number} [params.annoRiferimento] - YYYY
 * @returns {object} Risultato con imposta, sanzione, interessi, totale, scaglione e righe F24
 */
export function calcolaRavvedimentoCompleto({
  importoImposta,
  codiceTributo = '1019',
  dataScadenza,
  dataVersamento = new Date(),
  meseRiferimento = null,
  annoRiferimento = null
}) {
  const imposta = Math.max(0, parseFloat(importoImposta) || 0);
  const dScadenza = new Date(dataScadenza);
  const dVersamento = typeof dataVersamento === 'string' ? new Date(dataVersamento) : dataVersamento;

  if (isNaN(dScadenza.getTime()) || isNaN(dVersamento.getTime())) {
    throw new Error("Date di scadenza o versamento non valide.");
  }

  const msPerGiorno = 1000 * 60 * 60 * 24;
  const giorniRitardo = Math.max(0, Math.floor((dVersamento.getTime() - dScadenza.getTime()) / msPerGiorno));

  const { percentualeSanzione, tipologiaRavvedimento, norma } = calcolaScaglioneSanzione(giorniRitardo);

  const importoSanzione = Math.round((imposta * (percentualeSanzione / 100)) * 100) / 100;
  const importoInteressi = calcolaInteressiLegali(imposta, dScadenza, dVersamento);
  const importoTotaleF24 = Math.round((imposta + importoSanzione + importoInteressi) * 100) / 100;

  const meseRif = meseRiferimento || (dScadenza.getMonth() === 0 ? 12 : dScadenza.getMonth());
  const annoRif = annoRiferimento || (dScadenza.getMonth() === 0 ? dScadenza.getFullYear() - 1 : dScadenza.getFullYear());

  // Righe tributi pronte per l'inserimento in f24_dettagli_tributi
  const righeTributiF24 = [
    {
      codice_tributo: codiceTributo,
      descrizione: `Ritenuta d'acconto principale (cod. ${codiceTributo})`,
      mese_riferimento: meseRif,
      anno_riferimento: annoRif,
      importo: imposta,
      tipo: 'imposta'
    },
    {
      codice_tributo: '8911',
      descrizione: `Sanzione pecuniaria per ravvedimento operoso (${percentualeSanzione}%)`,
      mese_riferimento: meseRif,
      anno_riferimento: annoRif,
      importo: importoSanzione,
      tipo: 'sanzione'
    },
    {
      codice_tributo: '1992',
      descrizione: `Interessi legali moratori (${giorniRitardo} giorni di ritardo)`,
      mese_riferimento: meseRif,
      anno_riferimento: annoRif,
      importo: importoInteressi,
      tipo: 'interessi'
    }
  ].filter(r => r.importo > 0);

  return {
    imposta,
    codiceTributo,
    giorniRitardo,
    percentualeSanzione,
    tipologiaRavvedimento,
    norma,
    importoSanzione,
    importoInteressi,
    importoTotaleF24,
    dataScadenzaOriginale: dScadenza.toISOString().split('T')[0],
    dataVersamentoPrevista: dVersamento.toISOString().split('T')[0],
    meseRiferimento: meseRif,
    annoRiferimento: annoRif,
    righeTributiF24
  };
}
