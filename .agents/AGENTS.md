# Regole Progetto CondoAI

## Lingua
- **Comunicare sempre in italiano** con l'utente (Gabriele).
- Codice, variabili, commenti nel codice: inglese (come il codebase esistente).
- Messaggi di commit: italiano (come i commit esistenti).

---

## Ambito di lavoro (PERMANENTE)
- Lavorare **ESCLUSIVAMENTE** in `/Users/gabrielemaesani/Documents/CondoAI2` e sottocartelle.
- Terminale: comandi solo da questa cartella e solo se pertinenti.
- **Revocare e ignorare** qualsiasi permesso concesso in precedenza che vada oltre questo ambito.
- Per **qualsiasi permesso fuori ambito** — file esterni, accesso di rete, installazione pacchetti, comandi distruttivi (`rm`, `reset`, `git push --force`, `drop`), deploy, migrazioni o query su DB di PRODUZIONE — **FERMARSI e chiedere autorizzazione esplicita** spiegando cosa e perché.

---

## Decisioni (PERMANENTE)
- **NON prendere decisioni strutturali** (schema DB, architettura, pattern, scelte di prodotto, nuove dipendenze) senza approvazione di Gabriele: proporre opzioni, evidenziare trade-off, attendere conferma PRIMA di scrivere.
- Per edit già decisi / fix / wiring → procedere in batch.
- Se mancano dettagli o ci sono incongruenze tra istruzioni, codice e documento di progetto → **fermarsi e chiedere** prima di scrivere.

---

## Regole di sessione

### Prima di qualsiasi modifica
1. Leggere lo skill `condoai` per il contesto completo del progetto.
2. Se la modifica tocca file esistenti, **leggere prima il file dal disco** (non fidarsi della memoria).
3. Per modifiche al DB, fare **diagnostica read-only** prima di generare SQL.

### Durante il lavoro
4. **NON aggiungere commenti `#` sulla stessa riga dei comandi npm** (npm li passa come argomenti → crash).
5. **Non usare `npm run build` come server** — quello è solo per verificare la build. Per provare l'app serve `npm run dev`.
6. Mantenere i commenti/docstring esistenti nel codice, a meno che non siano esplicitamente errati.

### Prima del commit
7. Eseguire `npm run build` e verificare che sia verde.
8. Verificare la checklist pre-commit (vedi skill condoai).
9. Se toccata una Edge Function → `supabase functions deploy <nome>` (il push NON rideploya).

### Chiusura sessione
10. Committare e pushare PRIMA di generare qualsiasi riepilogo.
11. Archiviare gli script SQL nel repo (`sql/`).
12. Aggiornare la sezione "Stato corrente" nello skill `condoai` se ci sono cambiamenti significativi.
13. **Lanciare il Bug Triager** (sub-agent read-only) per scansione automatica dei file toccati nella sessione → report bug/regressioni potenziali.
14. Aggiornare `AGENTS.md` con decisioni, fatti verificati o bug risolti nella sessione.

---

## Orchestrazione Sub-Agent (PERMANENTE)

### Ruoli definiti

| Agente | Tipo | Scopo | Quando |
|--------|------|-------|--------|
| 🔍 **Bug Triager** | `research` (read-only) | Riproduce bug: legge file coinvolti, grep codebase, verifica schema, identifica root cause, propone fix con diff | Su segnalazione bug **E a fine di ogni sessione di sviluppo** (scansione automatica file toccati) |
| 🔧 **Bug Fixer** | `self` (write) | Applica fix proposto dal Triager, esegue `npm run build`, aggiorna test | Dopo diagnosi Triager + validazione direzione da Gabriele |
| 🛡️ **Security Auditor** | `research` (read-only) | Audit: RLS (`user_owns_condominio`), signed URL vs `getPublicUrl`, segreti hardcoded, `claude-proxy` injection/bypass, CORS, `console.log` di dati sensibili | Su richiesta o in sessione dedicata. **Mai write**, solo report |
| 📚 **Knowledge Keeper** | `self` (write) | Aggiorna `AGENTS.md` e skill `condoai` con decisioni, bug risolti, fatti verificati | A fine sessione significativa |
| 🧪 **Regression Tester** | `self` (write) | Crea/aggiorna test regressione, esegue smoke test (`npm run smoke`) | Dopo ogni fix, prima del commit |

