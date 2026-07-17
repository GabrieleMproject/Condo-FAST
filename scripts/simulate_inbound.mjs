import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error("Manca .env o variabili d'ambiente")
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function runSimulation() {
  console.log("=== SIMULAZIONE INGESTIONE POSTBOX ===")

  // 1. Recupera il primo amministratore del sistema
  const { data: profiles, error: pErr } = await supabase
    .from('profiles')
    .select('id, studio_nome, inbound_email_prefix')
    .limit(1)

  if (pErr || !profiles || profiles.length === 0) {
    console.error("Errore recupero profili admin:", pErr)
    return
  }

  const admin = profiles[0]
  console.log(`Amministratore target: ${admin.studio_nome || 'Senza Nome'} (ID: ${admin.id})`)
  console.log(`Prefisso email attivo: ${admin.inbound_email_prefix}@inbox.condosmart.it`)

  // 2. Recupera il primo condominio associato all'amministratore
  const { data: condomini, error: cErr } = await supabase
    .from('condomini')
    .select('id, nome, codice_fiscale')
    .eq('amministratore_id', admin.id)
    .limit(1)

  if (cErr) {
    console.error("Errore recupero condomini:", cErr)
  }

  const condo = condomini?.[0]
  if (condo) {
    console.log(`Condominio abbinato per il test: ${condo.nome} (CF: ${condo.codice_fiscale || 'N/D'})`)
  } else {
    console.log("Nessun condominio trovato per questo amministratore. L'inserimento simulerà un documento da smistare.")
  }

  // 3. Simula l'inserimento di un documento inbox da email
  const tempPath = `test_inbox_${Date.now()}.pdf`
  const mockDatiEstratti = {
    fornitore: "Idraulica Express S.r.l.",
    partita_iva_fornitore: "12345678901",
    numero_fattura: "FE/2026/98",
    data_fattura: new Date().toISOString().split('T')[0],
    importo_totale: 280.50,
    importo_iva: 50.50,
    importo_netto: 230.00,
    descrizione: "Riparazione tubazione androne principale e sostituzione valvola",
    categoria: "manutenzione",
    condominio_destinatario_nome: condo ? condo.nome : "Condominio Primavera",
    condominio_destinatario_codice_fiscale: condo ? condo.codice_fiscale : "90012345678",
    note: "Bonifico a 30gg, IBAN IT99X00000000000000000001234"
  }

  console.log("Inserimento record di test in inbox_documenti...")
  
  const { data: newInbox, error: iErr } = await supabase
    .from('inbox_documenti')
    .insert({
      amministratore_id: admin.id,
      condominio_id: condo ? condo.id : null,
      file_path: `mock_files/${tempPath}`,
      file_name: "Fattura_IdraulicaExpress_98.pdf",
      email_mittente: "fatture@idraulicaexpress.it",
      email_oggetto: `Fattura n. 98 per lavori condominiali - ${condo ? condo.nome : 'Condo Primavera'}`,
      stato: "rilevato",
      dati_estratti: mockDatiEstratti
    })
    .select()
    .single()

  if (iErr) {
    console.error("Errore inserimento record di simulazione:", iErr)
  } else {
    console.log("=== SIMULAZIONE COMPLETATA CON SUCCESSO ===")
    console.log(`Inserito record ID: ${newInbox.id}`)
    console.log(`Stato: ${newInbox.stato}`)
    console.log("Ora puoi ricaricare l'app ed esaminare il widget Postbox in Dashboard!")
  }
}

runSimulation()
