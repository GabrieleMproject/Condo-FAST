# Disaster Recovery & Guida Backup Automatici CondoSmart

Questa guida documenta le procedure di **backup, ridondanza e ripristino di emergenza (Disaster Recovery)** per la piattaforma **CondoSmart**.

---

## 1. Backup Automatizzato del Database (Supabase / PostgreSQL)

### A. Snapshot Strutturato via Script Node.js (`scripts/backup_db.mjs`)
Lo script esegue il backup sicuro in formato JSON strutturato di tutte le tabelle fondamentali del sistema (condomini, unita, persone, spese, rate, comunicazioni, ecc.) salvandole in `sql/backups/`.

**Comando di esecuzione manuale:**
```bash
node scripts/backup_db.mjs
```

### B. Dump Completo PostgreSQL (via Supabase CLI)
Per esportare l'intero schema e tutti i dati in formato SQL nativo `.sql`:

```bash
# Export completo di schema e dati cifrati
supabase db dump --linked > sql/backups/full_backup_$(date +%Y%m%d_%H%M%S).sql
```

### C. Configurazione Cron Automatizzato (GitHub Actions)
Per far eseguire il backup automaticamente ogni notte a mezzanotte e salvarlo su uno storage esterno protetto (es. Cloudflare R2 / AWS S3):

Crea il file `.github/workflows/daily_db_backup.yml`:
```yaml
name: Daily Database Backup

on:
  schedule:
    - cron: '0 2 * * *' # Ogni notte alle 02:00 UTC
  workflow_dispatch:

jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 18
      - run: npm install @supabase/supabase-js
      - run: node scripts/backup_db.mjs
        env:
          VITE_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
```

---

## 2. Ridondanza AI (Google Gemini Edge Function)

L'Edge Function `supabase/functions/gemini-proxy/index.ts` è protetta da un meccanismo di **Failover automatico a 2 livelli**:

1. **Multi-Modello**: Se il modello richiesto (es. `gemini-1.5-flash` o `gemini-pro`) incontra un errore di quota (`429`) o sovraccarico (`503`), tenta automaticamente i modelli `gemini-2.0-flash`, `gemini-1.5-flash` e `gemini-1.5-pro`.
2. **Multi-Chiave**: Se è impostata la variabile d'ambiente `GEMINI_API_KEY_BACKUP` nelle impostazioni delle Edge Functions su Supabase, il proxy commuta istantaneamente sulla seconda chiave API di riserva prima di restituire qualsiasi errore all'utente.

**Come aggiungere la chiave di riserva su Supabase:**
```bash
supabase secrets set GEMINI_API_KEY_BACKUP="tua_seconda_api_key_gemini"
```

---

## 3. Ridondanza Frontend & DNS Failover (Vercel)

1. Vercel gestisce l'hosting del frontend su una rete CDN distribuita in oltre 100 regioni con SLA 99.99%.
2. In caso di manutenzione straordinaria o blackout di Vercel, il repo GitHub può essere collegato come mirror secondario a **Cloudflare Pages** o **Netlify**.
3. Tramite il pannello DNS di Cloudflare, è possibile attivare gli **Health Checks** per reindirizzare automaticamente il traffico verso la piattaforma mirror qualora il dominio primario non risponda per 30 secondi.