### Regole di parallelismo
- **Bug Triager + Security Auditor** → parallelo OK (entrambi read-only).
- **Bug Fixer → Regression Tester** → sequenziali (tester dipende dal fix).
- **Knowledge Keeper** → sempre per ultimo, a sessione chiusa.
- Per task complessi: fino a 2 sub-agent `self` in parallelo su file diversi.

---

## GDPR / Privacy / Segreti (PERMANENTE)

### Regole operative
1. **DB di produzione** → mai query dirette senza autorizzazione esplicita di Gabriele. Per debug usare `EXPLAIN` o query aggregate anonimizzate (`SELECT count(*)`).
2. **File `.env` / `.env.local`** → non leggerli mai di default. Se serve una variabile, chiedere il nome e il formato, non il valore.
3. **Dati personali nei log** → nel codice, non loggare mai CF, IBAN, nomi completi via `console.log`. Falla nota da risolvere nella sessione di hardening.
4. **Segreti nel repo** → verificare che `.gitignore` copra `.env*`. Se trovati segreti nel codice, segnalare immediatamente.
5. **Contesto agente** → evitare di caricare dump completi di tabelle con dati reali. Usare dati fittizi quando possibile.
6. **Minimizzazione (Art. 5.1.c GDPR)** → l'agente accede solo ai dati strettamente necessari per il task corrente.

### Da fare pre-produzione multi-tenant
- DPIA (Data Protection Impact Assessment) per trattamento con AI
- DPA con Supabase, Anthropic, Stripe, Resend
- Informativa privacy condòmini (art. 13/14 GDPR)
- Registro trattamenti (art. 30 GDPR)
- Nomina sub-responsabili (art. 28 GDPR)
- Soft delete + cascade policy per diritto all'oblio (art. 17)
- Export strutturato completo per portabilità (art. 20)

---

## Output / Finestra di contesto (PERMANENTE)
- A fine di **ogni risposta** mostrare `[CTX: ~XX%]`.
- Segnalare quando conviene aprire nuova sessione (~65%).

---

## Memoria / Conoscenza (PERMANENTE)
- Mantenere e aggiornare in continuo questo file (`AGENTS.md`) e lo skill `condoai`.
- A ogni decisione, fatto verificato (firme, colonne DB, contratti) o bug risolto → registrarlo qui.
- **Non comprimere né rimuovere fatti storici.**

---

## Convenzioni di commit
- Messaggi in italiano
- Formato: `S{N} step{M}: descrizione breve delle modifiche`
- Esempio: `S10 step1: implementa solleciti Resend + template email + hook useComunicazioni`

## Indice contesto
Aggiungere a fine di ogni risposta un **indice di contesto** con:
- Elementi caricati in contesto
- Stato del lavoro corrente
- % stimata di utilizzo del contesto
- Prossimi step

## Struttura file
- Componenti React: `src/components/NomeComponente.jsx`
- Pagine: `src/pages/NomePage.jsx`
- Hook: `src/hooks/useNome.js`
- Utility: `src/lib/nomeFile.js`
- SQL: `sql/nome_script.sql`
- Edge Functions: `supabase/functions/nome-funzione/index.ts`

---

## Storico Decisioni e Fatti Verificati della Sessione S10 (30 Giugno 2026)

### 1. Decisioni sul Workflow Agentico
- **Orchestrazione a 5 ruoli** (Bug Triager, Bug Fixer, Security Auditor, Knowledge Keeper, Regression Tester) concordata.
- **Bug Triager** abilitato per scansione automatica a fine sessione.
- **Normativa GDPR / Privacy**: integrata checklist pre-produzione multi-tenant e 6 regole operative per la minimizzazione dei dati personali e dei segreti.
- **Confronto preventivo**: confermata convenzione per cui `differenza = preventivo - consuntivo` e un valore positivo indica un risparmio per il condominio.
- **Coerenza Nomi Sezioni**: concordato l'adeguamento delle sezioni A→E tra lo skill `condoai` e il codice (UI e PDF).

