/**
 * Utility per la generazione e il download istantaneo al browser di file di prova (PDF / CSV)
 * utilizzati durante il percorso di onboarding della Masterclass.
 */

import jsPDF from 'jspdf'

/**
 * Genera e scarica al volo una Fattura PDF di prova con Ritenuta d'Acconto del 4%
 */
export function scaricaFatturaPdfDemo() {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  })

  // Stile Intestazione Fornitore
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(37, 99, 235) // Blu CondoSmart
  doc.text('LA BRILLANTE SRL', 14, 20)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(100, 116, 139)
  doc.text('Servizi di Pulizia e Sanificazione Condominiale', 14, 26)
  doc.text('Via della Spiga 45 - 00100 Roma (RM)', 14, 31)
  doc.text('P.IVA: 09876543210 - C.F.: 09876543210', 14, 36)
  doc.text('Email: fatturazione@labrillantesrl.it', 14, 41)

  // Riquadro Dati Fattura
  doc.setLineWidth(0.5)
  doc.setDrawColor(203, 213, 225)
  doc.rect(120, 14, 76, 30)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.setTextColor(15, 23, 42)
  doc.text('FATTURA N° 142/2026', 125, 22)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(`Data Fattura: 15/02/2026`, 125, 29)
  doc.text(`Destinatario: Condominio Parco delle Rose`, 125, 35)
  doc.text(`Codice Fiscale: 97854630582`, 125, 40)

  // Tabella Voci Fattura
  doc.setFillColor(241, 245, 249)
  doc.rect(14, 52, 182, 8, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(30, 41, 59)
  doc.text('Descrizione Prestazione', 18, 57)
  doc.text('Importo (€)', 165, 57)

  doc.setFont('helvetica', 'normal')
  doc.text('Servizio Pulizia Scale e Spazi Comuni - Mese di Gennaio 2026', 18, 67)
  doc.text('368.85', 165, 67)

  doc.line(14, 72, 196, 72)

  // Totali e Ritenuta d'Acconto 4%
  let y = 80
  doc.setFontSize(10)
  doc.text('Imponibile:', 130, y)
  doc.text('€ 368.85', 165, y)

  y += 6
  doc.text('IVA 22%:', 130, y)
  doc.text('€ 81.15', 165, y)

  y += 6
  doc.setFont('helvetica', 'bold')
  doc.text('Totale Fattura:', 130, y)
  doc.text('€ 450.00', 165, y)

  y += 7
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(220, 38, 38) // Rosso Ritenuta
  doc.text('Ritenuta d\'Acconto (4%):', 130, y)
  doc.text('- € 14.75', 165, y)

  y += 7
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(22, 163, 74) // Verde Netto
  doc.text('Netto a Pagarci:', 130, y)
  doc.text('€ 435.25', 165, y)

  // Footer Nota Prova
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8)
  doc.setTextColor(148, 163, 184)
  doc.text('Documento di prova generato automaticamente per la Masterclass Onboarding CondoSmart.', 14, 120)

  // Trigger Download
  doc.save('Fattura_Di_Prova_Pulizie_LaBrillante.pdf')
}

/**
 * Genera e scarica al volo un file CSV estratto conto di prova per la riconciliazione
 */
export function scaricaEstrattoContoCsvDemo() {
  const dateOggi = new Date().toISOString().split('T')[0]
  
  const csvContent = 
`Data Movimento;Descrizione Operazione;Importo (€);Tipo
15/01/2026;BONIFICO DA ROSSI ALESSANDRO QUOTA RATA Q1;350.00;entrata
18/02/2026;PAGAMENTO FATTURA N 142 LA BRILLANTE SRL;-450.00;uscita
${dateOggi};BONIFICO DA MORETTI ELENA SALDO RATA CONDOMINIALE;400.00;entrata
${dateOggi};PAGAMENTO POLIZZA ASSICURATIVA GENERALI;-1200.00;uscita
`

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.setAttribute('href', url)
  link.setAttribute('download', 'Estratto_Conto_Banca_Test.csv')
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
