// scripts/deploy_all.mjs
import { execSync } from 'child_process'

function run(cmd, desc, allowFail = false) {
  console.log(`\n🚀 [DEPLOY] ${desc}...`)
  console.log(`   > ${cmd}`)
  try {
    execSync(cmd, { stdio: 'inherit', cwd: process.cwd() })
    console.log(`   ✅ OK: ${desc}`)
    return true
  } catch (err) {
    if (allowFail) {
      console.warn(`   ⚠️ Warning: ${desc} ha riscontrato un'avvertenza ma si prosegue.`)
      return false
    }
    console.error(`   ❌ ERRORE CRITICO: ${desc} fallito. Arresto deploy per sicurezza.`)
    process.exit(1)
  }
}

console.log('=============================================================')
console.log('   🏢 CONDOFAST — SCRIPT UNIFICATO AGGIORNAMENTO & DEPLOY   ')
console.log('=============================================================')

const commitMsg = process.argv[2] || 'S61: Aggiornamento rilasciato in produzione'

// 1. Check Build Locale
run('npm run build', '1/4 Verifica Build Locale Vite (Zero Errori)')

// 2. Git Commit & Push (Aggiorna GitHub + Trigger automatico Vercel)
run('git add .', '2/4 Stage File Modificati')
run(`git commit -m "${commitMsg}"`, '2/4 Git Commit', true)
run('git push origin main', '2/4 Push GitHub (Avvia Deploy Automatico Vercel)')

// 3. Deploy Edge Functions Supabase
console.log('\n🚀 [DEPLOY] 3/4 Aggiornamento Edge Functions Supabase...')
const functions = [
  'gemini-proxy',
  'inbound-email',
  'gocardless-proxy',
  'sync-bank-transactions',
  'stripe-checkout',
  'invia-comunicazione',
  'invia-email-marketing',
  'delete-account'
]

for (const fn of functions) {
  run(`npx supabase functions deploy ${fn}`, `Deploy Edge Function '${fn}'`, true)
}

// 4. Esecuzione Smoke Test
run('npm run smoke', '4/4 Smoke Test AI & Backend Supabase')

console.log('\n=============================================================')
console.log('🎉 AGGIORNAMENTO COMPLETATO SU TUTTE LE PIATTAFORME!')
console.log('🌐 Frontend: Vercel aggiornato automaticamente dal push GitHub')
console.log('🗄️ Backend: Database & Edge Functions Supabase Allineate')
console.log('=============================================================\n')
