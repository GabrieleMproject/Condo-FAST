/**
 * Generatore automatico del Condominio Demo "Condominio Parco delle Rose (DEMO)"
 * per l'onboarding degli utenti in prova gratuita (Trial).
 */

import { supabase } from './supabaseClient'

export async function generaCondominioDemo(userId) {
  if (!userId) throw new Error('ID utente non fornito per la generazione del demo')

  // 1. Verifica se esiste già un condominio demo per questo utente
  const { data: existingDemo } = await supabase
    .from('condomini')
    .select('id')
    .eq('amministratore_id', userId)
    .eq('is_demo', true)
    .maybeSingle()

  if (existingDemo) {
    return existingDemo.id
  }

  // 2. Crea il Condominio Demo
  const { data: condo, error: condoErr } = await supabase
    .from('condomini')
    .insert([{
      nome: 'Condominio Parco delle Rose (DEMO)',
      indirizzo: 'Via delle Rose',
      civico: '12',
      citta: 'Roma',
      cap: '00154',
      provincia: 'RM',
      codice_fiscale: '97854630582',
      is_demo: true,
      amministratore_id: userId
    }])
    .select()
    .single()

  if (condoErr) throw condoErr
  const condoId = condo.id

  // 3. Tabella Millesimale Generale
  const { data: tabMill, error: tabMillErr } = await supabase
    .from('tabelle_millesimali')
    .insert([{
      condominio_id: condoId,
      nome: 'Proprietà Generale'
    }])
    .select()
    .single()

  if (tabMillErr || !tabMill) throw tabMillErr || new Error('Errore durante la creazione della tabella millesimale demo')
  const tabMillId = tabMill.id

  // 4. Unità Immobiliari (4 appartamenti realistici)
  const unitaPayload = [
    { condominio_id: condoId, numero: '1', scala: 'A', piano: 1, mq: 75, tipo: 'appartamento' },
    { condominio_id: condoId, numero: '2', scala: 'A', piano: 1, mq: 90, tipo: 'appartamento' },
    { condominio_id: condoId, numero: '3', scala: 'B', piano: 2, mq: 85, tipo: 'appartamento' },
    { condominio_id: condoId, numero: '4', scala: 'B', piano: 2, mq: 110, tipo: 'appartamento' }
  ]

  const { data: unitaList, error: unitaErr } = await supabase
    .from('unita')
    .insert(unitaPayload)
    .select()

  if (unitaErr || !unitaList || unitaList.length < 4) throw unitaErr || new Error('Errore durante la creazione delle unità demo')
  const [u1, u2, u3, u4] = unitaList

  // 5. Millesimi per Unità (Somma = 1000)
  await supabase.from('millesimi_unita').insert([
    { tabella_id: tabMillId, unita_id: u1.id, valore: 210 },
    { tabella_id: tabMillId, unita_id: u2.id, valore: 250 },
    { tabella_id: tabMillId, unita_id: u3.id, valore: 240 },
    { tabella_id: tabMillId, unita_id: u4.id, valore: 300 }
  ])

  // 6. Persone e Occupanti
  const personePayload = [
    { nome: 'Alessandro', cognome: 'Rossi', email: 'alessandro.rossi.demo@condosmart.it', telefono: '3351234567', user_id: userId },
    { nome: 'Elena', cognome: 'Moretti', email: 'elena.moretti.demo@condosmart.it', telefono: '3389876543', user_id: userId },
    { nome: 'Roberto', cognome: 'Galli', email: 'roberto.galli.demo@condosmart.it', telefono: '3471122334', user_id: userId },
    { nome: 'Chiara', cognome: 'Conti', email: 'chiara.conti.demo@condosmart.it', telefono: '3495566778', user_id: userId }
  ]

  const { data: personeList, error: personeErr } = await supabase
    .from('persone')
    .insert(personePayload)
    .select()

  if (personeErr || !personeList || personeList.length < 4) throw personeErr || new Error('Errore durante la creazione dei residenti demo')
  const [p1, p2, p3, p4] = personeList

  await supabase.from('occupanti_unita').insert([
    { unita_id: u1.id, persona_id: p1.id, ruolo: 'proprietario', attivo: true },
    { unita_id: u2.id, persona_id: p2.id, ruolo: 'proprietario', attivo: true },
    { unita_id: u3.id, persona_id: p3.id, ruolo: 'proprietario', attivo: true },
    { unita_id: u4.id, persona_id: p4.id, ruolo: 'proprietario', attivo: true }
  ])

  // 7. Esercizio Corrente (2026)
  const { data: esercizio } = await supabase
    .from('esercizi')
    .insert([{
      condominio_id: condoId,
      anno: 2026,
      data_inizio: '2026-01-01',
      data_fine: '2026-12-31',
      stato: 'aperto',
      saldo_iniziale_cassa: 1500.00
    }])
    .select()
    .single()

  // 8. Spese di Prova
  const dateOggi = new Date().toISOString().split('T')[0]
  await supabase.from('spese').insert([
    {
      condominio_id: condoId,
      esercizio_id: esercizio.id,
      descrizione: 'Pulizia Scale e Spazi Comuni - Trimestre 1',
      importo_totale: 450.00,
      data_spesa: '2026-02-15',
      criterio: 'millesimi',
      categoria: 'Pulizia',
      fornitore: 'La Brillante Srl'
    },
    {
      condominio_id: condoId,
      esercizio_id: esercizio.id,
      descrizione: 'Manutenzione Ordinaria Ascensore',
      importo_totale: 320.00,
      data_spesa: '2026-03-10',
      criterio: 'millesimi',
      categoria: 'Manutenzione',
      fornitore: 'Otis Elevators SpA'
    },
    {
      condominio_id: condoId,
      esercizio_id: esercizio.id,
      descrizione: 'Polizza Assicurativa Fabbricato 2026',
      importo_totale: 1200.00,
      data_spesa: dateOggi,
      criterio: 'millesimi',
      categoria: 'Assicurazione',
      fornitore: 'Generali Assicurazioni'
    }
  ])

  // 9. Estratto Conto Bancario (Movimenti per la riconciliazione demo)
  await supabase.from('estratto_conto').insert([
    {
      condominio_id: condoId,
      data_movimento: '2026-01-15',
      descrizione: 'BONIFICO DA ROSSI ALESSANDRO QUOTA Q1',
      importo: 350.00,
      tipo: 'entrata',
      riconciliato: true
    },
    {
      condominio_id: condoId,
      data_movimento: '2026-02-18',
      descrizione: 'PAGAMENTO FATTURA LA BRILLANTE SRL',
      importo: 450.00,
      tipo: 'uscita',
      riconciliato: false
    },
    {
      condominio_id: condoId,
      data_movimento: dateOggi,
      descrizione: 'BONIFICO DA MORETTI ELENA SALDO RATA',
      importo: 400.00,
      tipo: 'entrata',
      riconciliato: false
    }
  ])

  return condoId
}

export async function eliminaCondominioDemo(supabase, condoId) {
  if (!condoId) return
  const { error } = await supabase
    .from('condomini')
    .delete()
    .eq('id', condoId)
    .eq('is_demo', true)

  if (error) throw error
}
