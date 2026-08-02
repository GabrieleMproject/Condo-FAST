import { useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabaseClient'
import { callGeminiDocument } from '../lib/geminiClient'
import { docxToText, comprimiImmagine } from '../lib/fileExtractor'

const BUCKET = 'documenti-condominio'

export function useDocumenti(condominioId) {
  const [documenti, setDocumenti] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Mappa di cache per i Signed URL temporanei (path -> { url, expiresAt })
  const signedUrlCacheRef = useRef(new Map())

  const precacheSignedUrls = useCallback(async (listaDocs) => {
    if (!listaDocs || !listaDocs.length) return
    const now = Date.now()
    const pathsToFetch = listaDocs
      .map(d => d.url_storage)
      .filter(p => p && (!signedUrlCacheRef.current.has(p) || signedUrlCacheRef.current.get(p).expiresAt < now + 60000))

    if (!pathsToFetch.length) return

    try {
      const { data: signedList } = await supabase.storage
        .from(BUCKET)
        .createSignedUrls(pathsToFetch, 15 * 60)

      if (signedList) {
        signedList.forEach(item => {
          if (item?.path && item?.signedUrl) {
            signedUrlCacheRef.current.set(item.path, {
              url: item.signedUrl,
              expiresAt: now + 14 * 60 * 1000 // Scadenza raccomandata 14 min
            })
          }
        })
      }
    } catch (errPre) {
      console.warn('Errore precache signed URLs:', errPre)
    }
  }, [])

  const fetch = useCallback(async () => {
    if (!condominioId) return
    setLoading(true)
    setError(null)
    try {
      const { data, error } = await supabase
        .from('documenti_condominio')
        .select('*')
        .eq('condominio_id', condominioId)
        .order('created_at', { ascending: false })
      if (error) throw error
      const docs = data || []
      setDocumenti(docs)
      // Avvia pre-caching in background
      precacheSignedUrls(docs)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [condominioId, precacheSignedUrls])

  const upload = useCallback(async (file, tipo, nome, note = '', dataDocumento = null, sinistroId = null) => {
    setLoading(true)
    setError(null)
    try {
      if (file.size > 10 * 1024 * 1024) {
        throw new Error('Il file supera il limite massimo consentito di 10MB.')
      }

      // Prevenzione SVG/HTML Upload (Stored XSS)
      const invalidTypes = ['image/svg+xml', 'text/html', 'application/xhtml+xml', 'text/xml']
      if (invalidTypes.includes(file.type) || file.name.match(/\.(svg|html|htm|xml)$/i)) {
        throw new Error('Formato file non consentito per motivi di sicurezza.')
      }

      // Applica compressione se è un'immagine
      const compressedFile = await comprimiImmagine(file)

      // 1. Upload file su Storage
      const ext = compressedFile.name.split('.').pop().toLowerCase()
      const path = `${condominioId}/${Date.now()}_${compressedFile.name}`
      const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(path, compressedFile, { upsert: false })
      if (uploadError) throw uploadError

      // 2. Estrai testo se PDF o DOCX
      let testo_estratto = null
      if (ext === 'pdf') {
        testo_estratto = await estraiTestoPDF(compressedFile, condominioId)
      } else if (ext === 'docx') {
        try { testo_estratto = await docxToText(compressedFile) } catch (e) { console.error(e) }
      }

      // 3. Salva record su DB
      const { data, error: dbError } = await supabase
          .from('documenti_condominio')
          .insert({
            condominio_id: condominioId,
            tipo,
            nome: nome || compressedFile.name,
            url_storage: path,
            testo_estratto,
            note,
            data_documento: dataDocumento,
            sinistro_id: sinistroId,
          })
          .select()
          .single()
      if (dbError) throw dbError

      setDocumenti(prev => [data, ...prev])
      return data
    } catch (e) {
      setError(e.message)
      throw e
    } finally {
      setLoading(false)
    }
  }, [condominioId])

  const getSignedUrl = useCallback(async (urlStorage) => {
    if (!urlStorage) return null
    const now = Date.now()
    const cached = signedUrlCacheRef.current.get(urlStorage)
    if (cached && cached.expiresAt > now) {
      return cached.url
    }
    const { data } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(urlStorage, 15 * 60)
    if (data?.signedUrl) {
      signedUrlCacheRef.current.set(urlStorage, {
        url: data.signedUrl,
        expiresAt: now + 14 * 60 * 1000
      })
    }
    return data?.signedUrl
  }, [])

  const remove = useCallback(async (doc) => {
    setLoading(true)
    try {
      // Rimuovi da storage
      await supabase.storage.from(BUCKET).remove([doc.url_storage])
      // Rimuovi da DB
      const { error } = await supabase
        .from('documenti_condominio')
        .delete()
        .eq('id', doc.id)
      if (error) throw error
      setDocumenti(prev => prev.filter(d => d.id !== doc.id))
    } catch (e) {
      setError(e.message)
      throw e
    } finally {
      setLoading(false)
    }
  }, [])

  const aggiornaTesto = useCallback(async (id, testo_estratto) => {
    const { data, error } = await supabase
      .from('documenti_condominio')
      .update({ testo_estratto })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    setDocumenti(prev => prev.map(d => d.id === id ? data : d))
    return data
  }, [])

  return { documenti, loading, error, fetch, upload, remove, getSignedUrl, aggiornaTesto }
}

// Estrae testo da PDF usando FileReader + Gemini API
async function estraiTestoPDF(file, condominioId) {
  try {
    const base64 = await fileToBase64(file)
    const testo = await callGeminiDocument(
      'Estrai tutto il testo di questo documento in modo fedele e completo. Restituisci solo il testo estratto, senza commenti o formattazione aggiuntiva.',
      base64,
      {
        maxTokens: 4000,
        mediaType: 'application/pdf',
        funzione: 'estrai_testo_pdf',
        condominio_id: condominioId
      }
    )
    return testo || null
  } catch {
    return null
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result.split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
