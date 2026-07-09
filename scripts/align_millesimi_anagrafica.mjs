// scripts/align_millesimi_anagrafica.mjs
// Script avanzato per l'allineamento e la fusione automatica delle unità duplicate
// Uso:  node scripts/align_millesimi_anagrafica.mjs

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

// carica .env minimale
try {
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch { /* .env opzionale */ }

const URL  = process.env.VITE_SUPABASE_URL;
const ANON = process.env.VITE_SUPABASE_ANON_KEY;
const EMAIL = process.env.SMOKE_EMAIL;
const PASS  = process.env.SMOKE_PASSWORD;

if (!URL || !ANON || !EMAIL || !PASS) {
  console.error('❌ Mancano credenziali in .env.');
  process.exit(1);
}

const supabase = createClient(URL, ANON);
const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({ email: EMAIL, password: PASS });
if (authErr) {
  console.error('❌ Login fallito:', authErr.message);
  process.exit(1);
}

console.log(`🔒 Autenticato come: ${EMAIL}`);

// Carica condomini
const { data: condomini, error: condErr } = await supabase.from('condomini').select('id, nome');
if (condErr) {
  console.error('Errore caricamento condomini:', condErr.message);
  process.exit(1);
}

// Algoritmo di normalizzazione intelligente ed avanzato
function normalizzaNome(nome) {
  if (!nome) return '';
  let s = nome.toLowerCase();
  
  // Estrae tutti i numeri presenti nella stringa
  const numeri = s.match(/\d+/g) || [];
  // Estrae le parole (es. "box", "int", "scala") ignorando "sub"
  const parole = s.match(/[a-z]+/g) || [];
  const paroleFiltrate = parole.filter(p => p !== 'sub' && p !== 'sub.');

  // Se abbiamo un numero unico (anche se ripetuto, es. "8 (sub. 8)" -> [8, 8])
  const numeriUnici = [...new Set(numeri)];
  
  if (numeriUnici.length === 1) {
    const parolaPrefisso = paroleFiltrate.join(' ');
    return parolaPrefisso ? `${parolaPrefisso} ${numeriUnici[0]}` : `${numeriUnici[0]}`;
  }
  
  // Se abbiamo più numeri o una struttura complessa, restituiamo la stringa pulita da "sub" e parentesi
  let pulita = s
    .replace(/sub\.?\s*/g, '')
    .replace(/[\(\)]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return pulita;
}

for (const condo of condomini) {
  console.log(`\n======================================================================`);
  console.log(`🏛️  ALLINEAMENTO CONDOMINIO: ${condo.nome.toUpperCase()}`);
  console.log(`======================================================================`);

  // 1. Carica le unità
  const { data: unita, error: uErr } = await supabase
    .from('unita')
    .select('id, numero, scala, mq')
    .eq('condominio_id', condo.id);

  if (uErr || !unita || unita.length === 0) {
    console.log('   Nessuna unità trovata o errore.');
    continue;
  }

  // 2. Carica gli occupanti attivi
  const { data: occupanti, error: occErr } = await supabase
    .from('occupanti_unita')
    .select('id, unita_id, ruolo, attivo')
    .eq('attivo', true);

  if (occErr) {
    console.error('   Errore occupanti:', occErr.message);
    continue;
  }

  const unitaIds = unita.map(u => u.id);
  const occupantiCondo = (occupanti || []).filter(o => unitaIds.includes(o.unita_id));

  // Raggruppiamo le unità per nome normalizzato con il nuovo algoritmo
  const gruppi = {};
  unita.forEach(u => {
    const norm = normalizzaNome(u.numero);
    if (!gruppi[norm]) gruppi[norm] = [];
    gruppi[norm].push(u);
  });

  let mergeEseguiti = 0;

  // Analizziamo i gruppi con più di un'unità
  for (const [norm, lista] of Object.entries(gruppi)) {
    if (lista.length > 1) {
      console.log(`   🔎 Rilevato gruppo duplicato per "${norm.toUpperCase()}":`, lista.map(u => u.numero));

      let target = null;
      let sorgente = null;

      const haOccupanti = lista.map(u => ({
        unita: u,
        count: occupantiCondo.filter(o => o.unita_id === u.id).length
      }));

      // Ordina decrescente per numero di occupanti, e in caso di parità per brevità del nome
      haOccupanti.sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.unita.numero.length - b.unita.numero.length;
      });

      target = haOccupanti[0].unita;
      
      for (let i = 1; i < haOccupanti.length; i++) {
        sorgente = haOccupanti[i].unita;
        console.log(`      👉 Fusione: [${sorgente.numero}] ➔ [${target.numero}] (Target ID: ${target.id}, Sorgente ID: ${sorgente.id})`);

        try {
          // A. Sposta Millesimi
          const { data: millSorgente } = await supabase.from('millesimi_unita').select('*').eq('unita_id', sorgente.id);
          for (const ms of (millSorgente || [])) {
            const { data: targetExists } = await supabase
              .from('millesimi_unita')
              .select('*')
              .eq('tabella_id', ms.tabella_id)
              .eq('unita_id', target.id)
              .maybeSingle();

            if (targetExists) {
              const nuovoValore = parseFloat(targetExists.valore || 0) > 0 ? targetExists.valore : ms.valore;
              await supabase.from('millesimi_unita').update({ valore: nuovoValore }).eq('id', targetExists.id);
              await supabase.from('millesimi_unita').delete().eq('id', ms.id);
            } else {
              await supabase.from('millesimi_unita').update({ unita_id: target.id }).eq('id', ms.id);
            }
          }

          // B. Sposta Occupanti
          const { data: occSorgente } = await supabase.from('occupanti_unita').select('*').eq('unita_id', sorgente.id);
          for (const os of (occSorgente || [])) {
            const { data: targetOccExists } = await supabase
              .from('occupanti_unita')
              .select('*')
              .eq('unita_id', target.id)
              .eq('persona_id', os.persona_id)
              .eq('ruolo', os.ruolo)
              .maybeSingle();

            if (targetOccExists) {
              await supabase.from('occupanti_unita').delete().eq('id', os.id);
            } else {
              await supabase.from('occupanti_unita').update({ unita_id: target.id }).eq('id', os.id);
            }
          }

          // C. Sposta Rate Unità
          const { data: rateSorgente } = await supabase.from('rate_unita').select('*').eq('unita_id', sorgente.id);
          for (const rs of (rateSorgente || [])) {
            const { data: targetRateExists } = await supabase
              .from('rate_unita')
              .select('*')
              .eq('rata_id', rs.rata_id)
              .eq('unita_id', target.id)
              .maybeSingle();

            if (targetRateExists) {
              const importoNuovo = parseFloat(targetRateExists.importo || 0) + parseFloat(rs.importo || 0);
              const pagatoNuovo = parseFloat(targetRateExists.importo_pagato || 0) + parseFloat(rs.importo_pagato || 0);
              
              await supabase.from('rate_unita').update({
                importo: importoNuovo,
                importo_pagato: pagatoNuovo,
                modificato_manualmente: targetRateExists.modificato_manualmente || rs.modificato_manualmente
              }).eq('id', targetRateExists.id);

              await supabase.from('rate_unita').delete().eq('id', rs.id);
            } else {
              await supabase.from('rate_unita').update({ unita_id: target.id }).eq('id', rs.id);
            }
          }

          // D. Sposta Saldi Iniziali
          const { data: saldiSorgente } = await supabase.from('saldi_iniziali').select('*').eq('unita_id', sorgente.id);
          for (const ss of (saldiSorgente || [])) {
            const { data: targetSaldoExists } = await supabase
              .from('saldi_iniziali')
              .select('*')
              .eq('esercizio_id', ss.esercizio_id)
              .eq('unita_id', target.id)
              .maybeSingle();

            if (targetSaldoExists) {
              const saldoNuovo = parseFloat(targetSaldoExists.saldo_precedente || 0) + parseFloat(ss.saldo_precedente || 0);
              await supabase.from('saldi_iniziali').update({ saldo_precedente: saldoNuovo }).eq('id', targetSaldoExists.id);
              await supabase.from('saldi_iniziali').delete().eq('id', ss.id);
            } else {
              await supabase.from('saldi_iniziali').update({ unita_id: target.id }).eq('id', ss.id);
            }
          }

          // E. Riconciliazioni
          await supabase.from('riconciliazioni_incassi').update({ unita_id: target.id }).eq('unita_id', sorgente.id);

          // F. Elimina Sorgente
          const { error: delErr } = await supabase.from('unita').delete().eq('id', sorgente.id);
          if (delErr) {
            console.error(`      ❌ Errore eliminazione unità sorgente ${sorgente.numero}:`, delErr.message);
          } else {
            console.log(`      ✅ Fusione completata ed eliminata unità ${sorgente.numero}`);
            mergeEseguiti++;
          }

        } catch (mergeErr) {
          console.error(`      ❌ Eccezione fusione ${sorgente.numero}:`, mergeErr.message);
        }
      }
    }
  }

  console.log(`   📝 Allineamento completato: ${mergeEseguiti} fusioni eseguite.`);
}

console.log(`\n🚀 Allineamento completato!`);
process.exit(0);
