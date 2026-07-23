# CondoSmart — Guida Completa di Progetto & Istruzioni per Claude

Questo documento è la **fonte unica di verità** per l'assistente AI (Claude) che lavora sul progetto **CondoSmart (CondoAI)**. Contiene la visione di business, l'architettura tecnica, le regole di sviluppo, le trappole DB note, le convenzioni di codice e il flusso operativo pre-commit.

---

## 1. Visione di Business & Principi di Prodotto

### 1.1 Cos'è CondoSmart
**CondoSmart** è un gestionale SaaS B2B di nuova generazione per l'amministrazione dei condomini. È progettato per agire come un **collaboratore virtuale intelligente** per l'amministratore professionista, automatizzando la contabilità, l'estrazione dati da fatture/estratti conto e la rendicontazione annuale.

### 1.2 Principi Guida Indiscussi
- **"Propone → conferma"**: L'AI analizza, estrae, associa o suggerisce; l'amministratore ha sempre il controllo finale per confermare con un click.
- **Matematica Deterministica**: L'AI è usata *solo* per OCR, fuzzy matching, sintesi e classificazione. Tutti i calcoli contabili, saldi, riparti millesimali e conguagli sono eseguiti in aritmetica pura e deterministica in JavaScript / PostgreSQL.
- **Diagnostica Read-Only First**: Prima di modificare la struttura DB o scrivere SQL, eseguire sempre ispezioni in sola lettura dello stato corrente del database.
- **Periodo Amministrativo Flessibile**: L'esercizio contabile può differire dall'anno solare (`data_inicio` e `data_fine` su `esercizi`).

### 1.3 Modello SaaS & Pricing
La metrica di prezzo è basata unicamente sulle **Unità Immobiliari (U.I.) gestite**, SENZA limiti sul numero di collaboratori dello studio.

| Piano | Limite U.I. | Prezzo / Mese | Prezzo / Anno | Target / Note |
| :--- | :--- | :--- | :--- | :--- |
| **Starter** | Fino a 250 U.I. (~8 condomini) | **€69** | ~€830 | Piccoli studi o neo-costituiti |
| **Professional** | Fino a 800 U.I. (~25 condomini) | **€179** | ~€2.150 | **Tier di riferimento (più venduto)** |
| **Studio** | Fino a 2.000 U.I. (~65 condomini) | **€379** | ~€4.550 | Studi strutturati con dipendenti |
| **Enterprise** | Oltre 2.000 U.I. | *Su misura* | *Su misura* | Grandi gruppi di gestione |

### 1.4 Scelte Strategiche Chiuse (NON rimettere in discussione)
1. **Nessuna versione per Condomini Autogestiti**: Il target è esclusivamente l'amministratore professionista (art. 1129 c.c.).
2. **Nessuna Bacheca Social Tra Condòmini**: Solo bacheca monodirezionale (amministratore → condòmini per avvisi, verbali e rendiconti). zero UGC per evitare liti e rischi GDPR.
3. **Nessuna Provvigione Opaca su Fornitori Energetici**: Rispetto dell'art. 1129 c.c. e della giurisprudenza della Cassazione (nullità della nomina in caso di compensi indiretti non dichiarati).
4. **Modello A (Spese vs Fatture)**: Le spese sono il centro contabile; la fattura è un dettaglio associato tramite `spesa_id`. Non si fondono.

---

## 2. Regole di Comunicazione & Ambito Operativo

### 2.1 Lingua e Convenzioni
- **Comunicazione con l'utente (Gabriele)**: Sempre in **Italiano**.
- **Codice, variabili, funzioni, commenti**: In **Inglese**.
- **Messaggi di Commit**: In **Italiano** (Formato: `S{N} step{M}: descrizione breve`).

### 2.2 Ambito Operativo Rigido
- **Directory Workspace**: `/Users/gabrielemaesani/Documents/CondoAI2` e sottocartelle.
- **Repository GitHub**: `github.com/maximeclaes990-ux/Condoai` (branch `main`).
- **Permessi Esterni**: Per qualsiasi operazione fuori ambito (accesso rete non autorizzato, installazione pacchetti non previsti, comandi distruttivi `rm`, `git push --force`, modifiche a DB di produzione senza query di test) **FERMARSI e chiedere autorizzazione esplicita**.

### 2.3 Processo Decisionale
- **Decisioni Strutturali**: Schema DB, architettura, pattern, nuove dipendenze richiederanno SEMPRE approvazione preventiva di Gabriele. Proporre opzioni con trade-off ed attendere ok.
- Per refactoring o fix già approvati: procedere in batch ed eseguire verifica build finale.

---

## 3. Architettura Tecnica & Mappa della Codebase

