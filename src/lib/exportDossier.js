// src/lib/exportDossier.js
import JSZip from 'jszip'
import { supabase } from './supabaseClient'
import { exportConsuntivoPdf } from './exportConsuntivo'

/**
 * Esporta il Dossier Completo di Rendicontazione (.zip)
 * Contiene:
 * 1. 01_Consuntivo_[Anno].pdf
 * 2. 02_Estratti_Conto/[Nome_File].pdf
 * 3. 03_Fatture_e_Spese/[Fornitore]_[Numero]_[Descrizione].[ext]
 */
export async function exportDossierRendiconto({
  condominio,
  consuntivo,
  template,
  unita,
  getProprietario,
  getMillesimiUnita,
  getTotaleTabella,
  tabellaMillId,
  withWatermark = false,
  onProgress = () => {},
}) {
  if (!condominio || !consuntivo) throw new Error("Dati condominio o consuntivo mancanti.")

  const anno = consuntivo.esercizio?.anno || new Date().getFullYear()
  const nomeCondo = (condominio.nome || 'Condominio').replace(/[^a-zA-Z0-9_\-]/g, '_')
  const zip = new JSZip()

  onProgress({ percent: 10, messaggio: 'Generazione Consuntivo PDF…' })

  // 1. Genera il Consuntivo PDF principale
  const pdfBuffer = await exportConsuntivoPdf({
    condominio,
    consuntivo: { ...consuntivo, returnDoc: true },
    template,
    unita,
    getProprietario,
    getMillesimiUnita,
    getTotaleTabella,
    tabellaMillId,
    withWatermark,
  })

  zip.file(`01_Consuntivo_${nomeCondo}_${anno}.pdf`, pdfBuffer)

  // 2. Recupera e scarica gli Estratti Conto dell'esercizio
  onProgress({ percent: 30, messaggio: 'Recupero Estratti Conto…' })
  const folderEc = zip.folder('02_Estratti_Conto')

  const { data: docsEc } = await supabase
    .from('documenti_condominio')
    .select('id, nome, file_path, tipo')
    .eq('condominio_id', condominio.id)
    .in('tipo', ['estratto_conto', 'estratto_conto_archivio'])

  if (docsEc && docsEc.length) {
    for (let i = 0; i < docsEc.length; i++) {
      const docEc = docsEc[i]
      if (docEc.file_path) {
        try {
          const { data: signedData } = await supabase.storage
            .from('documenti-condominio')
            .createSignedUrl(docEc.file_path, 900)
          
          const fileUrl = signedData?.signedUrl || docEc.file_path
          const res = await fetch(fileUrl)
          if (res.ok) {
            const buffer = await res.arrayBuffer()
            const ext = docEc.file_path.split('.').pop() || 'pdf'
            const cleanName = (docEc.nome || `Estratto_Conto_${i + 1}`).replace(/[^a-zA-Z0-9_\-]/g, '_')
            folderEc.file(`${cleanName}.${ext}`, buffer)
          }
        } catch (errEc) {
          console.warn('Impossibile scaricare estratto conto:', docEc.nome, errEc)
        }
      }
    }
  }

  // 3. Recupera e scarica le Fatture e i Giustificativi di Spesa
  onProgress({ percent: 60, messaggio: 'Raccolta Fatture e Giustificativi…' })
  const folderSpese = zip.folder('03_Fatture_e_Spese')

  const { data: fatture } = await supabase
    .from('fatture_fornitori')
    .select('id, fornitore, numero_fattura, data_fattura, importo_totale, pdf_url, f24_url, spesa_id')
    .eq('condominio_id', condominio.id)

  if (fatture && fatture.length) {
    for (let i = 0; i < fatture.length; i++) {
      const f = fatture[i]
      const targetUrl = f.pdf_url || f.f24_url
      if (targetUrl) {
        try {
          let downloadUrl = targetUrl
          if (!targetUrl.startsWith('http')) {
            const { data: sUrl } = await supabase.storage
              .from('fatture')
              .createSignedUrl(targetUrl, 900)
            downloadUrl = sUrl?.signedUrl || targetUrl
          }

          const resF = await fetch(downloadUrl)
          if (resF.ok) {
            const bufF = await resF.arrayBuffer()
            const extF = targetUrl.split('.').pop()?.split('?')[0] || 'pdf'
            const fornName = (f.fornitore || 'Fornitore').replace(/[^a-zA-Z0-9_\-]/g, '_')
            const numFatt = (f.numero_fattura || `ID_${f.id}`).replace(/[^a-zA-Z0-9_\-]/g, '_')
            folderSpese.file(`${fornName}_Fatt_${numFatt}.${extF}`, bufF)
          }
        } catch (errF) {
          console.warn('Impossibile scaricare fattura:', f.fornitore, errF)
        }
      }
    }
  }

  // 4. Pacchettizza ed esporta il file ZIP
  onProgress({ percent: 90, messaggio: 'Compressione archivio ZIP…' })
  const contentBlob = await zip.generateAsync({ type: 'blob' }, (metadata) => {
    onProgress({ percent: 90 + Math.round(metadata.percent * 0.1), messaggio: 'Compressione in corso…' })
  })

  onProgress({ percent: 100, messaggio: 'Download avviato!' })

  // Trigger download nel browser
  const link = document.createElement('a')
  link.href = URL.createObjectURL(contentBlob)
  link.download = `Dossier_Rendiconto_${nomeCondo}_${anno}.zip`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(link.href)
}