### 2. Bug Risolti
- **Formula calcolo arretrati (useConsuntivo.js)**: gli arretrati del piano rateale ora sottraggono correttamente l'eventuale credito iniziale pregresso dell'unità, evitando importi falsati per chi aveva pagato in eccedenza nell'anno precedente.
- **Banner modello (ConsuntivoTab.jsx)**: risolto bug per cui il banner mostrava sempre "profilo amministratore" anche se `template` era nullo, a causa di un controllo errato `template === undefined` (il hook inizializza a `null`). Ora rileva correttamente l'assenza del template.
- **Segno meno nei calcoli (UI e PDF)**: sostituito il carattere speciale en-dash `−` con il meno standard `-` per evitare disallineamenti di rendering del font e garantire che la formattazione dei conguagli negativi (rossi) avvenga in modo affidabile tramite `String(raw).includes('-')`.
- **Dettaglio Spese Ordinarie/Straordinarie in UI**: allineata la UI al PDF, mostrando separatamente i totali parziali delle spese ordinarie e straordinarie nella sezione A del consuntivo.

### 3. Fatti Verificati sul Database
- **Tabella `unita`**: non ha la colonna `interno` (usa `scala` come campo di testo) e usa `mq` per la superficie.
- **Tabella `occupanti_unita`**: non ha `tipo` né `data_inizio` (usa `ruolo` come testo, `attivo` come boolean, e `persona_id`).
- **Tabella `millesimi_unita` e `rate`**: non hanno la colonna `created_at` o ne demandano la gestione interamente al database. Lo script `sql/seed_e2e_consuntivo.sql` è stato corretto per rimuovere questi campi ed è stato eseguito con successo per il collaudo E2E.
- **Autenticazione**: l'UUID dell'amministratore per il seed è stato validato con successo contro `auth.users`.

---

## Storico Decisioni e Fatti Verificati della Sessione S11 (30 Giugno 2026)

### 1. Decisioni sulla Sicurezza e Architettura
- **Signed URL temporanei**: Rimosso l'uso di `getPublicUrl` per le fatture e gli F24 caricati in `FattureFornitoriPage.jsx` per evitare l'esposizione pubblica o non autorizzata di documenti sensibili (GDPR / Privacy).
- **Retrocompatibilità allegati**: Implementato il fallback per gli URL storici/di test completi (inizianti per `http`/`https`) memorizzati in `pdf_url` o `f24_url`, consentendo la loro apertura diretta, mentre per i nuovi record viene salvato e gestito unicamente il path relativo del bucket Supabase Storage.
- **Architettura Comunicazioni (Resend)**: Creata la tabella `comunicazioni` con granularità a singolo destinatario (1 record per persona) per tracciare lo stato dell'invio in modo atomico. Configurato l'invio con `reply_to` impostato sull'email reale dell'amministratore, bypassando le limitazioni di Resend sui domini non verificati.
- **Conguaglio Dinamico in Solleciti**: Implementato il calcolo automatico della situazione finanziaria dell'unità del condomino (dovuto, pagato, insoluto, importo scaduto) da inserire nel template del sollecito rata.

### 2. Bug e Vulnerabilità Risolti
- **Vulnerabilità getPublicUrl**: Sostituita l'esposizione degli URL pubblici completi con signed URL a tempo (scadenza a 15 minuti) autogenerati al momento del click del link "📄 File" o "📎 F24".
- **Gestione blocco popup**: Risolto il problema del blocco popup del browser causato dalla generazione asincrona del link firmato effettuando l'apertura sincrona preliminare di un tab vuoto (`about:blank`) poi reindirizzato.
- **Mancato upload immagini fatture**: Corretto il bug per cui solo i PDF e DOCX venivano caricati fisicamente su storage (le immagini venivano analizzate dall'AI ma non salvate).
- **Leak popup vuoto**: Risolto il potenziale leak di popup vuoti in caso di eccezioni di rete durante la generazione del signed URL.
- **Crash rendering date**: Introdotto l'helper `formattaData` per evitare crash fatali nel rendering in caso di date non valide o malformate estratte dall'AI.

### 3. Fatti Verificati sul Database
- **Campi pdf_url e f24_url**: Nel database la tabella `fatture_fornitori` accetta e memorizza indifferente URL assoluti completi o path relativi nel bucket.
- **Tabella comunicazioni**: La nuova tabella `comunicazioni` è protetta da RLS basate su `amministratore_id` e `user_owns_condominio(condominio_id)`.