### 3.1 Stack Tecnologico
- **Frontend**: React 18 + Vite 8 + CSS Vanilla (Variabili CSS con supporto dinamico Light/Dark Mode via attribute `data-theme`, Font Sora).
- **Backend / Database**: Supabase (PostgreSQL, Row Level Security, Storage, Edge Functions).
- **Integrazioni Esterne**:
  - **Stripe**: Gestione abbonamenti e programma referral.
  - **Resend**: Invio email solleciti rate, comunicazioni e autocertificazioni anagrafiche.
  - **Google Gemini (Flash & Pro)**: OCR fatture, parsing estratti conto, analisi verbali, autocertificazione anagrafica (instradati tramite la Edge Function `gemini-proxy`).

### 3.2 Struttura della Codebase
```
/Users/gabrielemaesani/Documents/CondoAI2
├── src/
│   ├── App.jsx                     # Router principale (BrowserRouter + ProtectedRoute + SuperAdminGuard)
│   ├── main.jsx                    # Entry point React
│   ├── index.css                   # Stili globali (CSS Variables, Dark/Light theme, Sora Font)
│   ├── contexts/
│   │   └── AuthContext.jsx         # Context per Autenticazione Supabase
│   ├── components/
│   │   ├── AppLayout.jsx           # Layout principale (Header con esercizio globale, Sidebar, Drawer Admin)
│   │   ├── ProtectedRoute.jsx      # Guard per rotte protette da Auth
│   │   ├── PlanGate.jsx            # Controllo limiti del piano abbonamento
│   │   ├── AnagraficaCondominioTab.jsx # Tab unificato Anagrafica, Catasto (OCR AI) e Rubrica
│   │   ├── PreventivoSection.jsx   # Tab unificato Preventivo Spese e Saldi Iniziali
│   │   ├── ConsuntivoTab.jsx       # Rendiconto annuale Sezioni A→E (art. 1130-bis c.c.)
│   │   ├── RateGridTab.jsx         # Griglia rate per unità e solleciti veloci
│   │   ├── SpeseForm.jsx           # Form inserimento e ripartizione spese
│   │   ├── DocumentiCondominio.jsx # Documenti e contratti con categorie e Signed URL
│   │   └── VerbaliAssembleaTab.jsx # Archivio verbali con motore di ricerca AI
│   ├── hooks/
│   │   ├── useCondomini.js / useUnita.js / usePersone.js # Management anagrafico
│   │   ├── useSpese.js / useRipartizioni.js            # Gestione spese e riparti
│   │   ├── useEsercizi.js          # Esercizi contabili e selezione globale in Header
│   │   ├── useConsuntivo.js        # Engine aggregazione contabile sezioni A→E
│   │   ├── usePlan.js              # Limiti piano, ereditarietà collaboratori e utilizzi AI
│   │   └── useDocumenti.js         # Gestione documenti Supabase Storage + Signed URLs
│   ├── lib/
│   │   ├── supabaseClient.js       # Client Supabase
│   │   ├── claudeClient.js         # Wrapper chiamate AI (`callGemini`, `callGeminiDocument`, etc.)
│   │   ├── fileExtractor.js        # Moduli OCR per fatture, estratti conto e anagrafica
│   │   ├── exportPdf.js            # Export PDF generici in Light Mode
│   │   └── exportConsuntivo.js     # Esportazione PDF ufficiale Rendiconto Annuale con branding
│   └── pages/
│       ├── DashboardPage.jsx       # KPI globali dello studio
│       ├── CondominiDetailPage.jsx # Dettaglio condominio (Tab unificati)
│       ├── SpesePage.jsx           # Registrazione spese ed esercizi
│       ├── EstrattoContoPage.jsx   # Upload e gestione estratti conto bancari
│       ├── RiconciliazioniPage.jsx # Riconciliazione uscite (banca ↔ fatture/spese)
│       ├── RiconciliazioniIncassiPage.jsx # Riconciliazione entrate (banca ↔ rate)
│       ├── ImpostazioniPage.jsx    # Profilo admin, branding, tema, collaboratori, notifiche
│       └── BackofficePage.jsx      # Console SuperAdmin (Statistiche, ticket, newsletter)
├── sql/                            # Migrazioni e script SQL di sistema
├── supabase/functions/             # Edge Functions Supabase
│   ├── gemini-proxy/               # Proxy sicuro verso Google Gemini (con Auth token)
│   ├── invia-comunicazione/        # Invio email via Resend
│   └── stripe-checkout/            # Checkout Stripe sicuro
└── scripts/
    ├── deploy_all.mjs              # Script unificato per build, git push, deploy Edge Functions e smoke test
    └── smoke.mjs                   # Smoke test runtime per verificare la salute del sistema
```

---

