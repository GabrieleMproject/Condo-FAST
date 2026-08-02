import jsPDF from 'jspdf';
import { applyWatermark } from './watermark';

export async function generaCertificatoGdpr(condominio, profile) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  let y = 20;

  // Colori Branding CondoFAST
  doc.setFillColor(16, 185, 129); // Verde Smeraldo
  doc.rect(0, 0, W, 10, 'F');

  // Header Amministratore
  y = 30;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(16, 185, 129);
  doc.text('CERTIFICATO DI CONFORMITA\' GDPR', W / 2, y, { align: 'center' });
  y += 20;

  // Dettagli Condominio
  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59);
  doc.text(`Condominio: ${condominio?.nome}`, 14, y);
  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.text(`Indirizzo: ${condominio?.indirizzo || ''}, ${condominio?.citta || ''}`, 14, y);
  y += 6;
  doc.text(`Codice Fiscale: ${condominio?.codice_fiscale || 'Non specificato'}`, 14, y);
  y += 15;

  // Dettagli Amministratore / Titolare
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Amministratore / Responsabile del Trattamento:', 14, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.text(profile?.ragione_sociale || profile?.studio_nome || 'Amministratore', 14, y);
  y += 15;

  // Corpo del certificato
  const testoAttestazione = `Si attesta che il Condominio in epigrafe ha attivato il servizio di "Conservazione Fiscale Sostitutiva 10 Anni e Portale Telematico" tramite la piattaforma software CondoFAST.

Il servizio include:
- Conservazione a norma di legge delle fatture elettroniche e dei documenti contabili per 10 anni (ex Art. 1130 c.c.).
- Accesso telematico riservato ai condòmini per la consultazione H24 dei documenti.
- Gestione strutturata e sicura dei dati personali (Regolamento UE 2016/679 - GDPR) con backup in cloud crittografato.
- Tenuta automatizzata del Registro dei Trattamenti dell'Amministratore.

Il sistema garantisce i diritti di accesso, rettifica, portabilità e oblio degli interessati, in totale conformità con la normativa vigente in materia di protezione dei dati.`;

  const lines = doc.splitTextToSize(testoAttestazione, W - 28);
  doc.text(lines, 14, y);
  y += lines.length * 6 + 20;

  // Data di rilascio
  doc.setFont('helvetica', 'bold');
  doc.text(`Data di Rilascio: ${new Date().toLocaleDateString('it-IT')}`, 14, y);

  // Validità
  y = doc.internal.pageSize.getHeight() - 20;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text('Documento generato automaticamente dalla piattaforma CondoFAST.', W / 2, y, { align: 'center' });

  applyWatermark(doc, false);
  doc.save(`Certificato_GDPR_${(condominio?.nome || 'Condominio').replace(/\s+/g, '_')}.pdf`);
}
