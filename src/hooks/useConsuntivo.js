// src/hooks/useConsuntivo.js
// Generatore consuntivo (read-only). Aggrega per sezioni A→E + nota sintetica + confronto preventivo.
// I numeri sono deterministici; il template (consuntivo_template.struttura) governa solo la presentazione.
import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100
const num = (v) => parseFloat(v || 0) || 0
// importo effettivo di una riga ripartizione (manuale vince)
const impRip = (r) => (r.override_manuale ? (r.importo_override ?? r.importo) : r.importo)

// Profilo di default se l'admin non ha ancora caricato un modello
export const DEFAULT_TEMPLATE = {
  ordine_categorie: ['assicurazione', 'amministrazione', 'utenze', 'manutenzione', 'ordinaria', 'straordinaria', 'altro'],
  etichette_categorie: {
    assicurazione: 'ASSICURAZIONE',
    amministrazione: 'AMMINISTRAZIONE',
    utenze: 'UTENZE',
    manutenzione: 'MANUTENZIONE',
    ordinaria: 'GESTIONE ORDINARIA',
    straordinaria: 'GESTIONE STRAORDINARIA',
    altro: 'SPESE VARIE',
  },
  sezioni: {
    competenza:    { attiva: true, ordine: 1, titolo: 'Rendiconto di competenza' },
    riparto:       { attiva: true, ordine: 2, titolo: 'Riparto per unità', tabella_millesimi_id: null },
    cassa:         { attiva: true, ordine: 3, titolo: 'Situazione di cassa' },
    fatture:       { attiva: true, ordine: 4, titolo: 'Situazione fatture' },
    confronto_prev:{ attiva: true, ordine: 5, titolo: 'Preventivo vs Consuntivo' },
    nota_sintetica:{ attiva: true, ordine: 6, titolo: 'Nota sintetica esplicativa (art. 1130-bis c.c.)' },
  },
}