## 4. Convenzioni Tecniche Critiche & Trappole DB

### 4.1 Firme AI (`claudeClient.js` / `callGemini`)
Le chiamate AI utilizzano il proxy `gemini-proxy`. Mantenere scrupolosamente le seguenti firme canoniche:
- `callGemini(prompt, { system, maxTokens, funzione, condominio_id })` — Testo.
- `callGeminiWithHistory(messages, { system, maxTokens, ... })` — Multi-turn.
- `callGeminiVision(prompt, base64, mediaType, opts)` — Immagini (NON inoltra `system`).
- `callGeminiDocument(prompt, base64Document, { system, mediaType, maxTokens, funzione, condominio_id })` — PDF.
- ⚠️ **Parametro di conteggio token**: Usare sempre `maxTokens` (NON `max_tokens`).
- ⚠️ Il stringone base64 di immagini/documenti **NON** deve passare per `sanitizeInput`.

### 4.2 Trappole nello Schema DB (Da ricordare per evitare errori)
- **Tabelle `spese`**: Contiene la colonna `data_spesa` (date). **NON esiste `data_competenza`**.
- **Criteri di Ripartizione**: La colonna su `spese` è `criterio` (text). **NON `criterio_ripartizione`**.
- **Tabella `ripartizioni`**: Usa la colonna `millesimi_usati`. **NON `millesimi`**.
- **Tabella `rate`**: È la testata del piano rateale. Le colonne `importo`, `scadenza`, `stato`, `data_pagamento` appartengono a **`rate_unita`**.
- **Millesimi**: `millesimi_unita` usa `tabella_id` + `valore`. `spese` e `preventivo_voci` usano `tabella_millesimale_id`.
- **Embed PostgREST**: Quando si effettuano select annidate con PostgREST:
  `rate_unita -> unita -> occupanti_unita` (occupanti_unita deve essere annidato sotto `unita`, MAI come fratello di unita).
- **Segno dei Saldi**: `>0` credito del condomino (ha pagato di più), `<0` debito del condomino. Nessuna inversione di segno.

### 4.3 Sicurezza, RLS e Privacy GDPR
- **Funzione PostgreSQL RLS**: Tutte le tabelle legate a un condominio devono applicare politiche RLS trasparenti basate su `amministratore_id` tramite l'helper PostgreSQL:
  `user_owns_condominio(condominio_id)`
- **Multi-utenza & Collaboratori**: I collaboratori definiti in `collaboratori_studio` ed associati in `collaboratori_condomini` ereditano le autorizzazioni dell'amministratore titolare solo per i condomini a loro assegnati.
- **SuperAdmin**: Controllato via colonna `is_superadmin` in `profiles` e verificato sul DB tramite la funzione `SECURITY DEFINER` `public.is_superadmin(uuid)`.
- **Signed URL (GDPR/Privacy)**: MAI usare `getPublicUrl` per documenti sensibili (fatture, F24, estratti conto, verbali). Caricare su bucket privati e generare **Signed URL a tempo** (scadenza 15 minuti) via `useDocumenti`.
- **Pattern Anti-Popup Blocker**: Quando si genera un Signed URL su evento click dell'utente, aprire prima in modo sincrono un tab vuoto (`const win = window.open('about:blank', '_blank')`) e poi impostare `win.location.href = signedUrl` al completamento della promise asincrona.

### 4.4 Sistema di Styling & Tema Grafico
- **CSS Vanilla (Variabili CSS)**: Tutta l'applicazione sfrutta le variabili definite in `src/index.css`.
- **Preferenza Tema**: Salvata in `localStorage` (`'condosmart-theme'`). Lo script in `<head>` di `index.html` imposta `data-theme="light"` o `"dark"` in modo sincrono prevenendo qualsiasi flash di colore.
- **CSS Variables Canoniche**: Usare `var(--app-bg)`, `var(--card-bg)`, `var(--border-color)`, `var(--text-primary)`, `var(--text-secondary)`. Non inserire mai colori hex scuri o chiari hardcoded nei file JSX.

---

## 5. Rendiconto Annuale (Consuntivo art. 1130-bis c.c.)

Il consuntivo è articolato in **5 Sezioni ufficiali (A→E)** aggregate dall'hook `useConsuntivo.js` e renderizzate da `ConsuntivoTab.jsx` ed `exportConsuntivo.js`:

1. **Sezione A (Intestazione & Branding)**: Dati dell'amministratore (ragione sociale, P.IVA, CF da `profiles`), logo studio e dati del condominio.
2. **Sezione B (Rendiconto Economico)**: Spese totali per categoria contabile con split fra Ordinarie e Straordinarie.
3. **Sezione C (Riparto per Unità)**: Tabella analitica per ogni unità: Saldo Iniziale + Dovuto Preventivo − Versato = Conguaglio Finale.
4. **Sezione D (Registro di Cassa & Quadratura)**: Estratto conto bancario del periodo + Saldo iniziale cassa.
   - **Quadratura D**: `scartoQuadratura = (saldoFinaleCassa − saldoInizCassa) − (totaleVersato − totaleSpesePagate)`.
