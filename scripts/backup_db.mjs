import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createClient } from '@supabase/supabase-js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('[BACKUP DB] Errore: Variabili SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (o ANON_KEY) non trovate nel contesto.')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// Elenco tabelle fondamentali per il backup strutturato di emergenza
const CORE_TABLES = [
  'condomini',
  'unita',
  'persone',
  'occupanti_unita',
  'tabelle_millesimali',
  'millesimi_unita',
  'esercizi',
  'preventivo_voci',
  'spese',
  'spese_ripartizione',
  'rate',
  'movimenti_bancari',
  'fatture_fornitori',
  'comunicazioni',
  'documenti_condominio',
  'tickets_assistenza',
]

async function runStructuredBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupDir = path.join(__dirname, '../sql/backups')
  
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true })
  }

  const backupPath = path.join(backupDir, `backup_snapshot_${timestamp}.json`)
  const summaryReport = {
    timestamp: new Date().toISOString(),
    tablesCount: {},
    status: 'SUCCESS',
    details: {}
  }

  console.log(`[BACKUP DB] Avvio estrazione snapshot strutturato del database a ${summaryReport.timestamp}...`)

  for (const rawTable of CORE_TABLES) {
    const table = rawTable.trim()
    try {
      const { data, count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact' })

      if (error) {
        console.warn(`[BACKUP DB] Tabella '${table}': non accessibile o vuota (${error.message})`)
        summaryReport.tablesCount[table] = { status: 'ERROR', error: error.message }
      } else {
        const recordCount = data ? data.length : 0
        summaryReport.tablesCount[table] = { status: 'OK', records: recordCount }
        // Salva metadati strutturati per il ripristino di emergenza
        summaryReport.details[table] = data || []
      }
    } catch (err) {
      console.error(`[BACKUP DB] Errore inaspettato durante il backup della tabella '${table}':`, err.message)
      summaryReport.tablesCount[table] = { status: 'CRITICAL_ERROR', error: err.message }
    }
  }

  // Scrittura sicura su file (dati minimizzati nei log, file salvato in sql/backups/)
  fs.writeFileSync(backupPath, JSON.stringify(summaryReport, null, 2), 'utf-8')
  
  console.log(`[BACKUP DB] ✅ Snapshot completato con successo!`)
  console.log(`[BACKUP DB] Documento salvato in: ${backupPath}`)
  console.log(`[BACKUP DB] Riepilogo record esportati:`, JSON.stringify(summaryReport.tablesCount, null, 2))
}

runStructuredBackup().catch((err) => {
  console.error('[BACKUP DB] Fallimento critico dello script di backup:', err)
  process.exit(1)
})
