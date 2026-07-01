import { supabase } from './supabaseClient'

export async function generaExportGDPR() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Utente non autenticato')

  const exportData = {
    metadata: {
      export_date: new Date().toISOString(),
      user_id: user.id,
      email: user.email,
      app: "CondoAI"
    },
    data: {}
  }

  // Definiamo le tabelle da estrarre
  // La Row Level Security (RLS) assicurerà che il DB restituisca 
  // solo le righe possedute o visibili all'utente in sessione.
  const tables = [
    'profiles',
    'condomini',
    'unita',
    'occupanti_unita',
    'millesimi_unita',
    'persone',
    'fornitori',
    'fatture_fornitori',
    'esercizi',
    'spese',
    'piani_rateali',
    'rate',
    'pagamenti',
    'comunicazioni',
    'tickets_assistenza',
    'chat_assistenza_logs'
  ]

  for (const table of tables) {
    try {
      const { data, error } = await supabase.from(table).select('*')
      if (error) {
        console.warn(`Errore export tabella ${table}:`, error.message)
        exportData.data[table] = []
      } else {
        exportData.data[table] = data || []
      }
    } catch (e) {
      console.warn(`Eccezione export tabella ${table}:`, e)
      exportData.data[table] = []
    }
  }

  // Creazione stringa JSON e trigger del download
  const dataStr = JSON.stringify(exportData, null, 2)
  const blob = new Blob([dataStr], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  
  const exportFileDefaultName = `condoai_export_${new Date().toISOString().split('T')[0]}.json`
  
  const linkElement = document.createElement('a')
  linkElement.setAttribute('href', url)
  linkElement.setAttribute('download', exportFileDefaultName)
  document.body.appendChild(linkElement)
  linkElement.click()
  document.body.removeChild(linkElement)
  URL.revokeObjectURL(url)
  
  return true
}