5. **Sezione E (Situazione Debiti/Crediti & Fatture)**: Elenco fatture pagate, in attesa e ritenute d'acconto (F24).
6. **Confronto Preventivo vs Consuntivo**: `Differenza = Preventivo − Consuntivo` (un valore positivo indica un risparmio per il condominio).

---

## 6. Sub-Agent Orchestration (Workflow a 5 Ruoli)

Quando si affrontano sessioni di lavoro complesse o diagnosi di bug, fare riferimento all'orchestrazione dei ruoli:

| Ruolo | Tipo | Descrizione & Scopo |
| :--- | :--- | :--- |
| 🔍 **Bug Triager** | `research` (read-only) | Scansiona i file coinvolti, riproduce il problema, verifica lo schema DB, individua la root-cause e propone un diff. Viene eseguito automaticamente a fine sessione. |
| 🔧 **Bug Fixer** | `self` (write) | Applica il fix approvato, verifica la compilazione ed aggiorna il codice. |
| 🛡️ **Security Auditor** | `research` (read-only) | Ispeziona RLS, signed URL vs public URL, injection/bypass, segreti ed esposizione dati GDPR. |
| 📚 **Knowledge Keeper** | `self` (write) | Aggiorna `AGENTS.md`, `HANDOFF_PROGETTO.md` e questa guida a fine sessione. |
| 🧪 **Regression Tester** | `self` (write) | Esegue `npm run smoke` e verifica che la build sia verde. |

---

## 7. Checklist Pre-Commit & Deploy Unificato

### 7.1 Checklist Pre-Commit (OBBLIGATORIA prima di chiudere)
1. **Compilazione Vite**: Eseguire `npm run build` e verificare che sia totalmente VERDE senza errori di sintassi o JSX.
2. **Firme AI**: Verificare che le chiamate usino `maxTokens` e le funzioni canoniche di `claudeClient.js`.
3. **Embed PostgREST**: Verificare l'annidamento corretto nelle relazioni Supabase.
4. **RLS Check**: Assicurarsi che ogni nuova tabella abbia RLS attive con `user_owns_condominio`.
5. **Handling Date**: Usare sempre gli helper sicuri (`formattaData` o `dataIt`) per prevenire crash da date nulle/malformate.
6. **Edge Functions**: Se è stata modificata una Edge Function in `supabase/functions/`, ricordarsi che il `git push` NON la redeploya in automatico. Serve il deploy esplicito.

### 7.2 Comando di Deploy Unificato
Per inviare gli aggiornamenti al sistema ed allineare tutte le piattaforme in un unico comando sicuro:

```bash
npm run deploy:all
# Oppure specificando il messaggio di commit:
node scripts/deploy_all.mjs "S{N} step{M}: descrizione delle modifiche"
```

Questo script esegue automaticamente la seguente sequenza:
1. Verification build locale (`npm run build`)
2. Commit e Push su GitHub (`git push origin main`) → *Scatena il deploy automatico del frontend su Vercel*
3. Deploy automatico delle Edge Functions Supabase (`gemini-proxy`, `invia-comunicazione`, `stripe-checkout`, `invia-email-marketing`)
4. Esecuzione dello smoke test (`npm run smoke`)

---

## 8. Storico Decisioni Chiuse & Bug Risolti

- **Riconciliazione Ibrida (S16)**: I movimenti bancari non abbinati mostrano avvisi e permettono il salvataggio rapido di uscite/spese precompilando `SpeseForm.jsx` o l'abbinamento manuale con 1 click per le rate in entrata.
- **Estratto Conto Storage & Archiviazione (S17)**: Gli estratti conto caricati vengono salvati nel bucket privato `documenti-condominio` under `tipo = 'estratto_conto'`. L'upload di un nuovo file trasforma il precedente in `estratto_conto_archivio` rendendolo visibile nella scheda Documenti senza mai cancellarlo.
- **Filtro Esercizio Globale in Header (S58)**: L'esercizio contabile attivo è centralizzato nell'header dell'app e riflettorizzato negli URL per mantenere la persistenza durante il refresh su Preventivi, Rate, Consuntivi e Spese.
- **Light Mode per PDF**: Tutti i report PDF generati da `exportPdf.js` ed `exportConsuntivo.js` usano sfondi chiari a basso consumo di inchiostro e righe alternate azzurre per la massima leggibilità di stampa.
