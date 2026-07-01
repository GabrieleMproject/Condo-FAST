export function applyWatermark(doc, enabled) {
  if (!enabled) return;

  const totalPages = doc.internal.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    
    // Configura la filigrana
    doc.saveGraphicsState();
    doc.setGState(new doc.GState({ opacity: 0.15 })); // Trasparenza
    doc.setTextColor(150, 150, 150);
    doc.setFontSize(50);
    doc.setFont('helvetica', 'bold');
    
    // Scritta in diagonale al centro della pagina
    doc.text(
      'CondoAI - Versione Gratuita',
      pageWidth / 2,
      pageHeight / 2,
      {
        angle: 45,
        align: 'center',
        baseline: 'middle'
      }
    );
    
    doc.restoreGraphicsState();
  }
}