export function useConsuntivo(condominioId, esercizioId) {
  const [data, setData] = useState(null)
  const [template, setTemplate] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetch = useCallback(async () => {
    if (!condominioId || !esercizioId) { setData(null); return }
    setLoading(true); setError(null)
    try {
      // 1) esercizio
      const { data: es, error: eEs } = await supabase
        .from('esercizi')
        .select('id, anno, data_inizio, data_fine, stato, saldo_iniziale_cassa, note')
        .eq('id', esercizioId).single()
      if (eEs) throw eEs

      // 2) spese + ripartizioni (competenza)
      const { data: spese, error: eSp } = await supabase
        .from('spese')
        .select(`
          id, descrizione, importo, data_spesa, categoria, tipo_lavoro, criterio,
          ripartizioni(unita_id, importo, importo_override, override_manuale)
        `)
        .eq('condominio_id', condominioId)
        .eq('esercizio_id', esercizioId)
      if (eSp) throw eSp

      // 3) rate + celle (incassi/dovuto piano)
      const { data: rate, error: eRt } = await supabase
        .from('rate')
        .select('id, rate_unita(unita_id, importo, importo_pagato)')
        .eq('esercizio_id', esercizioId)
      if (eRt) throw eRt

      // 4) saldi iniziali per unità
      const { data: saldi, error: eSi } = await supabase
        .from('saldi_iniziali_unita')
        .select('unita_id, saldo')
        .eq('esercizio_id', esercizioId)
      if (eSi) throw eSi

      // 5) cassa (periodo esercizio) — estratto_conto.data_movimento BETWEEN inizio/fine
      let qEc = supabase.from('estratto_conto')
        .select('data_movimento, causale, importo, tipo')
        .eq('condominio_id', condominioId)
      if (es.data_inizio) qEc = qEc.gte('data_movimento', es.data_inizio)
      if (es.data_fine)   qEc = qEc.lte('data_movimento', es.data_fine)
      const { data: ec, error: eEc } = await qEc
      if (eEc) throw eEc

      // 6) fatture legate alle spese dell'esercizio (Modello A: spesa_id → esercizio)
      const speseIds = (spese || []).map(s => s.id)
      let fatture = []
      if (speseIds.length) {
        const { data: ff, error: eFf } = await supabase
          .from('fatture_fornitori')
          .select('id, fornitore, numero_fattura, data_fattura, importo_totale, stato, ritenuta_acconto, f24_url, spesa_id')
          .eq('condominio_id', condominioId)
          .in('spesa_id', speseIds)
        if (eFf) throw eFf
        fatture = ff || []
      }

      // 7) preventivo + voci (confronto)
      const { data: prev, error: ePv } = await supabase
        .from('preventivi')
        .select('totale, preventivo_voci(descrizione, categoria, importo)')
        .eq('esercizio_id', esercizioId).maybeSingle()
      if (ePv) throw ePv

      // 8) branding studio
      const { data: { user } } = await supabase.auth.getUser()
      let branding = null
      if (user?.id) {
        const { data: prof } = await supabase
          .from('profiles')
          .select('studio_nome, studio_indirizzo, studio_contatti, logo_base64')
          .eq('id', user.id).maybeSingle()
        branding = prof || null
      }

      // 9) template attivo dell'amministratore
      let tmpl = DEFAULT_TEMPLATE
      if (user?.id) {
        const { data: ct } = await supabase
          .from('consuntivo_template')
          .select('id, struttura')
          .eq('amministratore_id', user.id)
          .eq('attivo', true)
          .order('updated_at', { ascending: false })
          .limit(1).maybeSingle()
        if (ct?.struttura && Object.keys(ct.struttura).length) {
          tmpl = { ...DEFAULT_TEMPLATE, ...ct.struttura,
            sezioni: { ...DEFAULT_TEMPLATE.sezioni, ...(ct.struttura.sezioni || {}) },
            etichette_categorie: { ...DEFAULT_TEMPLATE.etichette_categorie, ...(ct.struttura.etichette_categorie || {}) },
          }
        }
      }
      setTemplate(tmpl)

      // ── AGGREGAZIONI ─────────────────────────────────────────
      // B) competenza per categoria, split ordinaria(A)/straordinaria(C) via tipo_lavoro
      const catMap = {} // categoria → { ordinaria, straordinaria }
      ;(spese || []).forEach(s => {
        const cat = s.categoria || 'altro'
        const straord = s.tipo_lavoro === 'straordinario'
        if (!catMap[cat]) catMap[cat] = { ordinaria: 0, straordinaria: 0 }
        catMap[cat][straord ? 'straordinaria' : 'ordinaria'] += num(s.importo)
      })
      const totOrd  = round2(Object.values(catMap).reduce((a, c) => a + c.ordinaria, 0))
      const totStr  = round2(Object.values(catMap).reduce((a, c) => a + c.straordinaria, 0))
      const totSpese = round2(totOrd + totStr)

      // C) per unità: dovuto(ripartito), versato, saldo iniziale, conguaglio, dovuto piano, arretrati
      const perUnita = {} // unita_id → {...}
      const ensure = (uid) => (perUnita[uid] ||= { dovuto: 0, versato: 0, saldoIniz: 0, dovutoPiano: 0 })
      ;(spese || []).forEach(s => (s.ripartizioni || []).forEach(r => {
        ensure(r.unita_id).dovuto += num(impRip(r))
      }))
      ;(rate || []).forEach(rt => (rt.rate_unita || []).forEach(c => {
        const u = ensure(c.unita_id)
        u.versato += num(c.importo_pagato)
        u.dovutoPiano += num(c.importo)
      }))
      ;(saldi || []).forEach(s => { ensure(s.unita_id).saldoIniz += num(s.saldo) })

      const unitaRows = Object.entries(perUnita).map(([uid, u]) => {
        const dovuto = round2(u.dovuto)
        const versato = round2(u.versato)
        const saldoIniz = round2(u.saldoIniz)
        // SALDO/conguaglio = saldo iniziale + versato − dovuto (>0 credito, <0 debito)
        const conguaglio = round2(saldoIniz + versato - dovuto)
        const arretrati = round2(Math.max(0, u.dovutoPiano - versato))
        return { unita_id: uid, dovuto, versato, saldoIniz, conguaglio, arretrati }
      })
      const totRiparto = {
        dovuto: round2(unitaRows.reduce((a, r) => a + r.dovuto, 0)),
        versato: round2(unitaRows.reduce((a, r) => a + r.versato, 0)),
        saldoIniz: round2(unitaRows.reduce((a, r) => a + r.saldoIniz, 0)),
        conguaglio: round2(unitaRows.reduce((a, r) => a + r.conguaglio, 0)),
        arretrati: round2(unitaRows.reduce((a, r) => a + r.arretrati, 0)),
      }

      // D) cassa
      const entrate = round2((ec || []).filter(m => (m.tipo === 'entrata') || (m.tipo == null && num(m.importo) >= 0))
        .reduce((a, m) => a + Math.abs(num(m.importo)), 0))
      const uscite = round2((ec || []).filter(m => (m.tipo === 'uscita') || (m.tipo == null && num(m.importo) < 0))
        .reduce((a, m) => a + Math.abs(num(m.importo)), 0))
      const saldoInizCassa = num(es.saldo_iniziale_cassa)
      const saldoFinaleCassa = round2(saldoInizCassa + entrate - uscite)
      // Pareggio: competenza (spese vs versato) ~ cassa
      const saldoCompetenza = round2(totRiparto.versato - totSpese)
      const pareggio = round2((totRiparto.versato - totSpese) - (saldoFinaleCassa - saldoInizCassa - (entrate - uscite)))

      // E) fatture
      const fattureRows = (fatture || []).map(f => ({
        ...f,
        // badge ritenuta/F24 derivato (D1=1A)
        ritenutaBadge: f.ritenuta_acconto == null ? null
          : f.stato !== 'pagata' ? 'Ritenuta · non pagata'
          : !f.f24_url ? 'In attesa F24'
          : 'Ritenuta completa',
      }))
      const fattureTot = {
        totale: round2(fattureRows.reduce((a, f) => a + num(f.importo_totale), 0)),
        pagate: round2(fattureRows.filter(f => f.stato === 'pagata').reduce((a, f) => a + num(f.importo_totale), 0)),
        attesa: round2(fattureRows.filter(f => f.stato === 'attesa').reduce((a, f) => a + num(f.importo_totale), 0)),
        attesaF24: fattureRows.filter(f => f.ritenuta_acconto != null && f.stato === 'pagata' && !f.f24_url).length,
      }

      // Confronto preventivo vs consuntivo per categoria
      const prevByCat = {}
      ;(prev?.preventivo_voci || []).forEach(v => {
        const c = v.categoria || 'altro'
        prevByCat[c] = (prevByCat[c] || 0) + num(v.importo)
      })
      const consByCat = {}
      Object.entries(catMap).forEach(([c, v]) => { consByCat[c] = round2(v.ordinaria + v.straordinaria) })
      const catKeys = Array.from(new Set([...Object.keys(prevByCat), ...Object.keys(consByCat)]))
      const confronto = catKeys.map(c => {
        const p = round2(prevByCat[c] || 0)
        const co = round2(consByCat[c] || 0)
        return { categoria: c, preventivo: p, consuntivo: co, differenza: round2(p - co) }
      })
      const confrontoTot = {
        preventivo: round2(confronto.reduce((a, r) => a + r.preventivo, 0)),
        consuntivo: round2(confronto.reduce((a, r) => a + r.consuntivo, 0)),
        differenza: round2(confronto.reduce((a, r) => a + r.differenza, 0)),
      }

      setData({
        esercizio: es,
        branding,
        // B
        competenza: { catMap, totOrd, totStr, totSpese },
        // C
        riparto: { unitaRows, tot: totRiparto },
        // D
        cassa: { entrate, uscite, saldoInizCassa, saldoFinaleCassa, saldoCompetenza, pareggio },
        // E
        fatture: { rows: fattureRows, tot: fattureTot },
        // confronto
        confronto: { rows: confronto, tot: confrontoTot },
      })
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [condominioId, esercizioId])

  return { data, template, loading, error, fetch, setTemplate }
}