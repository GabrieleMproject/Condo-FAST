import jsPDF from 'jspdf';
import { applyWatermark } from './watermark';

export async function generaDeliberaPrivacy(condominio, profile, pacchetto = 'base_36') {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  let y = 20;

  // Header Amministratore
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text(profile?.ragione_sociale || profile?.studio_nome || 'Amministrazione', 14, y);
  y += 8;

  // Header Condominio
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('DELIBERA ASSEMBLEARE', W / 2, y, { align: 'center' });
  y += 10;
  
  doc.setFontSize(12);
  doc.text(`Condominio: ${condominio?.nome || 'N/D'}`, W / 2, y, { align: 'center' });
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`${condominio?.indirizzo || ''}, ${condominio?.citta || ''}`, W / 2, y, { align: 'center' });
  y += 15;

  // Oggetto
  doc.setFont('helvetica', 'bold');
  const obj = 'OGGETTO: Approvazione Servizio di Conservazione Fiscale Sostitutiva 10 Anni e Portale Telematico GDPR';
  const objLines = doc.splitTextToSize(obj, W - 28);
  doc.text(objLines, 14, y);
  y += objLines.length * 6 + 6;

  // Formatta prezzo
  const pacchettiInfo = {
    'base_36': { nome: 'Standard (Solo Conservazione GDPR)', prezzo: 36 },
    'app_limitata_100': { nome: 'App Condòmini (Versione Limitata)', prezzo: 100 },
    'app_full_150': { nome: 'App Condòmini Full Option', prezzo: 150 }
  };
  const info = pacchettiInfo[pacchetto] || pacchettiInfo['base_36'];
  const prezzoFormattato = parseFloat(info.prezzo).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Corpo
  doc.setFont('helvetica', 'normal');
  const bodyText = `L'Assemblea dei Condòmini, regolarmente costituita e validamente atta a deliberare, esaminata la proposta presentata dall'Amministratore in merito alla necessità di adempiere agli obblighi previsti dall'Art. 1130 c.c. e dal Regolamento Europeo 2016/679 (GDPR), delibera quanto segue:

1. Di approvare l'attivazione del Pacchetto Ufficiale CondoFAST denominato "${info.nome}".
2. Di autorizzare la spesa annuale per tale servizio, pari a ${prezzoFormattato} € + IVA, che verrà fatturata direttamente al Condominio da M PROJECT S.r.l.
3. Di prendere atto che il servizio garantisce la conservazione a norma delle fatture, dei rendiconti e delle pezze giustificative per la durata di 10 anni, nonché l'eventuale accesso telematico in base al piano scelto.
4. Di nominare l'Amministratore pro-tempore quale Responsabile del Trattamento (Data Processor) autorizzandolo all'uso della piattaforma in cloud.`;

  const lines = doc.splitTextToSize(bodyText, W - 28);
  doc.text(lines, 14, y);
  y += lines.length * 6 + 15;

  // Firme
  doc.text('Il Presidente dell\'Assemblea', 20, y);
  doc.text('Il Segretario', W - 60, y);
  y += 15;
  doc.setLineWidth(0.3);
  doc.line(15, y, 70, y);
  doc.line(W - 65, y, W - 15, y);

  applyWatermark(doc, false);
  doc.save(`Delibera_Privacy_Telematici_${(condominio?.nome || 'Condominio').replace(/\s+/g, '_')}.pdf`);
}
