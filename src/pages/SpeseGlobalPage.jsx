import { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import { estraiFattura, getTipoFile, estraiFileDaZip } from '../lib/fileExtractor'
import { parseFatturaXmlP7m } from '../lib/xmlFatturaParser'
import SpeseForm from '../components/SpeseForm'
import { toast } from 'react-hot-toast'
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Building2,
  ArrowRight,
  Clock,
  RefreshCw,
  X,
  Receipt,
  Eye,
  Sparkles
} from 'lucide-react'

// Helper per formattare la dimensione del file
const formatSize = (bytes) => {
  if (!bytes) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

const isUUID = (id) => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)

export default function SpeseGlobalPage() {
  const { user } = useAuth()
  const location = useLocation()
  const [condomini, setCondomini] = useState([])
  const [loadingCondomini, setLoadingCondomini] = useState(true)
  
  // Coda di elaborazione persistente (collegata al database public.inbox_documenti)
  const [queue, setQueue] = useState([])
  const [loadingQueue, setLoadingQueue] = useState(true)
  const [activeQueueId, setActiveQueueId] = useState(null)
  
  // Stati di processo
  const [processing, setProcessing] = useState(false)
  const [saving, setSaving] = useState(false)
  
  // Anteprima File
  const [activeFileUrl, setActiveFileUrl] = useState(null)
  const [loadingFileUrl, setLoadingFileUrl] = useState(false)
  const [isLargeScreen, setIsLargeScreen] = useState(window.innerWidth > 1024)
  const [showZoomModal, setShowZoomModal] = useState(false)

  // Resetta lo zoom al cambio di elemento
  useEffect(() => {
    setShowZoomModal(false)
  }, [activeQueueId])
  
  const fileInputRef = useRef()

  // Responsive listener
  useEffect(() => {
    const handleResize = () => setIsLargeScreen(window.innerWidth > 1024)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // 1. Carica i condomini dell'amministratore all'avvio
  useEffect(() => {
    const fetchCondomini = async () => {
      try {
        const { data, error } = await supabase
          .from('condomini')
          .select('*')
          .order('nome', { ascending: true })
        if (error) throw error
        setCondomini(data || [])
      } catch (err) {
        console.error('Errore caricamento condomini:', err)
      } finally {
        setLoadingCondomini(false)
      }
    }
    fetchCondomini()
  }, [])

  // Helper per recuperare i dettagli di un condominio selezionato
  const fetchCondominioDati = async (condoId) => {
    if (!condoId) return { tabelle: [], unita: [], documenti: [], esercizi: [] }
    try {
      const [resEsercizi, resUnita, resTabelle, resDocumenti] = await Promise.all([
        supabase.from('esercizi').select('*').eq('condominio_id', condoId).order('anno', { ascending: false }),
        supabase.from('unita').select('id, numero, scala, piano, tipo').eq('condominio_id', condoId),
        supabase.from('tabelle_millesimali').select('*, millesimi_unita(*)').eq('condominio_id', condoId),
        supabase.from('documenti_condominio').select('*').eq('condominio_id', condoId)
      ])
      return {
        esercizi: resEsercizi.data || [],
        unita: resUnita.data || [],
        tabelle: resTabelle.data || [],
        documenti: resDocumenti.data || []
      }
    } catch (err) {
      console.error('Errore caricamento dettagli condominio:', err)
      return { tabelle: [], unita: [], documenti: [], esercizi: [] }
    }
  }

  // Algoritmo di matching del condominio
  const matchCondominio = (datiEstratti, condominiList) => {
    if (!datiEstratti || !condominiList || condominiList.length === 0) return null

    // Confronto Codice Fiscale (sia numerico 11 cifre sia alfanumerico 16 caratteri)
    const rawCF = String(datiEstratti.condominio_destinatario_codice_fiscale || '').replace(/[\s.-]/g, '').toUpperCase()
    if (rawCF) {
      const trovatoCF = condominiList.find(c => {
        const cfCondo = String(c.codice_fiscale || '').replace(/[\s.-]/g, '').toUpperCase()
        if (!cfCondo) return false
        if (cfCondo === rawCF) return true
        const numCondo = cfCondo.replace(/\D/g, '')
        const numEstratto = rawCF.replace(/\D/g, '')
        return numCondo && numEstratto && numCondo === numEstratto
      })
      if (trovatoCF) return trovatoCF.id
    }

    // Matching fuzzy sul nome del condominio
    const nomeEstratto = String(datiEstratti.condominio_destinatario_nome || '').trim().toLowerCase()
    if (nomeEstratto && nomeEstratto.length > 3) {
      const paroleChiave = nomeEstratto
        .replace(/condominio/g, '')
        .split(/[\s,.-]+/)
        .filter(w => w.length > 2 && !['cond', 'condo', 'condominio', 'studio', 'amministrazione'].includes(w))
      
      if (paroleChiave.length > 0) {
        const trovatoNome = condominiList.find(c => {
          const nomeCondo = String(c.nome || '').toLowerCase()
          return paroleChiave.some(p => nomeCondo.includes(p))
        })
        if (trovatoNome) return trovatoNome.id
      }
    }

    // Matching sull'indirizzo
    const indirizzoEstratto = String(datiEstratti.condominio_destinatario_indirizzo || '').trim().toLowerCase()
    if (indirizzoEstratto && indirizzoEstratto.length > 5) {
      const trovatoInd = condominiList.find(c => {
        const indCondo = String(c.indirizzo || '').toLowerCase()
        return indCondo && (indirizzoEstratto.includes(indCondo) || indCondo.includes(indirizzoEstratto))
      })
      if (trovatoInd) return trovatoInd.id
    }

    return null
  }

  // 1b. Ascolta e gestisce file o fatture passate da GlobalDropzone o da altre pagine
  useEffect(() => {
    if (location.state?.extractedFattura) {
      const incoming = location.state.extractedFattura
      const tempId = 'incoming_' + Date.now()
      let matchedCondoId = matchCondominio(incoming, condomini)
      const isNuovo = !matchedCondoId
      if (!matchedCondoId) {
        matchedCondoId = '__NEW_CONDO__'
      }

      const nuovoDati = {
        nome: incoming?.condominio_destinatario_nome || 'Nuovo Condominio da Fattura',
        codice_fiscale: incoming?.condominio_destinatario_codice_fiscale || '',
        indirizzo: incoming?.condominio_destinatario_indirizzo || '',
        citta: incoming?.condominio_destinatario_citta || '',
        cap: incoming?.condominio_destinatario_cap || '',
        provincia: incoming?.condominio_destinatario_provincia || '',
      }
      
      fetchCondominioDati(matchedCondoId !== '__NEW_CONDO__' ? matchedCondoId : null).then(condoDati => {
        const aperto = condoDati.esercizi.find(e => e.stato === 'aperto') || condoDati.esercizi[0]
        const newItem = {
          id: tempId,
          file: null,
          file_path: null,
          file_name: incoming.fornitore ? `Fattura_${incoming.fornitore.replace(/\s+/g, '_')}.pdf` : 'Fattura_Estratta.pdf',
          status: 'ready',
          errorMsg: null,
          extractedData: incoming,
          condominioId: matchedCondoId,
          isNuovoCondominio: isNuovo,
          nuovoCondominioDati: nuovoDati,
          esercizioId: aperto?.id || null,
          esercizi: condoDati.esercizi,
          unita: condoDati.unita,
          tabelle: condoDati.tabelle,
          documenti: condoDati.documenti
        }
        setQueue(prev => [newItem, ...prev.filter(q => q.id !== tempId)])
        setActiveQueueId(tempId)
        toast.success(isNuovo ? 'Nuovo condominio rilevato dalla fattura' : 'Dati fattura precaricati nel modulo')
      })
    }
  }, [location.state, condomini])

  // 2. Caricamento Coda da Database (inbox_documenti in stato nuovo, rilevato, da_smistare)
  const fetchQueue = async () => {
    if (!user) return
    try {
      const { data, error } = await supabase
        .from('inbox_documenti')
        .select('*')
        .in('stato', ['nuovo', 'rilevato', 'da_smistare'])
        .order('data_ricezione', { ascending: false })
      
      if (error) {
        console.warn('Recupero inbox_documenti non riuscito o tabella assente:', error.message)
        return
      }

      // Raccogli condominio_id unici
      const uniqueCondoIds = [...new Set((data || []).map(doc => doc.condominio_id).filter(Boolean))]
      
      // Carica i dettagli per ciascuno una sola volta in parallelo (cache)
      const cacheMap = new Map()
      await Promise.all(uniqueCondoIds.map(async (cid) => {
        const d = await fetchCondominioDati(cid)
        cacheMap.set(cid, d)
      }))
      
      const mapped = (data || []).map((doc) => {
        // Recupera i dettagli dal cacheMap se già abbinato
        const condoDati = doc.condominio_id
          ? cacheMap.get(doc.condominio_id) || { esercizi: [], unita: [], tabelle: [], documenti: [] }
          : { esercizi: [], unita: [], tabelle: [], documenti: [] }

        const aperto = condoDati.esercizi.find(e => e.stato === 'aperto') || condoDati.esercizi[0]
        const selectedEsercizioId = aperto?.id || null
        
        return {
          id: doc.id,
          file: null, // Nessun File object locale se caricato da DB
          file_path: doc.file_path,
          file_name: doc.file_name,
          email_mittente: doc.email_mittente,
          email_oggetto: doc.email_oggetto,
          data_ricezione: doc.data_ricezione,
          status: doc.stato === 'nuovo' ? 'idle' : 'ready',
          errorMsg: null,
          extractedData: doc.dati_estratti,
          condominioId: doc.condominio_id,
          esercizioId: selectedEsercizioId,
          esercizi: condoDati.esercizi,
          unita: condoDati.unita,
          tabelle: condoDati.tabelle,
          documenti: condoDati.documenti
        }
      })
      
      setQueue(prev => {
        // Preserva sempre gli elementi non ancora salvati nel DB (local_ o incoming_)
        const localItems = prev.filter(item => !isUUID(item.id) || item.file != null)
        const dbIds = new Set(mapped.map(m => m.id))
        const unpersistedLocal = localItems.filter(item => !dbIds.has(item.id))
        const combined = [...unpersistedLocal, ...mapped]
        
        if (combined.length > 0 && !activeQueueId) {
          setActiveQueueId(combined[0].id)
        }
        return combined
      })
    } catch (err) {
      console.error('Errore recupero coda inbox:', err)
    } finally {
      setLoadingQueue(false)
    }
  }

  // 3. Inizializza Realtime Listener per la coda
  useEffect(() => {
    if (!user) return
    fetchQueue()
    
    const channel = supabase
      .channel('inbox_global_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'inbox_documenti'
      }, () => {
        fetchQueue()
      })
      .subscribe()
      
    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  // 4. Carica Signed URL del PDF quando cambia la fattura attiva
  const activeItem = queue.find(q => q.id === activeQueueId)

  useEffect(() => {
    if (!activeItem) {
      setActiveFileUrl(null)
      return
    }

    if (activeItem.file) {
      // Caricato localmente tramite drag & drop (non ancora nel DB)
      const objUrl = URL.createObjectURL(activeItem.file)
      setActiveFileUrl(objUrl)
      return () => {
        URL.revokeObjectURL(objUrl)
      }
    }

    if (activeItem.file_path) {
      // Caricato da Storage remoto
      let isMounted = true
      const getSignedUrl = async () => {
        setLoadingFileUrl(true)
        try {
          const { data, error } = await supabase.storage
            .from('inbox-ricezione')
            .createSignedUrl(activeItem.file_path, 900) // 15 minuti
          
          if (!error && data?.signedUrl && isMounted) {
            setActiveFileUrl(data.signedUrl)
          }
        } catch (err) {
          console.warn('Recupero Signed URL per anteprima non riuscito:', err)
        } finally {
          if (isMounted) setLoadingFileUrl(false)
        }
      }
      getSignedUrl()
      return () => { isMounted = false }
    }
  }, [activeQueueId, activeItem?.id, activeItem?.file, activeItem?.file_path])

  // 5. Caricamento File manuale e analisi AI (elaborazione locale immediata)
  const handleFilesAdded = async (fileList) => {
    const rawFiles = Array.from(fileList)
    if (rawFiles.length === 0) return

    setProcessing(true)
    try {
      const files = []
      for (const f of rawFiles) {
        const tipo = getTipoFile(f)
        if (tipo === 'zip') {
          const estratti = await estraiFileDaZip(f)
          files.push(...estratti)
        } else {
          files.push(f)
        }
      }

      if (queue.length + files.length > 20) {
        toast.error('La coda può contenere massimo 20 fatture contemporaneamente.')
      }

      const targetFiles = files.slice(0, Math.max(1, 20 - queue.length))

      for (const file of targetFiles) {
        const newDocId = 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5)

        // Aggiungi elemento alla coda locale come 'analyzing'
        const newItem = {
          id: newDocId,
          file,
          file_path: null,
          file_name: file.name,
          status: 'analyzing',
          errorMsg: null,
          extractedData: null,
          condominioId: null,
          esercizioId: null,
          esercizi: [],
          unita: [],
          tabelle: [],
          documenti: []
        }
        
        setQueue(prev => [newItem, ...prev.filter(q => q.id !== newDocId)])
        setActiveQueueId(newDocId)

        let estratto = null
        try {
          const tipoDoc = getTipoFile(file)
          if (tipoDoc === 'xml' || tipoDoc === 'p7m') {
            const resXml = await parseFatturaXmlP7m(file)
            estratto = resXml?.dati || resXml
          } else {
            estratto = await estraiFattura(file)
          }
        } catch (itemErr) {
          console.warn('[SpeseGlobalPage] Errore estrazione AI automatica, fallback su compilazione manuale:', itemErr)
          estratto = {
            fornitore: '',
            data_fattura: new Date().toISOString().split('T')[0],
            importo_totale: 0,
            descrizione: file.name.replace(/\.[^/.]+$/, ''),
            categoria: 'ordinaria'
          }
          toast.error(`Estrazione automatica non completata per ${file.name}. Puoi inserire i dati manualmente.`)
        }

        // Determina il miglior condominio candidato
        let targetCondoId = matchCondominio(estratto, condomini)
        const isNuovo = !targetCondoId
        if (!targetCondoId) {
          targetCondoId = '__NEW_CONDO__'
        }

        const nuovoCondoDati = {
          nome: estratto?.condominio_destinatario_nome || 'Nuovo Condominio da Fattura',
          codice_fiscale: estratto?.condominio_destinatario_codice_fiscale || '',
          indirizzo: estratto?.condominio_destinatario_indirizzo || '',
          citta: estratto?.condominio_destinatario_citta || '',
          cap: estratto?.condominio_destinatario_cap || '',
          provincia: estratto?.condominio_destinatario_provincia || '',
        }

        let condoDati = { esercizi: [], unita: [], tabelle: [], documenti: [] }
        let selectedEsercizioId = null
        
        if (targetCondoId && targetCondoId !== '__NEW_CONDO__') {
          try {
            condoDati = await fetchCondominioDati(targetCondoId)
            const aperto = condoDati.esercizi.find(e => e.stato === 'aperto') || condoDati.esercizi[0]
            selectedEsercizioId = aperto?.id || null
          } catch (cErr) {
            console.error('Errore recupero dati condominio:', cErr)
          }
        }

        // Aggiorna coda locale a 'ready'
        setQueue(prev => prev.map(item => {
          if (item.id === newDocId) {
            return {
              ...item,
              status: 'ready',
              extractedData: estratto,
              condominioId: targetCondoId,
              isNuovoCondominio: isNuovo,
              nuovoCondominioDati: nuovoCondoDati,
              esercizioId: selectedEsercizioId,
              esercizi: condoDati.esercizi,
              unita: condoDati.unita,
              tabelle: condoDati.tabelle,
              documenti: condoDati.documenti
            }
          }
          return item
        }))
        setActiveQueueId(newDocId)
      }
    } catch (err) {
      console.error('Errore caricamento o estrazione AI:', err)
      toast.error('Impossibile elaborare il file: ' + err.message)
    } finally {
      setProcessing(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files) handleFilesAdded(e.dataTransfer.files)
  }

  const handleFileInput = (e) => {
    if (e.target.files) handleFilesAdded(e.target.files)
  }

  const [dragOver, setDragOver] = useState(false)

  // 6. Cambiamento condominio o esercizio
  const handleCondominioChange = async (itemId, condoId) => {
    setQueue(prev => prev.map(item => item.id === itemId ? { ...item, status: 'updating_data' } : item))
    
    if (condoId === '__NEW_CONDO__') {
      setQueue(prev => prev.map(item => {
        if (item.id === itemId) {
          return {
            ...item,
            status: 'ready',
            condominioId: '__NEW_CONDO__',
            isNuovoCondominio: true,
            esercizioId: null,
            esercizi: [],
            unita: [],
            tabelle: [],
            documenti: []
          }
        }
        return item
      }))
      return
    }

    const condoDati = await fetchCondominioDati(condoId)
    const aperto = condoDati.esercizi.find(e => e.stato === 'aperto') || condoDati.esercizi[0]

    setQueue(prev => prev.map(item => {
      if (item.id === itemId) {
        return {
          ...item,
          status: 'ready',
          condominioId: condoId,
          isNuovoCondominio: false,
          esercizioId: aperto?.id || null,
          esercizi: condoDati.esercizi,
          unita: condoDati.unita,
          tabelle: condoDati.tabelle,
          documenti: condoDati.documenti
        }
      }
      return item
    }))

    // Salva la preferenza di condominio sul DB se presente
    if (itemId && isUUID(itemId)) {
      await supabase
        .from('inbox_documenti')
        .update({ condominio_id: (condoId && condoId !== '__NEW_CONDO__') ? condoId : null })
        .eq('id', itemId)
    }
  }

  const handleEsercizioChange = (itemId, esId) => {
    setQueue(prev => prev.map(item => {
      if (item.id === itemId) {
        return { ...item, esercizioId: esId }
      }
      return item
    }))
  }

  // 7. Scarta e rimuovi dalla Postbox (cancella file e imposta stato scartato)
  const rimuoviDallaCoda = async (itemId, e) => {
    e.stopPropagation()
    const item = queue.find(q => q.id === itemId)
    if (!item) return

    if (!confirm('Sei sicuro di voler eliminare questo documento dalla Postbox?')) return

    try {
      // Elimina il file da storage se presente
      if (item.file_path) {
        supabase.storage.from('inbox-ricezione').remove([item.file_path]).catch(() => {})
      }

      // Imposta stato scartato sul database (soft delete) se presente su DB
      if (itemId && isUUID(itemId)) {
        await supabase
          .from('inbox_documenti')
          .update({ stato: 'scartato' })
          .eq('id', itemId)
      }

      setQueue(prev => prev.filter(q => q.id !== itemId))
      if (activeQueueId === itemId) {
        setActiveQueueId(null)
      }
    } catch (err) {
      console.error('Errore rimozione documento:', err)
    }
  }

  // 8. Salvataggio ed Inserimento Spesa + Fattura
  const handleSaveSpesaGlobale = async (itemId, payload, ripartizioni, fileCaricato, aiDatiEstratti, nuovoCondoInfo) => {
    const item = queue.find(q => q.id === itemId)
    if (!item) return

    setSaving(true)
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser()

      let finalCondominioId = item.condominioId
      let finalEsercizioId = item.esercizioId
      let isNewCondoCreated = false
      let createdCondoName = ''

      // Se si tratta di un nuovo condominio non censito
      if (finalCondominioId === '__NEW_CONDO__' || !finalCondominioId || nuovoCondoInfo) {
        const condoNome = (nuovoCondoInfo?.nome || item.nuovoCondominioDati?.nome || item.extractedData?.condominio_destinatario_nome || 'Nuovo Condominio da Fattura').trim()
        const condoCf = (nuovoCondoInfo?.codice_fiscale || item.nuovoCondominioDati?.codice_fiscale || item.extractedData?.condominio_destinatario_codice_fiscale || '').trim() || null
        const condoIndirizzo = (nuovoCondoInfo?.indirizzo || item.nuovoCondominioDati?.indirizzo || item.extractedData?.condominio_destinatario_indirizzo || '').trim() || null
        const condoCitta = (nuovoCondoInfo?.citta || item.nuovoCondominioDati?.citta || item.extractedData?.condominio_destinatario_citta || '').trim() || null
        const condoCap = (nuovoCondoInfo?.cap || item.nuovoCondominioDati?.cap || item.extractedData?.condominio_destinatario_cap || '').trim() || null
        const condoProvincia = (nuovoCondoInfo?.provincia || item.nuovoCondominioDati?.provincia || item.extractedData?.condominio_destinatario_provincia || '').trim() || null

        // 1. Inserisci il nuovo record in condomini
        const { data: newCondo, error: condoErr } = await supabase
          .from('condomini')
          .insert([{
            nome: condoNome,
            codice_fiscale: condoCf,
            indirizzo: condoIndirizzo,
            citta: condoCitta,
            cap: condoCap,
            provincia: condoProvincia,
            amministratore_id: currentUser.id,
            user_id: currentUser.id,
            stato: 'attivo'
          }])
          .select()
          .single()

        if (condoErr) throw new Error(`Creazione condominio non riuscita: ${condoErr.message}`)
        
        finalCondominioId = newCondo.id
        createdCondoName = newCondo.nome
        isNewCondoCreated = true

        // 2. Crea l'esercizio contabile per il condominio (anno della spesa o anno corrente)
        const annoSpesa = new Date(payload.data_spesa || Date.now()).getFullYear() || new Date().getFullYear()
        const { data: newEs, error: esErr } = await supabase
          .from('esercizi')
          .insert([{
            condominio_id: newCondo.id,
            anno: annoSpesa,
            data_inizio: `${annoSpesa}-01-01`,
            data_fine: `${annoSpesa}-12-31`,
            stato: 'aperto',
            tipo: 'ordinario'
          }])
          .select()
          .single()

        if (!esErr && newEs) {
          finalEsercizioId = newEs.id
        }

        // 3. Crea la tabella millesimale generale di default
        try {
          await supabase
            .from('tabelle_millesimali')
            .insert([{
              condominio_id: newCondo.id,
              nome: 'Tabella Generale (Proprietà)',
              tipo_lavoro: 'generale',
              descrizione: 'Tabella generale predefinita generata automaticamente'
            }])
        } catch (e) {
          console.warn('[SpeseGlobalPage] Creazione tabella default bypassata:', e)
        }

        // 4. Aggiorna l'elenco condomini in stato globale
        setCondomini(prev => [...prev, newCondo].sort((a, b) => a.nome.localeCompare(b.nome)))
      }

      // a. Crea spesa condominiale
      const { data: nuovaSpesa, error: spesaErr } = await supabase
        .from('spese')
        .insert([{
          condominio_id: finalCondominioId,
          esercizio_id: finalEsercizioId,
          descrizione: payload.descrizione,
          importo: payload.importo,
          data_spesa: payload.data_spesa,
          categoria: payload.categoria,
          tipo_lavoro: payload.tipo_lavoro,
          criterio: payload.criterio,
          tabella_millesimale_id: payload.tabella_millesimale_id || null,
          percentuale_millesimi: payload.percentuale_millesimi,
          fornitore: payload.fornitore,
          numero_fattura: payload.numero_fattura,
          note: payload.note,
          suggerimento_ai: payload.suggerimento_ai,
          criterio_override: payload.criterio_override
        }])
        .select()
        .single()
        
      if (spesaErr) throw spesaErr
      const spesaId = nuovaSpesa.id

      // b. Registra ripartizioni (se presenti)
      if (ripartizioni && ripartizioni.length > 0) {
        const righeRipartizioni = ripartizioni.map(r => ({
          spesa_id: spesaId,
          unita_id: r.unita_id,
          importo: r.importo,
          millesimi_usati: r.millesimi_usati || null,
          override_manuale: r.override_manuale || false,
          importo_override: r.importo_override || null
        }))

        const { error: ripErr } = await supabase.from('ripartizioni').insert(righeRipartizioni)
        if (ripErr) console.warn('[SpeseGlobalPage] Inserimento ripartizioni non riuscito:', ripErr.message)
      }

      // c. Gestione file e fattura fornitore
      let newPath = null
      const rawFileToUpload = fileCaricato || item.file
      if (rawFileToUpload) {
        try {
          newPath = `${currentUser.id}/${finalCondominioId}/${Date.now()}_${(item.file_name || rawFileToUpload.name).replace(/\s+/g, '_')}`
          const { error: uploadErr } = await supabase.storage
            .from('fatture')
            .upload(newPath, rawFileToUpload, { contentType: rawFileToUpload.type || 'application/octet-stream' })
          if (uploadErr) {
            console.warn('[SpeseGlobalPage] Salvataggio storage fattura non riuscito:', uploadErr.message)
            newPath = null
          }
        } catch (sErr) {
          console.warn('[SpeseGlobalPage] Upload fattura bypassed:', sErr)
          newPath = null
        }
      } else if (item.file_path) {
        try {
          const { data: fileData, error: downloadErr } = await supabase.storage
            .from('inbox-ricezione')
            .download(item.file_path)

          if (!downloadErr && fileData) {
            newPath = `${currentUser.id}/${finalCondominioId}/${Date.now()}_${item.file_name.replace(/\s+/g, '_')}`
            await supabase.storage
              .from('fatture')
              .upload(newPath, fileData, { contentType: fileData.type })
            
            supabase.storage.from('inbox-ricezione').remove([item.file_path]).catch(() => {})
          }
        } catch (sErr) {
          console.warn('[SpeseGlobalPage] Spostamento storage bypassed:', sErr)
        }
      }

      // Cerca fornitore_id
      let fornitoreId = null
      try {
        const { data: fornitoriList } = await supabase
          .from('fornitori')
          .select('id, ragione_sociale, partita_iva, codice_fiscale')
        
        if (fornitoriList && fornitoriList.length > 0) {
          const pIvaClean = (aiDatiEstratti?.partita_iva_fornitore || '').replace(/\s+/g, '')
          if (pIvaClean) {
            const trovato = fornitoriList.find(f => f.partita_iva === pIvaClean || f.codice_fiscale === pIvaClean)
            if (trovato) fornitoreId = trovato.id
          } else {
            const nomeClean = (payload.fornitore || '').trim().toLowerCase()
            const trovato = fornitoriList.find(f => f.ragione_sociale.toLowerCase() === nomeClean)
            if (trovato) fornitoreId = trovato.id
          }
        }
      } catch (fornErr) {
        console.error('Errore ricerca fornitore:', fornErr)
      }

      // Crea il record in fatture_fornitori
      const datiFattura = {
        condominio_id: finalCondominioId,
        user_id: currentUser.id,
        spesa_id: spesaId,
        fornitore: payload.fornitore || 'Fornitore sconosciuto',
        fornitore_id: fornitoreId,
        numero_fattura: payload.numero_fattura || null,
        data_fattura: payload.data_spesa,
        data_scadenza: aiDatiEstratti?.data_scadenza || payload.data_spesa,
        importo_totale: payload.importo,
        importo_iva: aiDatiEstratti?.importo_iva || 0,
        importo_netto: aiDatiEstratti?.importo_netto || (payload.importo - (aiDatiEstratti?.importo_iva || 0)),
        descrizione: payload.descrizione || '',
        categoria: payload.categoria || 'altro',
        stato: 'attesa',
        pdf_url: newPath,
        ai_dati_estratti: aiDatiEstratti,
        ritenuta_acconto: aiDatiEstratti?.importo_ritenuta || 0.00
      }

      const { error: invoiceErr } = await supabase.from('fatture_fornitori').insert(datiFattura)
      if (invoiceErr) console.warn('[SpeseGlobalPage] Inserimento fatture_fornitori non riuscito:', invoiceErr.message)

      // d. Aggiorna record inbox_documenti a 'inserito' se presente
      if (itemId && isUUID(itemId)) {
        await supabase
          .from('inbox_documenti')
          .update({ stato: 'inserito', spesa_id: spesaId, condominio_id: finalCondominioId })
          .eq('id', itemId)
      }

      // Rimuovi dalla coda locale ed imposta il successivo
      setQueue(prev => prev.filter(q => q.id !== itemId))
      
      const rinvioPronta = queue.find(q => q.id !== itemId && q.status === 'ready')
      if (rinvioPronta) {
        setActiveQueueId(rinvioPronta.id)
      } else {
        setActiveQueueId(null)
      }
      
      if (isNewCondoCreated) {
        toast.success(`✨ Condominio "${createdCondoName}" creato con successo e spesa registrata!`)
      } else {
        toast.success('Spesa e fattura registrate correttamente!')
      }
    } catch (err) {
      console.error('Errore durante il salvataggio:', err)
      toast.error('Errore durante il salvataggio: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 1600, margin: '0 auto', fontFamily: 'Sora, sans-serif' }}>
      
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: '0 0 6px', color: 'var(--text-primary)', fontSize: 24, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Receipt size={28} style={{ color: '#7c3aed' }} /> Postbox & Inserimento Rapido Spese (AI)
        </h1>
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 14 }}>
          Tutte le fatture ricevute via email o caricate manualmente appaiono qui. L'intelligenza artificiale estrae i dati contabili ed abbina il condominio.
        </p>
      </div>

      {/* Main Container */}
      <div style={{ display: 'grid', gridTemplateColumns: isLargeScreen ? '280px 1fr' : '1fr', gap: 24, alignItems: 'start' }}>
        
        {/* LATO SINISTRO: Coda ed Inbound */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          
          {/* Dropzone manuale */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => !processing && fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? '#7c3aed' : 'var(--border-color)'}`,
              borderRadius: 12,
              padding: '24px 16px',
              textAlign: 'center',
              cursor: processing ? 'not-allowed' : 'pointer',
              background: dragOver ? 'rgba(124,58,237,0.05)' : 'var(--card-bg)',
              color: 'var(--text-secondary)',
              transition: 'all 0.2s',
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx,.xls,.csv,.txt,.xml,.p7m,.zip"
              style={{ display: 'none' }}
              onChange={handleFileInput}
            />
            {processing ? (
              <div>
                <Loader2 size={32} style={{ margin: '0 auto 10px', color: '#7c3aed', animation: 'spin 1s linear infinite' }} />
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Elaborazione e decompressione file...</div>
              </div>
            ) : (
              <>
                <UploadCloud size={32} style={{ margin: '0 auto 10px', color: 'var(--text-muted)' }} />
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                  Trascina qui le fatture o pacchetti ZIP
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  ZIP (Cassetto Fiscale AdE), XML SDI, p7m, PDF, DOCX, immagini o Excel
                </div>
              </>
            )}
          </div>

          {/* Coda Postbox */}
          <div style={{ background: 'var(--card-bg)', borderRadius: 12, border: '1px solid var(--border-color)', padding: 16 }}>
            <h3 style={{ margin: '0 0 14px', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Documenti in Postbox</span>
              <span style={{ fontSize: 11, background: 'var(--app-bg)', padding: '2px 8px', borderRadius: 10, color: 'var(--text-muted)' }}>
                {queue.length} pendenti
              </span>
            </h3>

            {loadingQueue ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                Caricamento Postbox...
              </div>
            ) : queue.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                Cassetta postale vuota! Ottimo lavoro.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '60vh', overflowY: 'auto', paddingRight: 4 }}>
                {queue.map((item) => {
                  const isActive = item.id === activeQueueId
                  const matchedCondo = condomini.find(c => c.id === item.condominioId)
                  
                  return (
                    <div
                      key={item.id}
                      onClick={() => item.status !== 'analyzing' && setActiveQueueId(item.id)}
                      style={{
                        padding: 12,
                        borderRadius: 8,
                        background: isActive ? 'rgba(124,58,237,0.04)' : 'var(--app-bg)',
                        border: `1px solid ${isActive ? '#7c3aed' : 'var(--border-color)'}`,
                        cursor: item.status === 'analyzing' ? 'not-allowed' : 'pointer',
                        transition: 'all 0.15s',
                        position: 'relative'
                      }}
                    >
                      {/* Tasto scarta */}
                      <button
                        onClick={(e) => rimuoviDallaCoda(item.id, e)}
                        style={{
                          position: 'absolute', top: 8, right: 8, background: 'transparent',
                          border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
                          padding: 2, borderRadius: '50%'
                        }}
                        title="Scarta"
                      >
                        <X size={14} />
                      </button>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, paddingRight: 20 }}>
                        <FileText size={16} style={{ color: '#7c3aed', flexShrink: 0 }} />
                        <span style={{
                          color: 'var(--text-primary)', fontSize: 12, fontWeight: 600,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                        }} title={item.file_name}>
                          {item.file_name}
                        </span>
                      </div>

                      {/* Info Mittente Email */}
                      {item.email_mittente && (
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          Da: {item.email_mittente}
                        </div>
                      )}

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
                          {item.data_ricezione ? new Date(item.data_ricezione).toLocaleDateString('it-IT') : 'Adesso'}
                        </span>
                        
                        {/* Stati */}
                        {item.status === 'idle' && (
                          <span style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Clock size={11} /> Da analizzare
                          </span>
                        )}
                        {item.status === 'analyzing' && (
                          <span style={{ fontSize: 10, color: '#3b82f6', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> Analisi AI...
                          </span>
                        )}
                        {item.status === 'ready' && (
                          <span style={{ fontSize: 10, color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <CheckCircle2 size={11} /> Pronto
                          </span>
                        )}
                        {item.status === 'updating_data' && (
                          <span style={{ fontSize: 10, color: '#3b82f6', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> Caricamento...
                          </span>
                        )}
                        {item.status === 'error' && (
                          <span style={{ fontSize: 10, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <AlertTriangle size={11} /> Errore
                          </span>
                        )}
                      </div>

                      {/* Condominio Abbinato */}
                      {matchedCondo && (
                        <div style={{
                          marginTop: 6, fontSize: 10, background: 'rgba(16,185,129,0.06)',
                          color: '#10b981', borderRadius: 4, padding: '2px 6px',
                          display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                        }}>
                          <Building2 size={10} />
                          <span>Abbinato: {matchedCondo.nome}</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* LATO DESTRO: Anteprima Split Screen (PDF + SpeseForm) */}
        <div style={{ background: 'var(--card-bg)', borderRadius: 14, border: '1px solid var(--border-color)', padding: 24, minHeight: '600px' }}>
          
          {!activeItem ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '500px', color: 'var(--text-muted)' }}>
              <Receipt size={48} style={{ color: 'var(--border-color)', marginBottom: 16 }} />
              <h3 style={{ margin: '0 0 6px', color: 'var(--text-secondary)', fontSize: 16, fontWeight: 600 }}>Nessun documento selezionato</h3>
              <p style={{ margin: 0, fontSize: 13 }}>Seleziona una fattura in Postbox dalla lista a sinistra per procedere con la ripartizione.</p>
            </div>
          ) : activeItem.status === 'analyzing' ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '500px', color: 'var(--text-muted)' }}>
              <Loader2 size={36} style={{ animation: 'spin 1s linear infinite', color: '#7c3aed', marginBottom: 12 }} />
              <h3 style={{ margin: '0 0 6px', color: 'var(--text-secondary)', fontSize: 16, fontWeight: 600 }}>Lettura documento con AI...</h3>
              <p style={{ margin: 0, fontSize: 13 }}>Google Gemini sta estraendo i dati contabili ed il condominio di destinazione.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              
              {/* Compact Preview Card */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'var(--app-bg)',
                border: '1px solid var(--border-color)',
                borderRadius: 12,
                padding: '12px 18px',
                marginBottom: 20
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, overflow: 'hidden' }}>
                  <div style={{
                    width: 52,
                    height: 52,
                    background: 'var(--card-bg)',
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    border: '1px solid var(--border-color)',
                    flexShrink: 0
                  }}>
                    {(() => {
                      const filename = activeItem.file_name || activeItem.file?.name || ''
                      const ext = filename.split('.').pop()?.toLowerCase() || ''
                      if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext) && activeFileUrl) {
                        return <img src={activeFileUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      }
                      return <FileText size={22} style={{ color: '#7c3aed' }} />
                    })()}
                  </div>
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={activeItem.file_name}>
                      {activeItem.file_name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      {activeItem.email_mittente ? `Inviato da: ${activeItem.email_mittente}` : 'Caricato manualmente'}
                    </div>
                  </div>
                </div>
                
                <button
                  onClick={() => setShowZoomModal(true)}
                  disabled={loadingFileUrl || !activeFileUrl}
                  style={{
                    background: 'rgba(124, 58, 237, 0.08)',
                    border: '1px solid rgba(124, 58, 237, 0.2)',
                    borderRadius: 8,
                    padding: '8px 16px',
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#7c3aed',
                    cursor: (loadingFileUrl || !activeFileUrl) ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'all 0.15s',
                    opacity: (loadingFileUrl || !activeFileUrl) ? 0.6 : 1
                  }}
                >
                  {loadingFileUrl ? (
                    <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                  ) : (
                    <Eye size={14} />
                  )}
                  Visualizza Documento
                </button>
              </div>

              {/* Info Email Context */}
              {activeItem.email_oggetto && (
                <div style={{
                  background: 'var(--app-bg)', border: '1px solid var(--border-color)',
                  borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 12
                }}>
                  <span style={{ color: 'var(--text-muted)' }}>Email Oggetto:</span> <strong style={{ color: 'var(--text-primary)' }}>{activeItem.email_oggetto}</strong>
                </div>
              )}

              {/* Selezione e abbinamento Condominio / Esercizio */}
              <div style={{
                background: 'var(--app-bg)', border: '1px solid var(--border-color)', borderRadius: 12,
                padding: 16, marginBottom: 20, display: 'grid', gridTemplateColumns: isLargeScreen ? '1fr 1fr' : '1fr', gap: 16
              }}>
                <div>
                  <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: 12, marginBottom: 6, fontWeight: 600 }}>
                    Condominio Destinatario
                  </label>
                  <select
                    value={activeItem.condominioId || '__NEW_CONDO__'}
                    disabled={saving}
                    onChange={(e) => handleCondominioChange(activeItem.id, e.target.value)}
                    style={{
                      width: '100%', background: 'var(--card-bg)', color: 'var(--text-primary)',
                      border: '1px solid var(--border-color)', borderRadius: 8, padding: '8px 10px',
                      fontSize: 13, fontFamily: 'Sora, sans-serif',
                      opacity: saving ? 0.6 : 1
                    }}
                  >
                    <option value="__NEW_CONDO__">
                      ✨ [Nuovo Condominio] {activeItem.nuovoCondominioDati?.nome || activeItem.extractedData?.condominio_destinatario_nome || 'Crea da dati fattura'}
                    </option>
                    <optgroup label="Condomini Esistenti">
                      {condomini.map(c => (
                        <option key={c.id} value={c.id}>{c.nome}</option>
                      ))}
                    </optgroup>
                  </select>
                  {(!activeItem.condominioId || activeItem.condominioId === '__NEW_CONDO__') && (
                    <div style={{ color: '#7c3aed', fontSize: 11, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                      <Sparkles size={11} /> Nuovo condominio non censito: verrà creato automaticamente.
                    </div>
                  )}
                  {activeItem.condominioId && activeItem.condominioId !== '__NEW_CONDO__' && !activeItem.extractedData?.condominio_destinatario_nome && (
                    <div style={{ color: 'var(--text-muted)', fontSize: 10, marginTop: 4 }}>
                      Condominio non rilevato in fattura, abbinamento manuale.
                    </div>
                  )}
                  {activeItem.condominioId && activeItem.condominioId !== '__NEW_CONDO__' && activeItem.extractedData?.condominio_destinatario_nome && (
                    <div style={{ color: '#10b981', fontSize: 10, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <CheckCircle2 size={10} /> Rilevato in fattura: "{activeItem.extractedData.condominio_destinatario_nome}"
                    </div>
                  )}
                </div>

                <div>
                  <label style={{ display: 'block', color: 'var(--text-secondary)', fontSize: 12, marginBottom: 6, fontWeight: 600 }}>
                    Esercizio Contabile
                  </label>
                  <select
                    value={activeItem.esercizioId || ''}
                    onChange={(e) => handleEsercizioChange(activeItem.id, e.target.value)}
                    disabled={saving || !activeItem.condominioId || activeItem.condominioId === '__NEW_CONDO__' || activeItem.esercizi.length === 0}
                    style={{
                      width: '100%', background: 'var(--card-bg)', color: 'var(--text-primary)',
                      border: '1px solid var(--border-color)', borderRadius: 8, padding: '8px 10px',
                      fontSize: 13, fontFamily: 'Sora, sans-serif',
                      opacity: (saving || !activeItem.condominioId || activeItem.condominioId === '__NEW_CONDO__' || activeItem.esercizi.length === 0) ? 0.6 : 1
                    }}
                  >
                    {(!activeItem.condominioId || activeItem.condominioId === '__NEW_CONDO__') ? (
                      <option value="">Creazione automatica esercizio corrente</option>
                    ) : activeItem.esercizi.length === 0 ? (
                      <option value="">Nessun esercizio presente</option>
                    ) : (
                      activeItem.esercizi.map(es => (
                        <option key={es.id} value={es.id}>
                          {es.anno} {es.tipo === 'straordinario' ? 'straordinaria' : 'ordinaria'} ({es.stato})
                        </option>
                      ))
                    )}
                  </select>
                  {activeItem.condominioId && activeItem.condominioId !== '__NEW_CONDO__' && activeItem.esercizi.length === 0 && (
                    <div style={{ color: '#ef4444', fontSize: 11, marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <AlertTriangle size={10} /> Configura almeno un esercizio in contabilità per questo condominio.
                    </div>
                  )}
                </div>
              </div>

              {/* Form Dettaglio Spese */}
              {activeItem.condominioId === '__NEW_CONDO__' || !activeItem.condominioId || (activeItem.condominioId && activeItem.esercizioId) ? (
                <SpeseForm
                  key={`${activeItem.id}_${activeItem.condominioId || 'new'}_${activeItem.esercizioId || 'new'}`}
                  esercizioId={activeItem.esercizioId}
                  condominioId={activeItem.condominioId !== '__NEW_CONDO__' ? activeItem.condominioId : null}
                  tabelle={activeItem.tabelle || []}
                  unita={activeItem.unita || []}
                  documenti={activeItem.documenti || []}
                  fromFattura={true}
                  isNuovoCondominio={activeItem.condominioId === '__NEW_CONDO__' || !activeItem.condominioId || activeItem.isNuovoCondominio}
                  nuovoCondominioDati={activeItem.nuovoCondominioDati || {
                    nome: activeItem.extractedData?.condominio_destinatario_nome || 'Nuovo Condominio da Fattura',
                    codice_fiscale: activeItem.extractedData?.condominio_destinatario_codice_fiscale || '',
                    indirizzo: activeItem.extractedData?.condominio_destinatario_indirizzo || '',
                    citta: activeItem.extractedData?.condominio_destinatario_citta || '',
                    cap: activeItem.extractedData?.condominio_destinatario_cap || '',
                    provincia: activeItem.extractedData?.condominio_destinatario_provincia || '',
                  }}
                  onNuovoCondominioChange={(updated) => {
                    setQueue(prev => prev.map(q => q.id === activeItem.id ? { ...q, nuovoCondominioDati: updated } : q))
                  }}
                  prefillData={null}
                  initialFile={activeItem.file || null}
                  initialAiDatiEstratti={activeItem.extractedData}
                  onSave={(payload, ripartizioni, file, ai, nuovoCondo) => handleSaveSpesaGlobale(activeItem.id, payload, ripartizioni, file, ai, nuovoCondo)}
                  onCancel={() => setActiveQueueId(null)}
                />
              ) : (
                <div style={{ border: '2px dashed var(--border-color)', borderRadius: 12, padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>
                  <Building2 size={36} style={{ margin: '0 auto 12px', color: 'var(--border-color)' }} />
                  <p style={{ margin: 0, fontSize: 13 }}>Seleziona condominio ed esercizio per calcolare la griglia di ripartizione.</p>
                </div>
              )}

              {/* Modal Zoom del Documento */}
              {showZoomModal && (
                <div style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  width: '100vw',
                  height: '100vh',
                  background: 'rgba(0, 0, 0, 0.65)',
                  backdropFilter: 'blur(6px)',
                  zIndex: 9999,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <div style={{
                    background: 'var(--card-bg)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 16,
                    width: '90%',
                    maxWidth: '1100px',
                    height: '88vh',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                  }}>
                    {/* Header Modale */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '16px 24px',
                      borderBottom: '1px solid var(--border-color)',
                      background: 'var(--app-bg)'
                    }}>
                      <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <FileText size={18} style={{ color: '#7c3aed' }} /> {activeItem.file_name}
                      </h4>
                      <button
                        onClick={() => setShowZoomModal(false)}
                        style={{
                          background: 'var(--border-color)',
                          border: 'none',
                          borderRadius: '50%',
                          width: 32,
                          height: 32,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--text-primary)',
                          cursor: 'pointer',
                          transition: 'background-color 0.15s'
                        }}
                      >
                        <X size={16} />
                      </button>
                    </div>
                    
                    {/* Contenuto Modale (Preview) */}
                    <div style={{ flex: 1, background: 'var(--app-bg)', position: 'relative' }}>
                      {activeFileUrl ? (
                        (() => {
                          const filename = activeItem.file_name || activeItem.file?.name || ''
                          const ext = filename.split('.').pop()?.toLowerCase() || ''
                          if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) {
                            return (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 24 }}>
                                <img
                                  src={activeFileUrl}
                                  style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8 }}
                                  alt="Documento Zoom"
                                />
                              </div>
                            )
                          }
                          if (ext === 'pdf') {
                            return (
                              <iframe
                                src={activeFileUrl}
                                style={{ width: '100%', height: '100%', border: 'none' }}
                                title="Documento PDF Zoom"
                              />
                            )
                          }
                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 32, textAlign: 'center', color: '#cbd5e1' }}>
                              <FileText size={48} style={{ color: '#64748b', marginBottom: 16 }} />
                              <h4 style={{ margin: '0 0 8px', fontWeight: 600 }}>Visualizzazione diretta non supportata</h4>
                              <p style={{ margin: '0 0 16px', fontSize: 13, color: '#94a3b8' }}>
                                Il file non può essere visualizzato direttamente.
                              </p>
                              <a
                                href={activeFileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  background: '#7c3aed',
                                  color: '#fff',
                                  textDecoration: 'none',
                                  borderRadius: 8,
                                  padding: '10px 20px',
                                  fontSize: 13,
                                  fontWeight: 600
                                }}
                              >
                                Scarica File
                              </a>
                            </div>
                          )
                        })()
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8' }}>
                          Anteprima non caricata
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

      </div>

    </div>
  )
}
