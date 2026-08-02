import jsPDF from 'jspdf';
import { applyWatermark } from './watermark';

export async function generaDeliberaPrivacy(condominio, profile) {
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
  doc.text(`Condominio: ${condominio?.nome}`, W / 2, y, { align: 'center' });
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

  // Corpo
  doc.setFont('helvetica', 'normal');
  const bodyText = `L'Assemblea dei Condòmini, regolarmente costituita e validamente atta a deliberare, esaminata la proposta presentata dall'Amministratore in merito alla necessità di adempiere agli obblighi previsti dall'Art. 1130 c.c. e dal Regolamento Europeo 2016/679 (GDPR), delibera quanto segue:

1. Di approvare l'attivazione del modulo "Conservazione Fiscale Sostitutiva 10 Anni e Portale Telematico GDPR" offerto tramite la piattaforma gestionale CondoFAST.
2. Di autorizzare l'Amministratore ad addebitare al Condominio il canone annuale per tale servizio, pari a 36,00 € + IVA.
3. Di prendere atto che il servizio garantisce la conservazione a norma delle fatture, dei rendiconti e delle pezze giustificative per la durata di 10 anni, nonché la predisposizione del Registro dei Trattamenti e l'accesso H24 da parte dei condòmini ai propri documenti.
4. Di nominare l'Amministratore pro-tempore quale Responsabile del Trattamento (Data Processor) autorizzandolo all'uso della piattaforma in cloud per la gestione dei dati personali del Condominio.`;

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
