import { supabase } from './supabaseClient'

/**
 * Utility Engine per Fornitori Partner, Marketplace e Rendicontazione Provvigioni
 */

export async function fetchFornitoriPartner() {
  const { data, error } = await supabase
    .from('fornitori_partner')
    .select('*')
    .order('provincia_esclusiva', { ascending: true })

  if (error) throw error
  return data || []
}

export async function fetchPartnerMatchLogs() {
  const { data, error } = await supabase
    .from('partner_match_log')
    .select(`
      *,
      partner:fornitori_partner(ragione_sociale, partita_iva, provincia_esclusiva, percentuale_commissione),
      condominio:condomini(nome),
      amministratore:profiles(nome, cognome, email)
    `)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function fetchRichiestePreventivo() {
  const { data, error } = await supabase
    .from('richieste_preventivo')
    .select(`
      *,
      partner:fornitori_partner(ragione_sociale, email, telefono),
      condominio:condomini(nome),
      amministratore:profiles(nome, cognome, email)
    `)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function saveFornitorePartner(partnerData) {
  if (partnerData.id) {
    const { data, error } = await supabase
      .from('fornitori_partner')
      .update({
        ...partnerData,
        updated_at: new Date().toISOString()
      })
      .eq('id', partnerData.id)
      .select()
      .single()

    if (error) throw error
    return data
  } else {
    const { data, error } = await supabase
      .from('fornitori_partner')
      .insert([partnerData])
      .select()
      .single()

    if (error) throw error
    return data
  }
}

export async function updateStatoCommissione(logId, nuovoStato) {
  const { data, error } = await supabase
    .from('partner_match_log')
    .update({ stato_commissione: nuovoStato })
    .eq('id', logId)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function checkInvoiceMatch(fatturaId, partitaIva, importo, dataFattura, numeroFattura, condominioId, userId) {
  if (!partitaIva || !importo) return null

  try {
    const { data, error } = await supabase.rpc('check_invoice_partner_match', {
      p_fattura_id: fatturaId,
      p_piva: partitaIva,
      p_importo: importo,
      p_data_fattura: dataFattura || new Date().toISOString().split('T')[0],
      p_numero_fattura: numeroFattura || '',
      p_condominio_id: condominioId,
      p_user_id: userId
    })

    if (error) {
      console.warn("Match partner RPC error:", error)
      return null
    }
    return data
  } catch (err) {
    console.warn("Eccezione durante checkInvoiceMatch:", err)
    return null
  }
}

export async function creaRichiestaPreventivo(richiestaData) {
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('richieste_preventivo')
    .insert([{
      ...richiestaData,
      amministratore_id: user.id
    }])
    .select()
    .single()

  if (error) throw error
  return data
}
