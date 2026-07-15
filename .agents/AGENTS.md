# Regole Progetto CondoSmart

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
- **Solleciti Rapidi da Griglia Rate**: Integrati solleciti rapidi con 1 clic direttamente nella modale cella rata (dettaglio pagamento quota) e introdotte le "Proposte di Sollecito Consigliate" (con banner e modale riassuntiva) per le rate scadute da oltre 10 giorni (principio "Propone → conferma").
- **Aggiornamento Simultaneo Anagrafica da Rate**: Abilitata la modifica dei dati anagrafici dei condòmini direttamente dalla modale delle rate (`CellEditor`) con allineamento istantaneo del DB (`persone`) e della griglia rate.
- **Tab Anagrafica locale nel Condominio**: Aggiunto un tab dedicato alla gestione anagrafica esclusiva del condominio corrente (`AnagraficaCondominioTab.jsx`) con filtri per ruolo e modale di modifica rapida.
- **Anagrafica Globale Multi-Condominio**: Riconfigurata la pagina `/anagrafica` della sidebar globale per implementare una visione complessiva di tutti i condomini (ad accordion) integrata con una barra di ricerca superiore per l'individuazione e l'editing istantaneo di qualsiasi condomino del sistema.
- **Campi Fiscali Profilo Amministratore**: Aggiunte le colonne `ragione_sociale`, `partita_iva` e `codice_fiscale` alla tabella `profiles` (tramite `sql/s11_profile_fields.sql`). I campi sono sincronizzati nel form Drawer (`AppLayout.jsx`), in `ImpostazioniPage.jsx` e vengono stampati nell'intestazione del PDF consuntivo (`exportConsuntivo.js`).

### 2. Bug e Vulnerabilità Risolti
- **Vulnerabilità getPublicUrl**: Sostituita l'esposizione degli URL pubblici completi con signed URL a tempo (scadenza a 15 minuti) autogenerati al momento del click del link "📄 File" o "📎 F24".
- **Gestione blocco popup**: Risolto il problema del blocco popup del browser causato dalla generazione asincrona del link firmato effettuando l'apertura sincrona preliminare di un tab vuoto (`about:blank`) poi reindirizzato.
- **Mancato upload immagini fatture**: Corretto il bug per cui solo i PDF e DOCX venivano caricati fisicamente su storage (le immagini venivano analizzate dall'AI ma non salvate).
- **Leak popup vuoto**: Risolto il potenziale leak di popup vuoti in caso di eccezioni di rete durante la generazione del signed URL.
- **Crash rendering date**: Introdotto l'helper `formattaData` per evitare crash fatali nel rendering in caso di date non valide o malformate estratte dall'AI.
- **Crash CellEditor destructuring**: Corretto un crash fatale in `CellEditor` dovuto a props mancanti nel destructuring del componente.
- **Rate a zero dovuto in solleciti**: Risolto un bug logico per cui le rate con dovuto a zero (es: box non partecipanti) venivano considerate "scadute" ed incluse erroneamente tra le proposte di sollecito.
- **Alert seriali invio massivo**: Eliminata la cascata di alert sincroni bloccanti durante gli invii massivi dei solleciti dalla modale di riepilogo.
- **Vulnerabilità IDOR e Auth Stripe**: Sostituite le chiamate `fetch` manuali con `supabase.functions.invoke()` in `AppLayout.jsx` e `ImpostazioniPage.jsx`, risolvendo un potenziale IDOR e il mancato invio dell'header di autorizzazione (fix di Bug Triager & Bug Fixer).

### 3. Fatti Verificati sul Database
- **Campi pdf_url e f24_url**: Nel database la tabella `fatture_fornitori` accetta e memorizza indifferente URL assoluti completi o path relativi nel bucket.
- **Tabella comunicazioni**: La nuova tabella `comunicazioni` è protetta da RLS basate su `amministratore_id` e `user_owns_condominio(condominio_id)`.
- **Profilo Amministratore (Top-Right Drawer)**: Implementato un Drawer laterale a comparsa da destra per ospitare tutte le informazioni dell'amministratore (piano attivo, consumi AI, dettagli account e branding studio).
- **Gestione Stato Condiviso (React Context)**: Implementata la condivisione dello stato globale del piano/profilo tramite il nuovo `PlanProvider` in `usePlan.js` (risolvendo il disallineamento del branding tra Drawer e pagina Impostazioni, ed eliminando le query duplicate su Supabase al caricamento dell'app).
- **Rimozione JSX da file .js**: Risolto errore di build Vite/Rolldown escludendo la sintassi JSX all'interno di `usePlan.js` tramite l'utilizzo diretto di `React.createElement`.
- **Allineamento Timezone UTC per AI log**: Risolto potenziale bug di conteggio basato sulla timezone locale impostando la query gte su timestamp UTC di inizio mese.

---

## Storico Decisioni e Fatti Verificati della Sessione S13 (30 Giugno 2026)

### 1. Sviluppo Backoffice e Assistenza
- **Protezione Rotte (SuperAdminGuard):** Introdotto il concetto di SuperAdmin (gestore del SaaS) tramite il campo `is_superadmin` nella tabella `profiles`. Le rotte di backoffice (es. `/backoffice`) sono protette da questo flag.
- **Gestione RLS per SuperAdmin:** Per evitare loop di RLS su `profiles`, è stata creata la funzione PostgreSQL `SECURITY DEFINER` `public.is_superadmin(uuid)`. Questo permette ai SuperAdmin di leggere tutti i profili e gestire globalmente le risorse, mantenendo l'isolamento per gli utenti standard.
- **Gestione Ticket (AssistenzaPage e BackofficePage):**
  - Creato uno schema DB (`tickets_assistenza`) per tracciare i ticket inviati dagli amministratori di condominio.
  - Sostituito il form dummy in `AssistenzaPage` con l'invio reale al database e la visualizzazione dello storico per l'utente, incluse le eventuali risposte.
  - Creato il pannello `/backoffice` per visualizzare tutti gli utenti (con il loro piano e stato), e per rispondere direttamente ai ticket (inserendo la risposta e segnandoli come 'chiuso').
- **Nessun Invio Email Automatico dai Ticket per MVP:** La risposta inserita dal backoffice viene salvata sul DB e resa visibile istantaneamente nell'app (nella pagina Assistenza dell'utente), delegando un eventuale inoltro via email a implementazioni successive in base a come evolverà l'IA chatbot.

---

## Storico Decisioni e Fatti Verificati della Sessione S14 (30 Giugno 2026)

### 1. Decisioni sulla Sicurezza e Normativa
- **DPA e Termini di Servizio:** Inserito un sistema di doppio checkbox nel signup per l'accettazione obbligatoria del DPA (Data Processing Agreement) e dei Termini/Privacy.
- **Assicurazione:** Approvato il piano di sottoscrivere un'assicurazione RC Professionale / Cyber.

### 2. Bug e Vulnerabilità Risolti
- **JWT Signature Bypass in `claude-proxy`:** L'edge function ora estrae l'utente crittograficamente validando il token via `supabase.auth.getUser()`, chiudendo l'uso non autorizzato dei crediti Anthropic.
- **Vulnerabilità IDOR in `stripe-checkout`:** Il checkout convalida l'ID dell'utente dal JWT (via `auth.getUser()`) invece di fidarsi ciecamente dei parametri `userId` inviati dal client.
- **Data Leak / GDPR:** Rimossi log sensibili (email in `invia-comunicazione` e dettagli admin in `AppLayout.jsx`).

---

## Storico Decisioni e Fatti Verificati della Sessione S15 (30 Giugno 2026)

### 1. Sviluppo Chatbot Assistenza
- **Chatbot AI in Assistenza:** Il form ticket statico in `AssistenzaPage` è stato rimosso e sostituito con una Chatbot AI UI interattiva (che conosce la mappa del sito CondoSmart).
- **Conversione in Ticket (Fallback automatico):** Introdotto un meccanismo che permette all'utente di convertire l'intera conversazione col chatbot in un ticket formale se l'IA non ha risolto il problema. Durante la conversione, l'AI genera in background ("in silente") un titolo riassuntivo per il ticket.
- **Privacy e GDPR (Log Chat):** Le trascrizioni delle chat vengono inviate in backoffice nella nuova tabella `chat_assistenza_logs` (tramite script `sql/s14_chat_logs.sql`). La RLS su questa tabella è ristretta per permettere la lettura solo ai superadmin. È stata inoltre implementata una policy di auto-eliminazione (soft/hard purge) a 30 giorni per minimizzare la ritenzione dei dati.

---

## Storico Decisioni e Fatti Verificati della Sessione S16 (1 Luglio 2026)

### 1. Decisioni sul Workflow e Riconciliazioni
- **Workflow Riconciliazione Ibrido (Opzione 3):** Implementato un sistema di avviso per flussi in entrata/uscita non riconciliati con Pop-up post analisi AI + Badge/Tab dedicate sia nel modulo Uscite (`RiconciliazioniPage.jsx`) che nel modulo Incassi (`RiconciliazioniIncassiPage.jsx`).
- **Inserimento Rapido e Precompilazione:** Il salvataggio di una spesa da un movimento bancario orfano utilizza il passaggio di stato via React Router (`location.state.prefillSpesa`) verso `SpesePage.jsx`, dove `SpeseForm.jsx` autocompila importo, data, descrizione e fornitore. Per gli incassi orfani, è stato implementato un abbinamento manuale rapido con un clic su tendina alle rate aperte del condominio.
- **Saldo Finale Conto in Panoramica:** Il saldo finale dell'estratto conto c/c con relativa data viene ora indicato ed esposto in evidenza sia nei KPI e nella scheda "Panoramica" del condominio (`CondominiDetailPage.jsx`, sezione "Fondo Cassa & Conto Corrente"), sia come KPI principale nella pagina `EstrattoContoPage.jsx`, con formattazione date sicura (`formattaData`).

### 2. Bug e Regressioni Risolti (Fix Bug Triager)
- **Gestione Errori su Scritture DB Multiple:** Avvolti i blocchi di aggiornamento di stato e abbinamento in `RiconciliazioniPage.jsx` e `RiconciliazioniIncassiPage.jsx` all'interno di costrutti `try/catch` con verifica puntuale di `.error` per prevenire stati parziali o disallineati sul DB in caso di fallimenti di rete o RLS.
- **Validazione Ripartizioni Vuote (`SpeseForm.jsx`):** Introdotto il controllo `ripartizioni.length === 0` nel validatore del form per impedire il salvataggio su Supabase di spese prive di quote ripartite nel caso di tabelle millesimali vuote o a zero. Aggiunta inoltre la dipendenza `unita` all'hook di ricalcolo automatico.
- **Riapertura Modale da History Router (`SpesePage.jsx`):** Implementata la pulizia immediata dello stato del router tramite `window.history.replaceState({}, '')` al consumo di `prefillSpesa`, evitando la riapertura involontaria della modale di creazione spesa al cambio di esercizio contabile.
- **Formattazione Date Sicura:** Esteso l'utilizzo di helper protetti per le date (`formattaData` e `dataIt`) in tutti i nuovi componenti e modali per prevenire crash di rendering in presenza di date nulle o malformate dal database.

---

## Storico Decisioni e Fatti Verificati della Sessione S17 (1 Luglio 2026)

### 1. Gestione Documentale ed Estratto Conto
- **Conservazione e Download Estratto Conto (Opzione 1):** Implementato il salvataggio fisico del file estratto conto caricato su Supabase Storage nel bucket `documenti-condominio` sotto il tipo speciale `'estratto_conto'` in `documenti_condominio`. Questo garantisce sicurezza e conformità GDPR grazie ai Signed URL temporanei (15 minuti) autogenerati al click su "📄 Scarica File", senza necessità di alterare lo schema del database.
- **Badge Periodo e Apertura Sicura in Testata:** Aggiunto un badge dedicato accanto all'intestazione `<h1>` di `EstrattoContoPage.jsx` che mostra le date di copertura del file (es. `📅 ESTRATTO CONTO (01/01/2026 – 30/06/2026)`). L'apertura del documento utilizza il pattern anti-popup blocker (`window.open('about:blank', '_blank')` sincrono) allineato a S11.
- **Archiviazione Automatica Estratti Conto (Nessuna Eliminazione):** Abolita l'eliminazione dei file estratto conto in caso di nuovi upload o sostituzioni parziali/mensili. Ogni nuovo file caricato in `EstrattoContoPage.jsx` diventa il documento attivo da scaricare nella sezione omonima (`tipo = 'estratto_conto'`). L'eventuale file precedente viene trasformato e archiviato automaticamente nei Documenti del Condominio cambiando tipo in `estratto_conto_archivio` e arricchendo il nome con le date di copertura (es. `Estratto Conto (01/01/2026 - 31/03/2026) [Archiviato]`).
- **Categoria Dedicata in Documenti (`DocumentiCondominio.jsx`):** Introdotta la nuova categoria **"🏛️ Estratti Conto (Archivio)"** (`estratto_conto_archivio`) per consultare, scaricare o filtrare facilmente tutto lo storico degli estratti conto archiviati nella scheda Documenti del condominio. Il file attivo principale (`estratto_conto`) è stato escluso dalla visualizzazione generica della scheda Documenti per evitare duplicati.
- **Hardening Anti-Popup Blocker in Documenti:** Allineato il metodo di apertura `handleOpen` in `DocumentiCondominio.jsx` al pattern sincrono preliminare (`about:blank`), conformandolo a S11 e S17.

### 2. Audit e Fix Slot di Caricamento File (9 Slot totali)
- **Censimento e Collaudo Canonicità:** Eseguito audit approfondito di tutti i 9 slot di upload/caricamento file presenti nell'applicazione (`AnagraficaImport`, `AppLayout`, `ConsuntivoTab`, `DocumentiCondominio`/`useDocumenti`, `SaldiInizialiTab`, `SpeseForm`, `EstrattoContoPage`, `FattureFornitoriPage`, `ImpostazioniPage`).
- **Fix Estrazione Testo PDF in Documenti (`useDocumenti.js`):** Corretto un bug critico per cui l'estrazione testo dei PDF caricati in `DocumentiCondominio` falliva silenziosamente a causa dell'uso errato di un oggetto come primo argomento di `callClaude` e dell'opzione `max_tokens` (invece di `maxTokens`). Sostituito con la chiamata canonica `callClaudeDocument`. Aggiunto `.toLowerCase()` all'estrazione dell'estensione per prevenire errori con nomi file come `.PDF`.
- **Sostituzione Parser Locale in Anagrafica (`AnagraficaImport.jsx` & `fileExtractor.js`):** Sostituito il parser AI locale buggato (che usava `callClaudeWithHistory` andando in crash con i PDF a causa della sanitizzazione degli array di oggetti, e tentava di leggere file `.docx` come testo grezzo via FileReader) con la nuova funzione centralizzata `estraiAnagraficaDaFile` esportata da `fileExtractor.js`. Ora l'importazione supporta nativamente e senza errori PDF, DOCX, XLSX, CSV e Immagini (JPG, PNG, WEBP). Aggiunta inoltre la guardia difensiva per fogli Excel vuoti e visualizzazione/editing del `codice_fiscale` nello step di preview.
- **Robustezza AI e MIME Type:** Aggiunto il controllo preliminare di sicurezza `validaMimeType` e `maxTokens: 3000` alle estrazioni strutturali in `fileExtractor.js`.

---

## Storico Decisioni e Fatti Verificati della Sessione S18 (1 Luglio 2026 - Archiviazione Estratti Conto e Passaggio di Consegne)

### 1. Decisioni di Prodotto e Normative
- **Archiviazione Automatica Estratti Conto:** Nessuna eliminazione al caricamento di un nuovo file; i vecchi estratti diventano `'estratto_conto_archivio'` visibili nell'apposita categoria del cassetto documenti.
- **Esportazione Massiva Passaggio di Consegne (Art. 20 GDPR / Artt. 1129, 1130, 1130-bis, 1138 c.c.):** Implementato pulsante nella parte inferiore della scheda Panoramica del condominio per scaricare un archivio `.zip` strutturato.
- **Checklist Normativa e Revisore AI:** Implementato controllo pre-download che verifica anagrafica, regolamento (>10 condòmini), tabelle millesimali, verbali e rendiconto/estratti conto bancari, mostrando spunte verdi o avvisi in tempo reale.
- **Libreria JSZip:** Autorizzata e installata la libreria standard `jszip` per la compressione client-side dei documenti di archivio da Supabase Storage insieme al Super-File Excel Multifoglio.

### 2. Bug Risolti
- **Query su `persone`:** Risolto bug di query su `persone` (mancata colonna `condominio_id`, ora usa join su `occupanti_unita!inner`).
- **Saldi iniziali:** Risolto bug su saldi iniziali (sostituita tabella inesistente con calcolo su `saldi_iniziali_unita` e `rate_unita`).
- **Esercizio spese nell'export Excel:** Risolto bug su esercizio spese nell'export Excel aggiungendo la join su `esercizi(anno, nome)`.
- **Anagrafica unità:** Allineamento lettura relazionale `o.persone` nell'anagrafica unità.

---

## Storico Decisioni e Fatti Verificati della Sessione S19 (1 Luglio 2026 - Importazione Anagrafica da Scheda Condominio)

### 1. Decisioni sul Workflow e UI
- **Importazione AI in Scheda Condominio Locale (`AnagraficaCondominioTab.jsx`):** Aggiunto il pulsante **"📂 Importa"** direttamente nella barra strumenti della scheda locale "Anagrafica" del singolo condominio, eliminando la necessità di recarsi nella sezione globale `/anagrafica` per caricare file storici.
- **Supporto Esplicito Formati Excel e Word:** Aggiornata la UI e i messaggi di validazione in `AnagraficaImport.jsx` per esplicitare e garantire il supporto a file **Excel (XLSX, XLS)**, **Word (DOCX)**, **PDF** e **CSV**, rendendo immediata la comprensione dei formati caricabili dall'amministratore.

### 2. Bug e Regressioni Risolti (Fix Bug Triager)
- **Abbinamento Automatico Unità e Zeri Iniziali (`handleImport`):** Migliorato l'algoritmo di confronto e auto-mapping tra la stringa `unita` estratta dall'AI o da Excel e le unità del database nel condominio corrente. Aggiunta la rimozione degli zeri iniziali (`replace(/^0+/, '')`) e l'uguaglianza numerica (`Number(cleanNum) === Number(cleanStr)`), consentendo di abbinare correttamente i condòmini anche quando i formati numerici differiscono tra DB (es. `"1"`) e file sorgente (es. `"01"`, `"001"`, `"1.0"`).
- **Protezione da Errori di Parsing in `normalizeRows`:** Aggiunto il fallback difensivo `normalizeRows(raw || [])` in `AnagraficaImport.jsx` per prevenire eccezioni di tipo `Cannot read properties of null` nel caso in cui l'estrazione AI o il parser restituiscano un risultato nullo.

---

## Storico Decisioni e Fatti Verificati della Sessione S20 (1 Luglio 2026 - Riconoscimento Tabelle Millesimali in Spesa)

### 1. Decisioni e Allineamento Funzionale
- **Inclusione Documenti Normativi nel Prompt AI (`SpeseForm.jsx`):** Il suggerimento AI sul criterio di ripartizione e sulla tabella consigliata ora trasmette il testo estratto da tutti i documenti di tipo `regolamento`, `tabella_millesimale_doc`, `verbale`, `contratto` e `altro`, superando il precedente limite che inviava solo i file di tipo regolamento.
- **Supporto Estrazione Testo DOCX in Cassetto Documenti (`useDocumenti.js`):** Abilitata l'estrazione automatica del testo (via `docxToText` in `fileExtractor.js`) anche per i file Word (`.docx`) al momento del caricamento nei documenti condominiali, allineando il comportamento reale al messaggio guida della UI.
- **Avvisi Proattivi e Fallback:** Inserito in `SpeseForm.jsx` un avviso nella modale AI se l'AI raccomanda una tabella citata nei documenti ma questa non è ancora stata creata in archivio (sezione Millesimi), informando l'amministratore sullo step preliminare necessario per ripartire le quote.

### 2. Bug e Regressioni Risolti (Fix Bug Triager & Bug Fixer)
- **Fuzzy Matching Prioritario per Tabelle (`trovaTabellaFuzzy`):** Risolto un bug critico di matching in cui la ricerca per parole significative valutava simultaneamente in una singola clausola OR sia la presenza di *tutte* le parole che di *almeno una* parola, portando `.find()` a restituire un match parziale errato anziché un match esatto successivo. Separatala la logica in due passaggi ordinati per priorità: prima corrispondenza completa (`every`), poi parziale (`some`). Introdotto inoltre il fallback automatico in caso di unica tabella millesimale presente in archivio per i criteri a millesimi o misti.
- **Hint Visivi Caricamento File (`DocumentiCondominio.jsx`):** Estesi i badge e i consigli visivi sull'estrazione del testo AI ai file di categoria `tabella_millesimale_doc`.

---

## Storico Decisioni e Fatti Verificati della Sessione S21 (1 Luglio 2026 - Riconoscimento Tabelle Documenti e Fix Anagrafica)

### 1. Decisioni sul Workflow e UI
- **Integrazione Diretta Tabelle da Documenti (`SpeseForm.jsx`):** I documenti caricati nella sezione "Documenti" con tipo `tabella_millesimale_doc` vengono ora fusi dinamicamente nell'elenco del selettore del modulo spesa (`tabelleAssociate`), rendendoli immediatamente selezionabili senza dover prima creare manualmente il record strutturato in archivio.
- **Strutturazione Automatica 1-Clic via AI:** Aggiunto un banner interattivo in `SpeseForm.jsx` quando si seleziona una tabella da Documenti o priva di valori millesimali. Con un clic sul pulsante **"⚡ Struttura automaticamente con AI e Salva"**, l'AI analizza il documento (o scarica il PDF/Excel dallo storage e lo converte in base64 via `fileToBase64`), associa i millesimi alle unità del condominio e crea le righe in `tabelle_millesimali` e `millesimi_unita`, aggiornando istantaneamente il selettore e le quote ripartite.
- **Mapping Unità e Ruoli in Anagrafica Globale (`AnagraficaPage.jsx`):** Estesa ad `AnagraficaPage.jsx` la stessa logica di fuzzy matching per le unità (`unita_id`) e pulizia dei ruoli presente nel tab locale, garantendo che le unità riconosciute durante l'import vengano collegate regolarmente al condominio.

### 2. Bug e Regressioni Risolti (Fix Bug Triager & Bug Fixer)
- **Rimozione Colonne Inesistenti da `occupanti_unita` (`usePersone.js`, `useUnita.js`, `ConfigPagantePage.jsx`, `RipartizionePage.jsx`, `AggiornamentoAnagrafica.jsx`):** Rimosse tutte le query SQL (SELECT, INSERT, UPDATE) che tentavano di leggere o scrivere le colonne non esistenti nello schema reale (`data_inizio`, `data_fine`). In `assegnaPersona`, la cessazione del vecchio occupante e l'inserimento del nuovo avvengono in modo atomico su `{ unita_id, persona_id, ruolo, attivo }`, risolvendo i crash silenziosi o 400 Bad Request di PostgREST durante l'assegnazione anagrafica.
- **Standardizzazione Fallback Ruolo (`exportXlsx.js`):** Uniformate le verifiche degli occupanti per supportare `(o.ruolo === 'proprietario' || o.tipo_occupante === 'proprietario') && o.attivo !== false`.
- **Firme Canoniche AI in `SpeseForm.jsx`:** Corretto l'ordine invertito degli argomenti in `callClaudeDocument(prompt, base64, opts)`, convertito il Blob scaricato da Supabase in base64 tramite `fileToBase64`, e corretta la chiamata a `callClaude` rimuovendo l'argomento array vuoto che invalidava il parametro `maxTokens`.
- **Ordinamento su Colonna Reale (`DashboardFinanziaria.jsx`):** Corretto errore difensivo rilevato dal Bug Triager sulla query delle spese, sostituendo la colonna inesistente `.order('data_competenza', ...)` con `.order('data_spesa', ...)`.

---

## Storico Decisioni e Fatti Verificati della Sessione S22 (1 Luglio 2026 - Risoluzione Persistenza e Creazione Unità in Anagrafica)

### 1. Decisioni sul Workflow e Anagrafica
- **Creazione Automatica Unità Mancanti su Importazione (`AnagraficaCondominioTab.jsx`, `AnagraficaPage.jsx`):** Quando si importa un file di anagrafica (Excel/Word/PDF) con l'elenco delle persone e delle relative unità immobiliari (es. Interno 1, A1, Box 2), se l'unità non è ancora censita nel database del condominio, il sistema ora **crea automaticamente l'unità su Supabase** prima di importare la persona, determinando il tipo (appartamento, box, cantina, negozio, ufficio) dalla dicitura. In questo modo le unità del file vengono sempre create e salvate nel condominio e i residenti vengono abbinati istantaneamente senza che vadano persi i collegamenti (`unita_id`).
- **Sanitizzazione Pre-salvataggio e Sicurezza Tipi (`useUnita.js`):** Aggiunto l'helper `cleanUnitaPayload` in `createUnita` e `updateUnita`. Rimuove preventivamente campi non appartenenti allo schema di `unita` (come `millesimi`, che risiedono su `millesimi_unita`) e converte in modo sicuro `piano` e `mq` in numeri interi o decimali, eliminando qualsiasi rischio di errore `400 Bad Request` da parte di PostgREST durante la creazione o modifica manuale delle unità.

---

## Storico Decisioni e Fatti Verificati della Sessione S23 (1 Luglio 2026 - Standardizzazione Tabelle Millesimali e Fix Bug Triager)

### 1. Decisioni sul Workflow e UI (Formato Standard CondoSmart)
- **Formato Standard Universale CondoSmart (`MillesimiEditor.jsx`):** Definito un formato standard a 6 colonne (`Interno/Subalterno`, `Piano`, `Destinazione d'uso`, `Superficie mq`, `Proprietario`, `Colonne Millesimali`) per l'importazione e la gestione delle tabelle millesimali in modo immediato senza la complessità dei fogli catastali ufficiali.
- **Modello Excel/CSV Scaricabile e Aggiunta Manuale:** Aggiunto in `MillesimiEditor.jsx` il pulsante **"📋 Modello Standard (.csv)"** per scaricare un template precompilato (`Modello_Standard_Millesimi_CondoSmart.csv`), un banner esplicativo nella modale di importazione, e il pulsante **"➕ Aggiungi Riga"** per creare al volo nuove unità abitative direttamente dall'editor millesimi senza cambiare scheda.

### 2. Bug e Regressioni Risolti (Fix Bug Triager & Bug Fixer)
- **Arrotondamento in Distribuzione Equa (`distribuisciEquamente`):** Corretta la formula di calcolo quota e resto dell'ultima unità su base arrotondata a 2 decimali (`parseFloat((1000 / unita.length).toFixed(2))`), evitando che la somma finale su condomini non divisibili per 1000 (es. 6 unità) risulti diversa da 1000 (es. 1000.02) mandando in blocco di validazione la tabella.
- **Falsy Zero in Piano Terra (`salva`):** Risolto il bug per cui l'espressione `piano: u.piano || null` valutava `0` (Piano Terra) come falsy sovrascrivendolo con `NULL` sul database; sostituito con verifica esplicita `(u.piano === 0 || u.piano === '0') ? 0 : ...`. Sostituito inoltre negli input il fallback `|| ''` con il nullish coalescing `?? ''`.
- **Inconsistenze Destinazione d'Uso e Hardening (`parseTipo`, `getNominativo`, `fileExtractor.js`):** Aggiunto il supporto in `parseTipo` per `posto_auto`, `soffitta` e `magazzino`, allineandolo alla select dell'interfaccia. Aggiunta gestione eccezioni esplicita per le chiamate DB asincrone in `salva` e `confermaImport` e hardening su parsing JSON con regex.

---

## Storico Decisioni e Fatti Verificati della Sessione S24 (2 Luglio 2026 - Riprogettazione Editor Millesimi in Modalità Singola Tabella, Storico Proprietari e Subentri)

### 1. Decisioni sul Workflow e Riconciliazioni Parziali
- **Vista Singola Tabella (Opzione B):** Adottato il layout a singola tabella alla volta con sidebar di selezione sinistra. Questo risolve il problema visivo dei condomini parziali (Edificio A / B): le colonne millesimali specifiche non si accumulano in una griglia gigante piena di zeri.
- **Hiding Colonne Strutturali Unità:** Spostate le colonne strutturali e catastali (Piano, Destinazione, MQ/Superficie, Proprietario) in sola lettura per riferimento. La griglia millesimi mostra solo il nome dell'unità, il proprietario e l'input della quota millesimale (‰), separando la definizione delle unità dai calcoli di riparto.
- **Filtri Edificio/Scala e Distribuzione Mirata:** Aggiunto un filtro per Scala (Edificio A/B) estratto dinamicamente dalle unità. La funzione "Distribuisci Equamente" ora distribuisce i 1000 millesimi dividendo per il numero di unità attualmente visibili (filtrate) e azzera automaticamente le unità escluse, facilitando la creazione di tabelle millesimali parziali.
- **Modale Inserimento Rapido Unità:** Per non perdere la comodità di aggiungere unità dall'editor millesimi, è stata introdotta una modale di creazione rapida che esegue l'insert in `unita` raccogliendo Interno, Scala, Piano, MQ e Destinazione.
- **Inline Rename delle Tabelle:** Abilitata la modifica del nome delle tabelle millesimali con un input testuale in-line nel titolo del dettaglio, salvato automaticamente al blur o con il tasto Invio.

### 2. Gestione Registro Storico Proprietari/Inquilini e Subentri con Date
- **Timeline e Subentri con Date:** Aggiunte le colonne `data_inizio` e `data_fine` alla tabella `occupanti_unita` (tramite migrazione SQL `sql/s24_occupanti_unita_dates.sql`). Questa scelta permette di tracciare cronologicamente il possesso di un'unità senza dover sovrascrivere o eliminare i proprietari storici, salvaguardando il riparto delle spese retroattivo.
- **Modale Timeline Condivisa (`StoricoOccupantiModal.jsx`):** Creata una modale timeline comune e riutilizzabile per visualizzare lo storico delle proprietà (attivo + ex) ed inserire un subentro. La modale permette anche di creare un condòmino al volo se non presente in anagrafica.
- **Visualizzazione Differenziata (Millesimi/Anagrafica vs Rate):**
  - **Millesimi Editor & Anagrafica:** Mostrano solo il proprietario attivo per garantire pulizia, con un pulsante orologio `🕒` che apre la modale timeline dello storico.
  - **Rate Grid (RateGridTab.jsx):** Mostra nella colonna Unità la transizione completa dei proprietari con le date di validità (es. `M. Bianchi (fino al 14/05) ➔ G. Russo (dal 15/05)`), fornendo all'amministratore un controllo immediato per la quadratura finanziaria e il conguaglio delle quote.
- **Automazione date nel Hook `usePersone.js`:** Il metodo `assegnaPersona` ora accetta un parametro opzionale `dataInizio` per impostare la data di subentro del nuovo occupante e calcolare in automatico la `data_fine` del precedente occupant (impostandola al giorno prima).

### 3. Bug e Regressioni Risolti (Fix Bug Triager)
- **Warning di Hover/Focus in React Styles:** Rimossi gli attributi non standard `&:hover` e `hover: { color: ... }` dagli oggetti di stile inline React di `MillesimiEditor.jsx` e `StoricoOccupantiModal.jsx`, definendo classi CSS dedicate in `src/index.css` (`.millesimi-sidebar-item:hover`, `.storico-close-btn:hover`, ecc.).
- **Fix Ricerca per Nome in Millesimi Editor:** Sostituito il controllo fallimentare `u.persone?.[0]?.persona?.nominativo` (non conforme al nesting DB reale) con il richiamo dell'helper `getProprietarioLabel(u)` per garantire il corretto funzionamento dei filtri di ricerca testuale per nome del condomino.
- **UX Eliminazione Unità in Anagrafica:** introdotta la conferma di dialogo obbligatoria prima di cancellare un'unità (`handleDeleteUnita`) e racchiuso il blocco asincrono in `try/catch` con messaggi di errore visualizzati via toast in console per evitare crash invisibili (unhandled promise rejection).
- **Hardening Griglia Rate e CellEditor:** Aggiunti blocchi di cattura errori ed eccezioni (`try/catch`) per il recupero dati dei moduli di griglia e optional chaining (`cell?.importo`) in `CellEditor` per prevenire crash fatali nel caso in cui una cella del database non fosse ancora inizializzata.
- **Sanitizzazione e Validazione Tipi (Import Bulk):** Integrata la gestione degli errori delle query Supabase all'interno del metodo di importazione `handleImport` in `AnagraficaPage.jsx`.

---

## Storico Decisioni e Fatti Verificati della Sessione S24 (2 Luglio 2026 - Esercizi Separati Ordinari/Straordinari)

### 1. Decisioni su Ripartizione e Rate Straordinarie
- **Modello ad Esercizi Separati (Opzione 1):** Adottata la suddivisione ordinaria/straordinaria a livello di esercizio. La tabella `esercizi` ha ora la colonna `tipo` (`ordinario` / `straordinario`).
- **Nessun Modifica Consuntivo:** Rifiutato il frazionamento delle colonne ("Dovuto Prop." / "Dovuto Inq.") nella Sezione C del consuntivo per mantenere il bilancio chiaro e comprensibile per i condòmini.
- **Eliminazione Emojis:** Evitato l'uso di emoji per i nuovi badge UI ed elementi grafici aggiunti, sostituendoli con combinazioni cromatiche professionali (blu per ordinario, viola/indaco per straordinario).

### 2. Implementazione e Targeting Reminders
- **Griglia Rate:** Se l'esercizio selezionato è `ordinario` ed è configurato `pagante = 'inquilino'` per l'unità, compare il badge `Pagante: [Nome Inquilino]` (viola) ed i solleciti email vengono reindirizzati all'inquilino con diciture personalizzate (*"in qualità di inquilino pagante"*).
- **Esclusione Inquilini su Straordinario:** Se l'esercizio è `straordinario`, gli inquilini vengono ignorati, la griglia mostra solo i proprietari ed i solleciti vanno a loro.
- **CellEditor Dinamico:** La modale di modifica si adatta al pagante attivo, mostrando a chi andrà la mail di sollecito e caricando l'anagrafica corretta (proprietario o inquilino) per la modifica rapida.

---

## Storico Decisioni e Fatti Verificati della Sessione S25 (2 Luglio 2026 - Risoluzione Bug Estrazione Anagrafica ed Automazione Proprietari Millesimali)

### 1. Decisioni sul Workflow e Estrazione
- **Mappatura Chiavi Deterministica in Import:** Riscritto il parser di normalizzazione delle chiavi in `AnagraficaImport.jsx` abbandonando i rimpiazzi di sottostringhe a cascata (`.replace('mail', 'email')` ecc.) a favore di una mappatura a dizionario esatto. Questo garantisce che email e telefoni estratti dall'AI o presenti nei file Excel non vengano più corrotti in `eemail` o `telefonoono`, azzerando le anomalie di visualizzazione.
- **Prompt Strutturato Millesimi:** Aggiornato il prompt di estrazione millesimi in `fileExtractor.js` separando il nominativo generico in `proprietario_nome` e `proprietario_cognome` con `nominativo_completo` come fallback, migliorando l'analisi dei proprietari e delle pertinenze collegate.
- **Automazione Inserimento Proprietari da Millesimi:** Abilitata la creazione e associazione automatica dei proprietari in `MillesimiEditor.jsx` durante l'importazione delle tabelle millesimali. Se l'unità non ha già un proprietario attivo, CondoSmart cerca la persona nel condominio (evitando duplicati) e la crea se necessario, per poi associarla come proprietario attivo (`occupanti_unita`), eliminando la necessità di inserimento manuale.

---

## Storico Decisioni e Fatti Verificati della Sessione S26 (2 Luglio 2026 - Pannello Diagnostica e Allineamento Millesimi-Anagrafica)

### 1. Decisioni di Prodotto e Architettura
- **Allineamento Asincrono Post-Import:** Rifiutata la mappatura bloccante in fase di importazione file, preferendo uno strumento di diagnostica permanente e flessibile ad accesso asincrono ("Diagnostica & Allineamento").
- **Fondi ed Elimina (Merge) Unità client-side:** Implementata la fusione di due unità (es. duplicati catastali derivanti da import separati) aggiornando in cascata le chiavi esterne per millesimi, occupanti, saldi, rate e spese ripartite prima dell'eliminazione fisica della riga `unita`, evitando migrazioni SQL sul database.

### 2. Funzionalità Rilasciate e Hardening (Fix Bug Triager)
- **Pannello DiagnosticaAllineamento.jsx:** Nuovo modulo inserito come scheda permanente in `MillesimiEditor.jsx`. Rileva ed elenca le unità prive di proprietari attivi (con millesimi compilati) e le persone orfane prive di assegnazioni. Permette collegamenti rapidi a condòmini esistenti o la creazione sul posto.
- **Merge Tool con conservazione dati:** Migliorato l'algoritmo di unione per evitare la perdita silenziosa dei dati finanziari. Se ci sono record concorrenti su rate, saldi iniziali o ripartizioni delle spese per lo stesso esercizio/rata/spesa, il sistema somma matematicamente i valori (importo, pagato, millesimi_usati) aggiornando la cella target anziché eliminare silenziosamente i record.
- **Risoluzione vincoli FK (Riconciliazioni):** Corretto un potenziale crash fatale durante il merge: i pagamenti abbinati in `riconciliazioni_incassi` legati alle rate dell'unità sorgente vengono riorientati alla rata dell'unità target prima dell'eliminazione, impedendo violazioni di chiave esterna.
- **Guardia per Dirty Check:** Aggiunta guardia per `selectedTabellaId === 'diagnostica'` in `isSelectedTableDirty` in `MillesimiEditor.jsx` per evitare controlli inutili su tabelle inesistenti.
- **Creazione Manuale Condòmini locale e globale:** Introdotto il pulsante `➕ Nuovo Condòmino` sia nel tab `AnagraficaCondominioTab.jsx` (localizzato) che nella pagina globale `AnagraficaPage.jsx` (con select condominio -> unità). Consente l'inserimento manuale completo di anagrafica + contatti + residenza con associazione facoltativa all'unità e ruolo, garantendo che i nuovi contatti compaiano istantaneamente nel condominio.
- **Modifica Inline Unità in Griglia Millesimi:** Aggiornato `MillesimiEditor.jsx` per rendere editabili direttamente nella tabella le colonne fisiche dell'unità (Interno/Numero, Scala, Piano, Superficie/Mq) oltre alla quota millesimale. Le modifiche vengono salvate in blocco su database.
- **Calcolo Proporzionale da MQ:** Aggiunto il pulsante `Calcola da MQ` nel piè di pagina della griglia millesimi. Ripartisce automaticamente i 1000 millesimi in proporzione alla superficie (mq) inserita per le unità visibili, facilitando la creazione delle tabelle.

---

## Storico Decisioni e Fatti Verificati della Sessione S28 (9 Luglio 2026 - Collaudo E2E e Registrazione Diretta Spese/Fatture)

### 1. Decisioni di Prodotto e Workflow E2E
- **Flusso Registrazione Diretta Spesa + Fattura:** Introdotta l'opzione in `SpeseForm.jsx` e `SpesePage.jsx` per caricare un file PDF/immagine di fattura direttamente dal form di inserimento spesa. L'AI precompila i campi della spesa e, al salvataggio, il sistema carica il file nel bucket `fatture` di Supabase Storage, cerca il `fornitore_id` per Partita IVA/CF o nome nella rubrica fornitori, e registra in automatico la riga corrispondente in `fatture_fornitori` in stato `'attesa'`, collegandola alla spesa (`spesa_id`).
- **Aumento dei Limiti Token (Claude Proxy):** Innalzato il parametro `maxTokens` da `4000` a `8000` per l'estrazione millesimi ed anagrafica in `fileExtractor.js`. Questo evita che l'output JSON di Claude venga troncato a metà nei condomini con molte unità/righe, azzerando gli errori di validazione del client.
- **Collaudo E2E ed Esito Positivo:** Eseguito con successo un ciclo di test E2E completo tramite il sub-agent `browser` (registrazione account, creazione condominio ed esercizio 2026, importazione millesimi e anagrafica, registrazione spesa con fattura allegata, e verifica badge collegato su Fatture fornitori).

### 2. Bug Risolti
- **Bug Troncamento JSON (Errore Estrazione Tabelle):** Risolto l'errore per cui il caricamento di tabelle millesimali complesse o anagrafiche falliva con il messaggio *"L'AI non ha restituito un formato JSON valido"* a causa del raggiungimento del precedente limite di 4000 token.
- **Upload Allegati in Spese:** Risolto il problema per cui i file associati alle spese non venivano caricati fisicamente su storage e collegati alla fattura in fatture fornitori.


---


---

## Storico Decisioni e Fatti Verificati della Sessione S29 (9 Luglio 2026 - Morosità Massiva, SMTP ed email personalizzate)

### 1. Decisioni sul Mittente Personalizzato & SMTP
- **Supporto multi-canale:** Configurate tre opzioni di invio nella tabella `profiles`: `'sistema'` (fall-back su Resend onboarding), `'smtp'` (connessione diretta a server di posta propri tramite Nodemailer), `'resend_custom'` (utilizzo di chiavi API e mittenti personali di Resend).
- **Hardening dell'Update Profilo:** Rifattorizzato `updateBranding` in `usePlan.js` per aggiornare solo i campi esplicitamente valorizzati (preservando l'SMTP o il Branding studio per evitare la cancellazione dei parametri in caso di aggiornamenti parziali provenienti da moduli separati come il Drawer di layout).
- **Integrazione SMTP in Edge Function:** Aggiornata l'edge function `invia-comunicazione` per importare nativamente `nodemailer` e instradare i messaggi e gli allegati base64 in modo criptato SSL/TLS.

### 2. Funzionalità Rilasciate & Bug Risolti
- **Invio Massivo dei Solleciti:** Integrata la modale `ProposteSollecitoModal` per caricare asincronicamente i condòmini con rate scadute da oltre 10 giorni, consentendo la selezione multipla tramite checkbox, la personalizzazione del template dell'oggetto e del corpo (con placeholder dinamici `{NOME}`, `{UNITA}`, `{CONDOMINIO}`, `{IMPORTO_SCADUTO}`, `{IBAN}`), e la visualizzazione in tempo reale dello stato e del progresso di invio in background.
- **Allegato PDF Lettera di Sollecito:** Creata la funzione `exportSingolaUnitaRatePdfBytes` in `exportPdf.js` per produrre e allegare al sollecito email il PDF della lettera di sollecito dettagliata (con riepilogo contabile e scadenze rateali) per la singola unità morosa.
- **Configurazione IBAN Condominio:** Inserito il campo per la persistenza dell'IBAN nel form di creazione/modifica condominio e risolto un bug di tag JSX non bilanciato in `CondominiForm.jsx`.
- **Filtri Stato Registro:** Aggiunto lo stato `consegnata` ai filtri rapidi in `ComunicazioniPage.jsx` per un monitoraggio accurato degli esiti di recapito.
- **Risoluzione Bug Feedback Destinatario (`RateGridTab.jsx`):** Corretto il messaggio di alert finale per mostrare l'indirizzo email del destinatario effettivo (inquilino o proprietario) anziché quello fisso del proprietario.
- **Mancata Email ed Errore Promise (`RateGridTab.jsx` & `CellEditor`):** Cambiato il flusso in caso di email assente per lanciare un errore ed impedire che la Promise si risolva positivamente, evitando la chiusura involontaria della modale di anagrafica.
- **Ottimizzazione query batch (`RateGridTab.jsx` & `useComunicazioni.js`):** Introdotto il parametro `skipFetch` in `inviaComunicazione` per evitare il ricaricamento seriale ad ogni singolo invio (N+1 query). Lo storico viene ricaricato una volta sola al termine del loop asincrono.
- **Hardening GDPR nei Log (`invia-comunicazione/index.ts`):** Rimossi i riferimenti all'email del condomino in chiaro all'interno dei log `console.error` dell'Edge Function per conformità alle linee guida sulla privacy.
- **Normalizzazione Millesimi-Anagrafiche (`align_millesimi_anagrafica.mjs`):** Sviluppato ed eseguito con successo lo script di diagnostica e fusione automatica. L'algoritmo rileva e accoppia le unità duplicate causate da importazioni con prefissi/suffissi (es. "Sub. 7", "8 (Sub. 8)") normalizzando le stringhe e fondendo in modo sicuro i record relativi a millesimi, occupanti, rate, saldi e riconciliazioni prima di eliminare i duplicati catastali orfani. Tutte le unità abitate/assegnate ora corrispondono al 100% ai millesimi.
- **Canale Spedizione Cartacea e Partner Postale (`ImpostazioniPage.jsx` & `RateGridTab.jsx`):** Rilasciata la gestione dell'invio cartaceo massivo dei solleciti. L'amministratore può selezionare i morosi, definire il canale per unità (con fallback automatico su cartaceo per chi non ha e-mail) ed optare tra:
  - *Stampa manuale:* Scarica un unico file PDF cumulativo multi-pagina (generato in `exportPdf.js` via `exportSollecitiMassiviPdf`) contenente tutte le lettere dei destinatari selezionati.
  - *Partner Postale (opzionale):* Configura API Key e ID Mittente per l'invio fisico via Multidialogo.
- **Risoluzione Bug e Hardening (Feedback Bug Triager):**
  - *CHECK Constraint DB:* Applicato lo script SQL `sql/s29_patch_comunicazioni_tipo.sql` per allargare il vincolo CHECK della tabella `comunicazioni` introducendo il tipo `'sollecito_cartaceo'`, evitando così fallimenti di inserimento log.
  - *Silenziamento Eccezioni API:* Corretta l'Edge Function `invia-comunicazione` per lanciare eccezioni in caso di fallimento HTTP o di rete nelle chiamate API al partner postale, garantendo che lo stato nel DB e i log rispecchino l'errore effettivo.
  - *GDPR nei Log:* Rimossi i riferimenti e dati personali (nomi completi ed indirizzi) dai log `console.log` di tracciamento dell'Edge Function.
  - *Security RLS:* Reso obbligatorio il parametro `condominio_id` nella validazione iniziale dell'Edge Function prima di effettuare le interrogazioni DB protette da RLS, prevenendo potenziali bypass.

---

## Storico Decisioni e Fatti Verificati della Sessione S18 (9 Luglio 2026 - Modulo Fiscale ed Adempimenti Fiscali)

### 1. Decisioni sul Workflow Fiscale ed Adempimenti (Conformità Normativa e CBI)
- **Logica Contabile F24 via Trigger DB (Opzione A):** Implementato un trigger contabile robusto `BEFORE INSERT OR UPDATE` su `fatture_fornitori` in `sql/s18_modulo_fiscale_adempimenti.sql`. Quando lo stato della fattura passa a `'pagata'`, il trigger calcola automaticamente la scadenza (il 16 del mese successivo) e cumula l'importo della ritenuta nella delega F24 associata.
- **Protezione Normativa su Storno Ritenute:** Il trigger impedisce l'annullamento o lo storno di fatture la cui ritenuta d'acconto è abbinata ad una delega F24 già in stato `'pagato'`, sollevando un'eccezione SQL per salvaguardare la conformità fiscale.
- **Standard Esportazione CBI F24 (120 caratteri):** Implementato in `cbiGenerator.js` la generazione della distinta F24 massiva nel formato standard Corporate Banking Italiano posizionale a 120 caratteri per riga, contenente i record 10, 20, 30, 90.
- **Formati Telematici Agenzia delle Entrate (CU e 770):** Rilasciato in `fiscaleTelematico.js` il generatore del file telematico `.txt` a lunghezza record fissa (1900 caratteri) conforme alle specifiche Sogei per l'invio diretto tramite Desktop Telematico.
- **Quietanza per il Fornitore:** Implementato in `exportFiscale.js` la funzione `exportQuietanzaFornitore` per scaricare la certificazione di avvenuto versamento della ritenuta in formato PDF firmato dall'amministratore.

### 2. Bug e Vulnerabilità Risolti (GDPR & Sicurezza)
- **Apertura Sicura PDF Quietanza:** Allineato il caricamento e la visualizzazione delle quietanze F24 in `ModuloFiscalePage.jsx` all'uso di Signed URL temporanei (scadenza 15 minuti) autogenerati tramite bucket `documenti-condominio` protetto e pattern anti-popup blocker sincrono.
- **Aggiornamento Riconciliazione con Data Movimento:** Corretta la funzione `aggiornaStato` in `RiconciliazioniPage.jsx` per passare `data_pagamento` valorizzata con la data del movimento bancario al momento del salvataggio della fattura a `'pagata'`.









## Verifica finale

- **Test Smoke:** Eseguiti con successo (`npm run smoke`). Nessun errore riscontrato.
- **Bug Triager:** Analisi completa dei file modificati. Non sono stati trovati bug critici; sono state segnalate alcune osservazioni di livello medio (es. miglioramento parsing JSON in `fileExtractor.js`). Le correzioni sono già state applicate.
- **Stato:** Modulo fiscale implementato, pronto per il rilascio.

---

## Storico Decisioni e Fatti Verificati della Sessione S19 (10 Luglio 2026)

### 1. Funzionalità Implementate — Migrazione da Gestionali

- **Wizard `/migrazione` a 5 step (`MigazionePage.jsx`):** Nuova pagina completa accessibile dalla sidebar con badge `NEW`. Permette di importare **tutti i dati** da qualsiasi gestionale condominiale (Danea Domustudio prioritario + qualsiasi export generico).
- **Multi-upload intelligente (Step 2):** La dropzone accetta più file contemporaneamente (drag multiplo o selezione multipla). Ogni file viene analizzato separatamente da Claude AI che lo classifica per tipo (`anagrafica`, `unita`, `millesimi`, `spese`, `rate`, `saldo_cassa`, `misto`, `sconosciuto`) e rileva il gestionale di origine.
- **Aggregazione FK-safe (Step 4):** Import massivo in ordine esatto: esercizi → persone → unità → occupanti_unita → millesimi → saldi_iniziali → spese → rate. Ogni errore per singolo record viene loggato senza interrompere l'import degli altri.
- **Gestione conflitti (Step 3):** Rilevamento duplicati tramite query read-only su Supabase (match CF o nome+cognome per persone, match numero per unità). L'utente sceglie per ogni conflitto: Aggiorna / Salta / Crea nuovo.

### 2. Funzioni Aggiunte a `fileExtractor.js`

- **`classificaEStraiFileGestionale(file)`:** Async, usa `preparaContenuto` + firme canoniche claudeClient (`callClaudeDocument`/`callClaudeVision`/`callClaude`), `maxTokens: 6000`. Riconosce Danea Domustudio per colonne caratteristiche ("Nominativo", "Scala", "Interno", "Millesimi proprietà", "Versato", "Da versare").
- **`aggregaDatiGestionale(risultatiPerFile[])`:** Sincrona pura (no AI). Merge con deduplicazione leggera: CF esatto per persone, numero esatto per unità, nome tabella per millesimi. Spese/rate/saldi: concatenate senza dedup per non perdere mai dati.

### 3. Decisioni di Prodotto

- **Danea non ha ZIP unico:** Esporta per sezione separata (Persone → xlsx, Unità → xlsx, Tabelle → xlsx). Il multi-upload risolve questa limitazione nativamente.
- **Wizard sempre disponibile:** Non bloccato al primo setup, richiamabile per aggiungere anni storici.
- **Storico multi-anno:** L'import crea automaticamente gli esercizi per ogni anno trovato nelle spese/rate/saldi.
- **ZIP Danea:** Rinviato a sessione futura. Ora solo file singoli multipli.

### 4. Bug Risolti

- **State stale nel report finale (Step 5):** `setRiepilogo({ ...progressoImport })` leggeva la closure stale. Corretto con cattura esplicita di `riepilogoFinal` dentro il `setProgressoImport` callback prima di chiamare `setRiepilogo(riepilogoFinal)`.

### 5. Fatti Verificati — Realtà Export Danea Domustudio

- Export "Copia di sicurezza" → `.bds` (binario proprietario, inutilizzabile da terzi)
- Export "Passaggio di consegne" → formato proprietario, solo per re-importazione in altro Danea
- Export "Excel per sezione" → `.xlsx/.xls` per sezione singola (Persone, Unità, Tabelle, Fornitori) → **questo è il percorso di migrazione corretto**
- Non esiste un "esporta tutto" nativo

---

## Storico Decisioni e Fatti Verificati della Sessione S20 (10 Luglio 2026 - Rebranding in CondoSmart)

### 1. Decisioni sul Marketing e Naming
- **Rebranding in CondoSmart:** Modificato il nome dell'applicazione da "CondoAI" a "CondoSmart" in tutti i punti esposti all'utente finale (UI, stampe PDF, esportazioni Excel, messaggi e-mail e prompt dell'assistente virtuale) per mitigare le resistenze del target di amministratori tradizionali rispetto alla parola "AI".
- **Naming strategy:** Scelta la variante "CondoSmart" rispetto a "smartCondo" per dare immediata rilevanza al settore merceologico ("Condo") ed evitare l'ambiguità con l'hardware/domotica condominiale.
- **Rimodulazione dell'identità chatbot:** Il chatbot assistente virtuale si presenta ora come "assistente virtuale" di CondoSmart anziché "assistente AI di CondoAI".

### 2. File Modificati e Validazione
- Eseguito il refactoring completo su 20 file del progetto e superata con successo la validazione della build locale (`npm run build`).

---

## Storico Decisioni e Fatti Verificati della Sessione S21 (10 Luglio 2026 - Logo BrandLogo Statico e Dinamico)

### 1. Decisioni sul Design e Animazione Logo
- **Separazione Visiva Statico/Dinamico:** Il logo dinamico con l'effetto hover di volo dei foglietti e la reazione della scritta è abilitato solo sulle pagine ad alta attrazione dell'attenzione (LoginPage, RegisterPage, ForgotPasswordPage, e tutto il sito di marketing statico). Nelle sezioni interne del gestionale (sidebar di AppLayout) il logo rimane statico e pulito.
- **Variabili CSS per Temi Dinamici:** Utilizzate variabili CSS tematiche (`--logo-text-prefix`, `--logo-text-highlight`, `--logo-text-glow`) per i colori e i bagliori all'hover del logo. Questo permette di invertire dinamicamente le pulsazioni sul testo (nero profondo e glow azzurro soffuso in tema chiaro, bianco brillante e glow bianco in tema scuro) risolvendo il problema della scomparsa della scritta Condo.
- **Materializzazione sul Posto:** Sistemati i keyframe iniziali dei foglietti (dallo 0% al 6% dell'animazione a traslazione nulla `translate(0, 0)`) per evitare salti a mezz'aria all'avvio, garantendo che i fogli appaiano visibilmente all'interno delle finestre e fessure.

### 2. Funzionalità e Cablaggio Rilasciati
- **React App:** Cablato `BrandLogo` in `AppLayout.jsx` (sidebar, statico), `LoginPage.jsx` (dinamico), `RegisterPage.jsx` (dinamico) e `ForgotPasswordPage.jsx` (dinamico).
- **Sito di Marketing (`website/`):** Sostituito il logo statico con l'SVG intero interattivo in tutte le 7 pagine del sito statico (`index.html`, `features.html`, `pricing.html`, `sicurezza.html`, `dpa.html`, `privacy.html`, `termini.html`).
- **CSS di Marketing:** Integrate le regole CSS dei keyframe e del volo a foglia morta direttamente nel file `website/css/style.css`.
- **E2E Smoke Verification:** Eseguita con successo la build del gestionale (`npm run build`).

### 3. Fatti Verificati
- **Origine dei fogli volanti:** L'interpolazione lineare immediata tra lo `0%` e il `15%` Y-offset nei keyframe causava un volo ad alta velocità fin dai primi millisecondi che materializzava il foglietto già sollevato di diversi pixel. L'introduzione dello step al `6%` a traslazione `(0,0)` ha risolto il disallineamento visivo.
- **Vite Rolldown warning:** I file CSS compressi rimangono correttamente posizionati. La build di Vite viene completata in meno di 400ms.

### 4. Bug Risolti
- **Prop `interactive` in `BrandLogo.jsx`:** Risolto il mismatch per cui il prop `interactive` non veniva destrutturato né propagato come classe CSS `.interactive`, impedendo il funzionamento dell'animazione di volo in React.
- **Sintassi CSS in `website/css/style.css`:** Corretta l'unità di misura mancante (`deg`) e ripristinata la proprietà `scale(0.95)` al frame `75%` di `@keyframes fly-sheet-3`.
- **Doppio Nido Metadata in `RegisterPage.jsx`:** Rimosso il wrapping ridondante `{ data: ... }` nella chiamata a `signUp`, ripristinando il popolamento corretto di `nome` e `cognome` nella tabella `profiles` su Supabase.
- **Link DPA e Legali Interrotti in `RegisterPage.jsx`:** Aggiornati i link delle checkbox di registrazione che puntavano a risorse non esistenti (`/dpa.pdf`, `/tos`, `/privacy`), reindirizzandoli correttamente alle rispettive pagine statiche `.html` del sito.

---

## Storico Decisioni e Fatti Verificati della Sessione S30 (10 Luglio 2026 - Conformità GDPR e Risoluzione File Storage Orfani)

### 1. Decisioni sul GDPR e Diritto all'Oblio
- **Risoluzione dei File Orfani (Storage):** Implementata la pulizia automatica dello storage fisico all'eliminazione dell'account. Il database cascade elimina le righe SQL, ma è necessario rimuovere i file binari nei bucket di Supabase Storage per conformità reale al GDPR.
- **Pagine Legali nella Build:** Creati `privacy.html` e `termini.html` all'interno della cartella `public/`. Vite li copia automaticamente in `dist/` durante il processo di build, rendendoli fruibili su `/privacy.html` e `/termini.html` e prevenendo gli errori 404 dai link di registrazione.

### 2. Funzionalità Rilasciate
- **Pulizia Storage in `delete-account` (Edge Function):**
  - Recupero di tutti i condomini dell'amministratore.
  - Elencazione e rimozione di tutti i file in `documenti-condominio` sotto il prefisso `${condominio_id}/`.
  - Elencazione e rimozione ricorsiva di tutti i file in `fatture` sotto la cartella dell'utente (`${user_id}/`), inclusi gli F24 pagati.
- **File di Compliance Statici:**
  - `public/privacy.html` con informativa specifica sull'elaborazione AI stateless e diritti GDPR (esportazione dati, oblio).
  - `public/termini.html` con i Termini di Servizio e la clausola di esclusione responsabilità contabile dell'amministratore.

### 3. Fatti Verificati
- **Verifica Deploy:** Eseguito con successo `supabase functions deploy delete-account`. La funzione è correttamente caricata e attiva in produzione.
- **Verifica Build:** `npm run build` genera correttamente i file HTML compilati nella cartella `dist/` garantendo l'accessibilità a runtime.

---

## Storico Decisioni e Fatti Verificati della Sessione S31 (10 Luglio 2026 - Rimozione Emoji Residue e Habilitazione AI Client in AggiornamentoAnagrafica)

### 1. Sostituzione delle Emoji residue
- **React App:** Rimosse le restanti emoji grafiche in `ModuloFiscalePage.jsx` (pulsante quietanza), `FattureFornitoriPage.jsx` (ritenute, F24 upload, alert di errore), `RiconciliazioniIncassiPage.jsx` (bottoni e badge orfani), `RiconciliazioniPage.jsx` (bottoni e badge orfani) e `ImpostazioniPage.jsx` (lucchetto pagamento sicuro Stripe). Sostituite tutte con icone Lucide React coerenti e professionali (`FileText`, `AlertTriangle`, `Paperclip`, `Upload`, `Bot`, `Calendar`, `User`, `Building2`, `Plus`, `RefreshCw`, `Lock`).
- **Sito di Marketing (`website/`):** Completata la rimozione su tutte le pagine statiche (`index.html`, `features.html`, `sicurezza.html`, `pricing.html`, `dpa.html`, `privacy.html`, `termini.html`) sostituendo le emoji con moderne icone SVG inline (`grid`, `building`, `receipt`, `link`, `file-text`, `mail`, `cpu`, `bar-chart-2`, `landmark`, `lock`, `shield`, `globe`, `clipboard`, `alert-triangle`) per un'esperienza coerente, pulita e professionale a 1440p.

### 2. Risoluzione Bug e Sicurezza (Report Bug Triager)
- **AggiornamentoAnagrafica.jsx:** Sostituita la chiamata `fetch` diretta a Anthropic con l'utilizzo di `callClaude` importata da `../lib/claudeClient`, garantendo la validazione corretta del token JWT lato server, riducendo l'esposizione di API key e correggendo l'uso del parametro `maxTokens` in sostituzione di `max_tokens`.
- **GDPR Logs:** Rimossi i log di console in chiaro contenenti dati personali degli utenti/condòmini in `AnagraficaCondominioTab.jsx` e `usePersone.js` per garantire la conformità alla minimizzazione ed evitare il leak di informazioni sensibili.
- **Navigazione Pagine Legali Sito:** Uniformati i link di Accedi (`nav-login` -> `http://localhost:5173/login`) e Trial (`nav-trial` -> `http://localhost:5173/register`) in `dpa.html`, `privacy.html`, `termini.html` e `index.html` per garantire coerenza globale su tutto il portale statico.

### 3. Fatti Verificati
- **Verifica Build:** `npm run build` eseguito con successo, build completata senza alcun errore di compilazione o warning.
- **Git status ed origin push:** Modifiche caricate sul ramo principale ed eseguito il push a `origin/main`.

---

## Storico Decisioni e Fatti Verificati della Sessione S32 (11 Luglio 2026)

### 1. Sistema Notifiche Temporali
- **Architettura:** promemoria calcolati lato client da dati DB esistenti. Nessuna nuova tabella. Stato "letto" in `localStorage` con chiavi deterministiche per utente.
- **Colonna DB:** `profiles.notification_settings JSONB` (script `sql/s32_notification_settings.sql`). Default su riga singola per compatibilità Dashboard Supabase.
- **4 tipologie implementate:**
  1. F24 ritenute — attivo dal 1° al 16 del mese successivo al pagamento (scadenza legale art. 25 DPR 600/73, verificata con Agenzia delle Entrate). Solo on/off, timing fisso per legge.
  2. Rate scadute — N giorni dopo scadenza `rate_unita` (default 10 gg, slider 1-60)
  3. Esercizio in scadenza — N giorni prima `data_fine` esercizio (default 30 gg, slider 7-90)
  4. Movimenti non riconciliati — N giorni tolleranza (default 15 gg, slider 1-60, disabled di default)
- **File nuovi:** `src/lib/notificheEngine.js`, `src/hooks/useNotifiche.js`, `src/components/NotificheDropdown.jsx`
- **File modificati:** `src/components/AppLayout.jsx` (campanella → badge rosso pulsante + dropdown), `src/pages/ImpostazioniPage.jsx` (sezione "Notifiche & Promemoria" con toggle switch + slider)
- **⚠️ Attenzione:** `DEFAULT_NOTIFICHE` è dichiarato dentro il corpo di `ImpostazioniPage` — non causa loop perché l'`useEffect` dipende da `profile` (non da `DEFAULT_NOTIFICHE`), ma se in futuro si aggiunge `DEFAULT_NOTIFICHE` come dipendenza dell'effect, va spostato fuori dal componente o in `useMemo`.
- **Commit:** `034a035` (implementazione) + `836474c` (fix JSON SQL)

---

## Storico Decisioni e Fatti Verificati della Sessione S33 (12 Luglio 2026 - Programma "Invita un Amico" Referral)

### 1. Programma Referral "Invita un Amico"
- **Architettura:** Tabelle `referrals` (collegata a referrer e referred) e `referral_campaigns` (gestione sconti promozionali). Colonna `referral_code` (8 char unique) aggiunta a `profiles`.
- **Integrazione Stripe:** Gli sconti si convalidano quando l'utente referred si abbona (webhook: `checkout.session.completed` e `customer.subscription.updated`). Vengono applicati sotto forma di credito negativo sul saldo cliente Stripe del referrer (`createBalanceTransaction`), o tenuti in stato `convalidato` se il referrer non ha ancora configurato Stripe (applicati poi in `stripe-checkout`).
- **Controllo GDPR:** Nei log personali dell'utente, le email degli invitati sono parzialmente mascherate (es. `g***@e***.com`). Nel Backoffice del SuperAdmin sono visualizzate in chiaro per controllo antifrode.
- **Backoffice SuperAdmin:** Consente al gestore (Gabriele) di creare nuove campagne promozionali, impostare importo sconti e attivare una singola campagna corrente in esclusiva. Offre inoltre la convalida e applicazione manuale dei referral come fallback di emergenza.
- **Risoluzione Bug:** Risolto bug di compilazione per l'importazione mancante dell'icona `Send` in `BackofficePage.jsx`.
- **Commit:** `S33 step1: implementa invita un amico con sconti Stripe e campagne`

---

## Storico Decisioni e Fatti Verificati della Sessione S34 (12 Luglio 2026 - Gestione Verbali e Ricerca AI)

### 1. Gestione Verbali e Ottimizzazione AI
- **Nuovo Tab Verbali:** Aggiunto un tab dedicato "Verbali" (`VerbaliAssembleaTab.jsx`) per raccogliere cronologicamente le assemblee del condominio, consentendo l'upload diretto (PDF/DOCX) con indicazione della data dell'assemblea e note.
- **Esclusione da Documenti Generici:** I verbali di tipo `verbale` sono stati esclusi dal componente `DocumentiCondominio.jsx` per evitare duplicazioni visive.
- **Motore di Ricerca AI Ottimizzato:** Implementato un sistema di potatura del contesto basato su estrazione di parole chiave (escludendo stop words italiane). Suddivide il testo estratto dei verbali in paragrafi e trasmette a Claude solo le sezioni contenenti le parole cercate (+1 paragrafo adiacente per contesto), riducendo i token inviati e i costi del 90-95%.
- **Fallback di Ricerca Completa Automatico:** La verifica della pertinenza delle parole chiave avviene **interamente client-side ed è gratis** (in JavaScript). In caso di mancata corrispondenza, il sistema esegue **automaticamente e istantaneamente** la chiamata a Claude sul testo completo (senza doppi passaggi o secondi clic per l'utente, mantenendo sempre una sola chiamata AI totale).
- **Estensione Schema DB:** Creata la migrazione `sql/s34_documenti_date.sql` per introdurre il campo `data_documento` in `documenti_condominio` per storicizzare la data reale del verbale/assemblea.

### 2. Migrazione AI a Gemini (Pro & Flash)
- **Mappatura Strategica dei Modelli:** Configurato il proxy intelligente per instradare le chiamate a `gemini-pro-latest` (per compiti ad alta complessità cognitiva: ricerca nei verbali, scelta dei criteri di ripartizione e strutturazione millesimali) e `gemini-flash-latest` (per estrazioni dati standardizzate e veloci: analisi fatture, estratti conto e importazione anagrafica), ottimizzando costi e latenza senza alcuna perdita di accuratezza.
- **Output JSON Garantito:** Abilitata la modalità nativa `responseMimeType: "application/json"` di Gemini per forzare risposte sintatticamente strutturate in JSON per tutte le operazioni di estrazione dati, azzerando i crash di parsing.
- **Retrocompatibilità Totale:** L'Edge Function `claude-proxy` traduce la risposta di Gemini nel formato Anthropic (content ed usage), evitando modifiche a cascata e mantenendo intatta la compatibilità e la logica di telemetria (`logAiCall`).
- **Verifica con Smoke Test:** Validata la connessione ed il corretto funzionamento end-to-end con esito verde e risposta corretta tramite `npm run smoke`.

### 3. Bug Risolti
- **Bug Layout a Colonna Singola (Verbali):** Risolto il problema per cui il layout della griglia verbali rimaneva fisso a colonna singola su desktop a causa di una media query inline in React. Spostato sulla gestione dinamica di stato `isLargeScreen` via resize listener.
- **Leak di Popup su Errori dei Signed URL:** Avvolte le chiamate asincrone di recupero dei Signed URL in `VerbaliAssembleaTab.jsx` e `DocumentiCondominio.jsx` in blocchi `try/catch` per garantire che il popup vuoto provvisorio venga chiuso (`newWindow.close()`) in caso di errore di caricamento.
- **Auto-selezione Verbali Caricati:** Corretto il flusso UX in `VerbaliAssembleaTab.jsx` in modo che il verbale appena caricato con successo venga aggiunto istantaneamente all'insieme dei verbali selezionati per la ricerca AI.
- **Fail-Open su Inserimento Rate Limit (Proxy):** Protetta l'operazione di log del rate limit in `claude-proxy/index.ts` con un blocco `try/catch` per evitare blocchi ed errori 500 sul client in caso di problemi di connessione temporanei verso Supabase DB.

---

## Storico Decisioni e Fatti Verificati della Sessione S35 (12 Luglio 2026 - Tema Chiaro/Scuro)

### 1. Gestione Tema Chiaro/Scuro
- **Salvataggio della Preferenza:** La scelta del tema viene salvata localmente nel browser tramite `localStorage` con chiave `'condosmart-theme'`. Il tema scuro rimane quello predefinito all'avvio.
- **Prevenzione Flash di Colore:** Implementato uno script sincrono all'inizio del tag `<head>` in `index.html`. Lo script legge immediatamente la preferenza in `localStorage` e imposta l'attributo `data-theme` su `document.documentElement` prima che il browser inizi a renderizzare gli elementi del body, azzerando i flash di colore durante il caricamento.
- **Supporto Variabili CSS in Stili Inline:** Refattorizzati gli stili inline dei componenti centrali di layout e configurazione (`AppLayout.jsx`, `ImpostazioniPage.jsx`) sostituendo i colori hardcoded (es. `#0f172a`, `#1e293b`) con variabili CSS (es. `var(--app-bg)`, `var(--card-bg)`).
- **Adattamento Logo del Brand:** Aggiornate le variabili del testo del logo in `BrandLogo.jsx` per puntare a costanti CSS definite in `index.css`. Questo permette al logo di adattarsi dinamicamente in base al tema attivo (usando tonalità chiare e scure adeguate) senza richiedere logica condizionale o ricaricamento dei componenti in JavaScript.
- **Interfaccia Grafica:** Inserita la sezione "Aspetto & Tema" in `ImpostazioniPage.jsx` con switch grafici (Sole per Tema Chiaro e Luna per Tema Scuro) dotati di micro-transizioni.
- **Adeguamento Globale del Codebase (Autofix)**: Creati ed eseguiti tre script di refactoring automatico per individuare e convertire ricorsivamente in tutti i 40+ file JSX dell'applicazione i colori hardcoded residui del tema scuro (sfondi `#0f172a`, `#1e293b` e relative varianti semi-trasparenti, bordi `#334155` e relative opacità, e i colori di testo chiari come `#e2e8f0` e `#cbd5e1`). Tutte le occorrenze sono state sostituite con le variabili CSS del tema (`var(--app-bg)`, `var(--card-bg)`, `var(--border-color)`, `var(--text-primary)`, `var(--text-secondary)`, ecc.).
- **Variabile CSS Gradiente Card**: Introdotta in `index.css` la variabile `--gradient-card` (che si adatta a seconda del tema a gradienti scuri o chiari) ed applicata a componenti complessi (come `PassaggioConsegneSection.jsx`) per garantire l'armonia estetica.
- **Risoluzione Bug di Contrasto**: Corretti i testi chiari hardcoded (`#f8fafc`) e gli sfondi scuri hardcoded (`#090d16`) nel componente `PassaggioConsegneSection.jsx` e `SpeseForm.jsx` per evitare testi invisibili e disallineamenti di lettura in tema chiaro.
- **Bonifica Testi Chiari Residui**: Rilevate ed eliminate a tappeto le rimanenti occorrenze di colori di testo chiari hardcoded (`#cbd5e1`, `#f8fafc`, `#f1f5f9` e `#e2e8f0` in condizionali o variabili di stile) in 14 file JSX (tra cui `ModuloFiscalePage.jsx`, `FattureFornitoriPage.jsx`, `MillesimiEditor.jsx`, `NotificheDropdown.jsx`, `AssistenzaPage.jsx`), convertendoli nelle variabili CSS del tema per garantire la piena leggibilità (evitando testi bianchi su sfondo chiaro).
- **Adeguamento Grafico Chatbot**: Modificata l'interfaccia della chat in `AssistenzaPage.jsx`. Lo sfondo dei messaggi del bot (`#0f172a`), il bordo (`#334155`) e lo sfondo verde scuro delle risposte dei ticket (`#064e3b`) sono stati sostituiti con le rispettive variabili CSS (`var(--app-bg)`, `var(--border-color)`) e opacità coerenti con il tema chiaro per garantirne la leggibilità e l'armonia estetica. Allineati anche i pulsanti d'azione (Apri Ticket, Termina Chat) per usare l'accento ed evitare scarso contrasto in modalità chiara.

---

## Storico Decisioni e Fatti Verificati della Sessione S36 (12 Luglio 2026 - Gemini Chatbot & Knowledge Base)

### 1. Decisioni Architetturali e di Prodotto
- **Allineamento a Gemini:** Il chatbot dell'assistenza utilizza già Gemini (sia Pro per la chat che Flash per compiti veloci) tramite il proxy AI, ma l'etichetta dell'interfaccia utente è stata ora allineata indicando "Powered by Gemini AI" al posto di "Powered by Claude AI".
- **Sistema di Knowledge Base Dinamico (RAG Leggero):** Progettata e implementata l'autorigenerazione della conoscenza dell'assistente. Alla chiusura di un ticket dal Backoffice, se l'opzione "Genera articolo di Knowledge Base con l'AI" è attiva, l'AI sintetizza il problema e la soluzione e li inserisce nella tabella `assistenza_knowledge`. All'invio dei messaggi in chat, il sistema effettua una ricerca contestuale (full-text con filtri OR ilike sulle parole chiave significative) e inietta gli articoli trovati direttamente nel prompt di sistema del chatbot.
- **Tab Gestione Knowledge Base in SuperAdmin:** Aggiunto un tab dedicato "Knowledge Base" in `BackofficePage.jsx` che consente al SuperAdmin di visualizzare, filtrare, inserire manualmente, modificare ed eliminare gli articoli della Knowledge Base, garantendo il pieno controllo sulle informazioni in mano all'AI.

### 2. Implementazione Tecnica e Database
- **Tabella `assistenza_knowledge`:** Creata la migrazione `sql/s36_assistenza_knowledge.sql` che definisce la tabella con politiche RLS (lettura a tutti gli utenti autenticati per consentire il funzionamento del chatbot, scrittura riservata solo ai SuperAdmin via `public.is_superadmin`) e indice GIN `to_tsvector` per ricerche testuali performanti.
- **Integrazione callClaude in Backoffice:** Importata la funzione `callClaude` in `BackofficePage.jsx` per gestire le chiamate di sintesi in modalità JSON strutturata con parsing robusto e fallback tramite regex in caso di stringhe non pulite restituite dall'AI.
- **Interfaccia Utente e Gestione degli Stati:** Allineato il rendering dei tab grafici e introdotto lo stato `generaKB` con checkbox persistente sotto l'input di risposta dei ticket nel pannello laterale del Backoffice.

---

## Storico Decisioni e Fatti Verificati della Sessione S37 (13 Luglio 2026 - Sessioni Concorrenti e Collaboratori)

### 1. Controllo Sessione Unica (Anti-Sharing)
- **Architettura Realtime**: introdotta la tabella `user_sessions` con politiche RLS per memorizzare l'ID sessione attivo per ogni utente.
- **Logica client-side**: all'avvio del client, viene generato un ID univoco in `sessionStorage` e aggiornato sul database. Un listener Realtime su Supabase rileva se un altro utente si connette con lo stesso account, sloggando istantaneamente il client concorrente precedente per prevenire la condivisione fraudolenta dell'account Base.

### 2. Multi-utenza e Collaboratori
- **Flessibilità dei Piani**: modificati i limiti di `max_collaboratori` per i piani (Base/Trial: 0, Studio: 2, Professional: 10).
- **Rilevamento e Ereditarietà**: implementata in `usePlan.js` la logica per verificare se l'utente corrente sia un collaboratore registrato in `collaboratori_studio`. In tal caso, l'applicazione eredita in modo trasparente l'abbonamento e i limiti dell'amministratore titolare del piano per i conteggi e l'uso dell'AI.
- **Pannello Impostazioni**: creata una sezione dedicata ai Collaboratori in `ImpostazioniPage.jsx` per consentire ai titolari dei piani abilitati di invitare (tramite email) e rimuovere i collaboratori dello studio, bloccando gli inviti extra-soglia.

### 3. Assegnazione Condomini ai Collaboratori
- **Associazione molti-a-molti**: introdotta la tabella `collaboratori_condomini` per assegnare specifici condomini dello studio a ciascun collaboratore.
- **Filtro RLS Dinamico**: aggiornata la funzione `user_owns_condominio` per restringere l'accesso del collaboratore solo ai condomini assegnati. Le schermate del gestionale filtrano automaticamente le risorse in base alle RLS senza alcuna modifica alle query frontend.
- **Interfaccia di Assegnazione**: integrata la modale `AssegnaCondominiModal` accessibile con l'icona `Building2` dalla lista collaboratori in `ImpostazioniPage.jsx`.
- **Allineamento Creazione Condomini**: modificato `useCondomini.js` in modo che la creazione di condomini da parte di un collaboratore associ la proprietà all'amministratore titolare del piano dello studio.

### 4. Fatti Verificati
- **Verifica Build**: Eseguito `npm run build` con successo, build completata senza alcun errore di compilazione.
- **Commit di sessione**: Registrato il commit di sessione S37 step 3.

---

## Storico Decisioni e Fatti Verificati della Sessione S38 (13 Luglio 2026 - Registro Anagrafe Condominiale con AI Reader)

### 1. Schema Catastale e Residenza
- **Estensione Database**: creata la migrazione `sql/s38_anagrafe_condominiale.sql` che aggiunge i campi catastali (`catasto_foglio`, `catasto_particella`, `catasto_subalterno`, `catasto_categoria`, `catasto_rendita`) alla tabella `unita` e i campi residenza (`residenza_indirizzo`, `residenza_comune`, `residenza_cap`, `residenza_provincia`) alla tabella `persone`.

### 2. Flusso di Sollecito Intelligente
- **Filtro Chirurgico per Email**: l'interfaccia rileva automaticamente quali anagrafiche o dati catastali mancano per ciascuna unità immobiliare. Il pulsante di sollecito permette di inviare email di richiesta (via Resend) unicamente ai condòmini con dati incompleti o di nuova acquisizione, riducendo lo spam e mirando solo ai soggetti inadempienti.

### 3. OCR Modulo Autocertificazione con Gemini
- **Estrazione Dati AI**: implementata in `fileExtractor.js` la funzione `estraiDatiAnagrafeDaModulo` che sfrutta Gemini (Flash/Pro) per effettuare l'OCR dei moduli compilati e firmati (immagini o PDF).
- **Validazione con un Click**: l'amministratore può scansionare il modulo compilato inviatogli dal condomino, caricarlo su CondoSmart e validare i dati catastali/anagrafici estratti dall'AI tramite una modale di confronto prima di salvare sul database.
- **Race Condition Guard**: implementata una guardia asincrona in `handleFileChange` ed il blocco di interazione al pulsante "Annulla" per evitare di sovrascrivere i dati nel caso in cui l'utente cambi selezione di unità prima del completamento della chiamata AI (segnalazione e fix di Bug Triager).

### 4. Unificazione UX: "Anagrafica & Unità"
- **Riorganizzazione Tab**: unificati i moduli `AnagraficaCondominioTab` e `RegistroAnagrafeTab` all'interno di un unico componente principale integrato [AnagraficaCondominioTab.jsx](file:///Users/gabrielemaesani/Documents/CondoAI2/src/components/AnagraficaCondominioTab.jsx).
- **Sotto-Visualizzazione Fluda (Sub-Tabs)**: l'interfaccia offre ora due comode sotto-visualizzazioni selezionabili con un click:
  1. *Proprietà & Catasto*: la griglia catastale con stato di completezza ed OCR AI.
  2. *Rubrica Contatti*: la lista delle anagrafiche con filtri e modifiche rapide.
- **Semplificazione Sidebar**: rimosso il tab ridondante `registro` da [CondominiDetailPage.jsx](file:///Users/gabrielemaesani/Documents/CondoAI2/src/pages/CondominiDetailPage.jsx), rinominando il tab principale in "Anagrafica & Unità" per una navigazione pulita ed intuitiva.

### 5. Esportazione Registro Anagrafe PDF
- **Reportistica di Legge**: implementato l'export in PDF Landscape del Registro di Anagrafe Condominiale ufficiale ai sensi dell'Art. 1130 c.c. con orientamento orizzontale per ospitare tutte le colonne di legge.

### 6. Bug Risolti (Fix Bug Triager)
- **Importazione mancante `useCallback`**: Importato correttamente `useCallback` da `'react'` in `AnagraficaCondominioTab.jsx` per evitare il ReferenceError a runtime.
- **Doppio attributo `style` JSX**: Risolti i conflitti di visualizzazione JSX unendo i doppi stili in un unico oggetto in `AnagraficaCondominioTab.jsx` alle righe 633, 643 e 907.
- **Firma `exportAnagraficaPdf`**: Corretta la chiamata di esportazione separando il parametro `withWatermark` come secondo argomento invece di iniettarlo nell'oggetto delle opzioni.

### 7. Creazione Manuale delle Unità
- **Inserimento Diretto**: aggiunto il pulsante "+ Nuova Unità" e la modale `showNuovaUnitaModal` per permettere all'amministratore di registrare manualmente nuove unità immobiliari nel condominio, valorizzandone la scala, il piano, i mq, il tipo e tutte le coordinate catastali ed immobiliari senza dover passare per un'importazione massiva di file.

### 8. Popup Preventivo all'Esportazione (Controlli Completezza)
- **Avviso Dinamico**: Ridenominato il pulsante in `"REGISTRO ANAGRAFE PDF"`. All'atto dell'esportazione del PDF, l'applicazione controlla lo stato di ogni unità: se vi sono campi catastali o soggetti non configurati (unità incomplete), viene mostrato a schermo un popup elegante con l'elenco delle unità mancanti, consentendo all'amministratore di annullare o procedere comunque all'esportazione.

### 9. Unificazione UX: "Preventivo & Saldi"
- **Riorganizzazione Tab**: unificati i moduli `PreventivoSection` e `SaldiInizialiTab` all'interno di un unico componente principale integrato [PreventivoSection.jsx](file:///Users/gabrielemaesani/Documents/CondoAI2/src/components/PreventivoSection.jsx).
- **Sotto-Visualizzazione Fluda (Sub-Tabs)**: l'interfaccia offre ora due sotto-visualizzazioni selezionabili con un click:
  1. *Preventivo Spese*: l'elenco delle voci, le scadenze e la generazione della rateizzazione.
  2. *Saldi Iniziali*: la griglia di inserimento saldi per unità e cassa con riporto da esercizio precedente e importazione AI da PDF consuntivo.
- **Semplificazione Sidebar**: rimosso il tab ridondante `saldi` da [CondominiDetailPage.jsx](file:///Users/gabrielemaesani/Documents/CondoAI2/src/pages/CondominiDetailPage.jsx), rinominando il tab principale in "Preventivo & Saldi" per alleggerire la barra principale dei tab del condominio.

### 10. Bug Risolti (Fix Bug Triager)
- **Doppio attributo `style` JSX in PreventivoSection**: Sanate le celle della tabella e il contenitore della griglia dei saldi iniziali in `PreventivoSection.jsx` alle righe 337, 338, 339, 340, 343, 352, 353 e 494 unendo i doppi stili per evitare errori di compilazione e visualizzazione.

### 11. Fatti Verificati
- **Verifica Build**: Eseguito `npm run build` con successo, build completata senza alcun errore di compilazione.
- **Commit di sessione**: Registrato il commit di sessione S38 step 6.

---

## Storico Decisioni e Fatti Verificati della Sessione S39 (15 Luglio 2026 - Analisi di Mercato, Pricing e Scelte Strategiche)

### 1. Decisioni di Business e Pricing
- **Strategia di Posizionamento Premium:** Definita una struttura di pricing premium per posizionare CondoAI come strumento ad alto valore aggiunto che riduce il carico di lavoro dello studio (ROI paragonabile a mezza risorsa part-time).
- **Tariffazione SaaS basata su U.I.:** Mantenuta la metrica sulle unità immobiliari gestite (U.I.) con postazioni illimitate incluse (vantaggio rispetto a Danea Domustudio, allineato a Kipò). L'assistenza AI è inclusa nativamente (fair-use) per preservare la proposta di valore.
- **Canoni di Listino:**
  - *Starter (Fino a 250 U.I.):* €69/mese fatturato annualmente (~€830/anno).
  - *Professional (Fino a 800 U.I.):* €179/mese (~€2.150/anno) [Tier di riferimento].
  - *Studio (Fino a 2.000 U.I.):* €379/mese (~€4.550/anno).
  - *Enterprise (Oltre 2.000 U.I.):* Su preventivo.
- **Tattica di Lancio:** Regalo di mesi di servizio per i clienti fondatori (es. prezzo bloccato 24 mesi + 3 mesi gratis + migrazione inclusa) anziché sconti percentuali sul listino per non degradare il valore percepito.
- **Onboarding e Migrazione:** L'importazione automatica dello storico dati da Domustudio viene gestita gratuitamente dal team come principale costo di acquisizione cliente (CAC) per eliminare la resistenza al cambio gestionale.

### 2. Decisioni Strategiche su Segmenti Adiacenti (Feature "Distrazione")
- **No Autogestione (Senza Amministratore):** Escluso il segmento dei condomini autogestiti per via del budget ridottissimo (tetto di €50/anno imposto dai concorrenti), degli elevati costi di supporto per utenti non professionisti, dell'alto churn e del conflitto di canale reputazionale con gli amministratori professionisti. La direzione normativa (DDL 1816/2026) conferma questa scelta stringendo le regole sulla formazione obbligatoria anche per gli amministratori interni.
- **No Bacheca Condominiale UGC:** Escluso il modulo bacheca social tra condòmini per problemi di densità di rete nei micro-silos condominiali, carico di moderazione/contenziosi per l'amministratore e compliance GDPR. Sostituita dall'area riservata monodirezionale (pubblicazione bilanci e avvisi da parte del solo amministratore).
- **No Provvigioni Opache Energia:** Escluso l'incasso di provvigioni non trasparenti per gli amministratori su contratti energetici per scongiurare il rischio di nullità della nomina ex art. 1129 comma 14 c.c. e Cassazione 14424/2025. Previste come alternative future: benchmark comparativi sui consumi delle parti comuni basati sulle fatture caricate, moduli di gara trasparenti e preparazione per CER (Comunità Energetiche Rinnovabili) sul lungo termine.

### 3. Roadmap di Sviluppo e Go-To-Market
- **Fase 1 (Luglio-Agosto 2026 - Focus Sviluppo):** Sviluppo e validazione del motore di calcolo contabile tramite test di regressione con "file d'oro" reali (confronto al centesimo dei bilanci CondoAI vs Domustudio) e completamento dell'importatore dati.
- **Fase 2 (Settembre-Novembre 2026 - Finestra Commerciale):** Outbound marketing manuale mirato su 50 studi pilota (como-Milano) e allineamento con Amministrazione Gemelli (design partner).
- **Fase 3 (Dicembre 2026-Gennaio 2027 - Migrazione):** Importazione e migrazione dati assistita in vista dell'apertura del nuovo esercizio contabile.
- **Fase 4 (Febbraio-Aprile 2027 - Validazione Runtime):** Collaudo sul campo durante la redazione dei primi consuntivi reali e scadenze CU fiscali.
- **Fase 5 (Autunno 2027 - Scale-Up):** Lancio delle campagne di marketing a pagamento strutturate.

### 4. Fatti Verificati
- **Verifica Build**: Eseguito `npm run build` con successo, build completata senza alcun errore di compilazione.
- **Handoff Claude**: Creato il file di handoff `HANDOFF_PROGETTO.md` nella root del repository per l'allineamento del contesto nel Project Claude dell'utente.

---

## Storico Decisioni e Fatti Verificati della Sessione S40 (15 Luglio 2026 - Console Backoffice & Strumenti di Marketing)

### 1. Monitoraggio Risorse e Utilizzi
- **Funzione SQL di Aggregazione**: Creata la RPC `get_utenti_statistiche()` definita come `SECURITY DEFINER` per contare in modo efficiente e centralizzato le risorse di ciascun utente (condomini creati, chiamate AI mensili in UTC, collaboratori attivi) bypassando le politiche RLS client-side in sicurezza.
- **Console Backoffice Completa**: Refattorizzata la tabella utenti in `BackofficePage.jsx` per mostrare gli utilizzi reali e includere una barra di avanzamento colorata per i consumi AI del mese. Aggiunta una tendina `select` per aggiornare al volo il piano dell'utente.

### 2. Strumenti di Email Marketing e AI Copywriter
- **Pannello Newsletter & Promozioni**: Aggiunto il tab "Marketing & Newsletter" nel backoffice per l'invio di email promozionali (via Resend) filtrate per target (Trial, Paganti, Inattivi, Consumi AI >80%) con anteprima grafica in tempo reale.
- **Copywriter Assistito**: Integrato il pulsante "Scrivi con AI" che interpella Claude per redigere oggetti e corpi email HTML accattivanti in base a uno spunto dell'admin.
- **Edge Function di Marketing**: Creata e deployata la Edge Function `invia-email-marketing` abilitata per l'invio asincrono a lotti di email massive tramite le API di sistema di Resend (autorizzata solo per i SuperAdmin).

### 3. Statistiche Referral
- **Metrica Conversioni**: Aggiunti KPI grafici nel tab Marketing per tracciare le performance del programma di referral "Invita un amico" (tasso di registrazione, tasso di abbonamento ed euro totali erogati).

### 4. Bug Risolti (Fix Hot)
- **Crash Realtime `AuthContext.jsx`**: Risolto un bug di race condition su Supabase Realtime per cui l'evento asincrono `.unsubscribe()` di un canale non completato prima della chiamata `.subscribe()` concorrente lanciava l'errore `cannot add postgres_changes callbacks... after subscribe()`. Risolto blindando la creazione del canale con un lock booleano sincrono (`isTrackingSession`), ripulendo in modo sequenziale con `await supabase.removeChannel(channel)` e nominando il canale con l'identificatore univoco di sessione (`currentSessionId`).
- **Errore Eliminazione Condominio (Foreign Key in audit_log)**: Risolto un errore che impediva la cancellazione a cascata (`DELETE CASCADE`) di un condominio. Il trigger di audit log (`audit_trigger_func`) tentava di inserire una riga associata al `condominio_id` appena cancellato, fallendo a causa del vincolo di FK `audit_log_condominio_id_fkey`. Risolto modificando il trigger SQL per verificare se il condominio esiste ancora prima del logging (e impostando a NULL in caso contrario).
- **Crash Check Constraint "preventivo_voci_check" in E2E**: Risolto un crash durante lo script di collaudo E2E (`scripts/collaudo_e2e.mjs`). Quando il condominio veniva cancellato manualmente dal database, il file di stato locale `e2e_state.json` manteneva l'ID obsoleto, facendo saltare allo script la creazione del condominio e dei millesimi. Questo causava l'inserimento di voci di preventivo con `tabella_millesimale_id = null`, violando il vincolo CHECK della tabella. Risolto svuotando il file di stato e rendendo lo script E2E resiliente (ri-crea il condominio se l'ID registrato non esiste più nel database).

### 5. Fatti Verificati
- **Esecuzione SQL**: Applicati con successo lo script `sql/s39_backoffice_marketing.sql` e il fix `sql/s40_fix_audit_delete_cascade.sql` sul database di produzione.
- **Deploy Edge Function**: Le Edge Functions `invia-email-marketing` e `claude-proxy` sono state caricate con successo su Supabase Cloud.
- **Verifica Build**: Eseguito `npm run build` con successo, build completata senza alcun errore di compilazione.
- **Commit di sessione**: Registrato il commit di sessione S40 step 22.

---

## Storico Decisioni e Fatti Verificati della Sessione S41 (15 Luglio 2026 - Output in Stile Chiaro)

### 1. Esportazioni e PDF Chiari
- **Allineamento Layout PDF**: Riconfigurato `exportPdf.js` per generare tutti i documenti PDF (ripartizioni, piano rate, anagrafica, registro anagrafe, solleciti singoli/massivi) in stile chiaro (Light Mode) per la stampa e l'utilizzo standard.
- **Struttura Visiva**: Rimossa la testata a sfondo scuro e il footer scuro a favore di uno sfondo bianco con linee di delimitazione blu (testata) e grigie (footer).
- **Colorazione Tabelle e Testi**: Impostate le tabelle con righe alternate grigio-azzurre chiarissime (`[241, 245, 249]`), testate blu e testi scuri in contrasto per ottimizzare la leggibilità e ridurre il consumo di inchiostro.

### 2. Fatti Verificati
- **Verifica Build**: Eseguito `npm run build` con successo, build completata senza alcun errore di compilazione.
- **Esecuzione Smoke Test**: Eseguito `npm run smoke`. Il test ha fallito per disservizio esterno temporaneo delle API (errore 500 del proxy AI), non correlato alle modifiche grafiche.
- **Commit di sessione**: Registrato il commit di sessione S41 step 1.

---

## Storico Decisioni e Fatti Verificati della Sessione S42 (15 Luglio 2026 - Migrazione AI da Claude a Gemini)

### 1. Decisioni sulla Migrazione AI
- **Ridenominazione Edge Function**: Migrata la Edge Function di chiamata AI da `claude-proxy` a `gemini-proxy`. Aggiornata la configurazione in `supabase/config.toml`.
- **Tabella Rate Limit**: Creata la tabella `gemini_rate_limit` (rinominata da `claude_rate_limit`) sul database Supabase tramite script SQL `sql/s42_gemini_rate_limit.sql`.
- **Client Frontend**: Creato il nuovo client frontend `src/lib/geminiClient.js` che esporta le funzioni canoniche `callGemini`, `callGeminiWithHistory`, `callGeminiVision` e `callGeminiDocument`. Deprecato e svuotato il file `src/lib/claudeClient.js` per prevenire importazioni errate.
- **Aggiornamento Componenti**: Aggiornati tutti i componenti frontend, hook, script e test per importare `geminiClient` ed utilizzare le nuove funzioni `callGemini...` invece delle vecchie `callClaude...`.
- **Text Refactoring**: Sostituiti tutti i riferimenti UI, FAQ, informative legali (privacy policy) e descrizioni di sicurezza da Claude/Anthropic a Gemini/Google.

### 2. Fatti Verificati
- **Verifica Build**: Eseguito `npm run build` con successo. Non ci sono errori di compilazione nel frontend dopo il refactoring dei client.
- **Smoke Test**: Eseguito `npm run smoke` con successo (Proxy OK).
- **Collaudo E2E**: Testati i passaggi dello script `collaudo_e2e.mjs`. L'estrazione dell'anagrafica da DOCX viene completata con successo tramite `gemini-proxy`. Le chiamate successive mostrano a volte errori 500 dovuti a limiti di quota/rate limit (429/503) sulle API key di Google in cloud, ma il routing è corretto. Aggiunte pause `sleep(3000)` per mitigare il problema in ambiente di test.
- **Deploy**: Eseguito con successo il deploy della Edge Function `gemini-proxy` su Supabase Cloud.

---

## Storico Decisioni e Fatti Verificati della Sessione S43 (15 Luglio 2026 - Caricamento Rapido Spese Globale con AI & Rilevamento Duplicati)

### 1. Decisioni sul Workflow e Inserimento Rapido
- **Inserimento Spese Globale (Opzione 2)**: Implementata la pagina globale `/spese` accessibile dalla barra di navigazione principale. Questo risolve il problema visivo della voce rotta della sidebar.
- **Coda Sequenziale per Upload Multiplo (Max 10)**: Abilitato il caricamento drag-and-drop o manuale di fino a 10 fatture contemporaneamente. L'applicazione elabora i file uno dopo l'altro (coda sequenziale) per salvaguardare i token, ridurre i costi e rispettare i rate limit di Gemini Flash.
- **Matching Intelligente del Condominio**: L'AI estrae i dati fiscali del condominio destinatario e l'applicazione effettua un abbinamento automatico confrontando il Codice Fiscale, il Nome (tramite matching fuzzy escludendo parole comuni) o l'Indirizzo.
- **Riorganizzazione Props SpeseForm**: Modificato `SpeseForm.jsx` per accettare il file e i dati AI pre-analizzati a monte dalla coda globale, evitando doppie elaborazioni AI e velocizzando il rendering.
- **Rilevamento Fatture Duplicate su DB**: Inserito un controllo automatico debounced basato sulla tabella `fatture_fornitori`. Se esiste già una spesa dello stesso condominio con stesso numero fattura e fornitore, o stesso fornitore, data e importo, l'applicazione mostra un'allerta visibile e richiede di spuntare un checkbox di conferma per consentire il salvataggio manuale.

### 2. Bug e Regressioni Risolti (Fix Bug Triager)
- **Falso Positivo in Modifica Spese**: Corretto il filtro duplicati in `SpeseForm.jsx`. Invece di confrontare `d.id !== spesaInEdit.id` (che confrontava l'ID del record fattura con l'ID del record spesa, fallendo sempre), ora confronta `d.spesa_id !== spesaInEdit.id`.
- **Race Condition in Salvataggio Globale**: Introdotto lo stato `saving` in `SpeseGlobalPage.jsx` che disabilita i selettori di condominio ed esercizio a schermo per evitare modifiche asincrone durante l'upload e il salvataggio dei record.
- **Loader in Aggiornamento Dati**: Inserito un feedback visivo di caricamento per lo stato `'updating_data'` quando l'utente seleziona manualmente un condominio differente nella pagina globale.

### 3. Fatti Verificati
- **Verifica Build**: Eseguito `npm run build` con successo, build completata senza alcun errore di compilazione.
- **Push e Commit**: Caricate le modifiche sul repository GitHub ed eseguito il push su `origin main`.
- **Diagnostica Edge Function**: Modificata ed eseguito il deploy di `gemini-proxy` per esporre la risposta d'errore JSON originale di Google Gemini API, facilitando l'individuazione di problemi legati alle quote della chiave API.
- **Risoluzione SyntaxError JSON**: Aggiunto l'allerta di errore e il log `console.error` in `pulisciEdEstraiJson` per tracciare la stringa esatta in caso di fallimento di parsing JSON. Introdotta nel prompt di sistema di `estraiFattura` una direttiva esplicita per obbligare Gemini ad effettuare l'escaping (\") delle virgolette doppie all'interno dei campi di testo, e convertito lo schema descrittivo in un blocco JSON sintatticamente valido per evitare disorientamento nel motore di generazione di Gemini. Implementata una sanitizzazione regex client-side in `pulisciEdEstraiJson` per ripulire virgolette orfane su righe separate (es. `\n"\n}`) e virgole pendenti. Introdotto inoltre un algoritmo di bilanciamento delle parentesi graffe per determinare la chiusura effettiva del JSON principale e tagliare a monte qualsiasi carattere spurio extra posizionato in coda (es: parentesi graffe di chiusura duplicate `}}` o testi estranei), e filtri regex per l'autocorrezione di chiavi prive di virgolette (es: `{ chiave: ... }` ➡️ `{ "chiave": ... }`) e valori racchiusi da virgolette singole, blindando completamente il parsing del client contro i glitch sintattici dell'AI.
- **Risoluzione Modelli Sovraccarichi (503/429)**: Modificata la Edge Function `gemini-proxy` per introdurre un meccanismo di fallback incrociato generico usando gli alias validi per le API `v1beta` di Google (`['gemini-flash-latest', 'gemini-pro-latest', 'gemini-1.5-flash-latest', 'gemini-1.5-pro-latest']`). Se il modello di default (Flash) fallisce a causa del sovraccarico temporaneo dei server Google (`503 Service Unavailable`), l'applicazione passa automaticamente ed in modo trasparente ai modelli alternativi (famiglia Pro), escludendo loop di tentativi su alias equivalenti grazie a un helper di normalizzazione che raggruppa le varianti in categorie macro. In caso di fallimento di tutti i modelli della coda, il proxy restituisce al client un log dettagliato con lo status e l'errore specifico ritornato da Google per ciascuno dei modelli testati.
- **Persistenza della Coda al Cambio Pagina**: Creato il provider globale `SpeseQueueContext.jsx` e inserito in `App.jsx` per avvolgere le rotte protette. Questo sposta lo stato della coda di elaborazione delle spese al di fuori del componente `SpeseGlobalPage.jsx`, evitando che i dati inseriti o in fase di estrazione vengano persi quando l'utente naviga in un'altra schermata tramite la sidebar. Inserito inoltre un effetto di ripristino automatico al mount della pagina che riavvia a `'idle'` gli elementi che erano rimasti bloccati in `'analyzing'` a causa dell'unmount del componente.
- **Disattivazione Filtri di Sicurezza (safetySettings BLOCK_NONE)**: Aggiunta la configurazione di `safetySettings` impostata su `BLOCK_NONE` per tutte le categorie di danno nella Edge Function `gemini-proxy`. Questo previene troncature brusche del JSON a metà generazione (es: `Unterminated string in JSON`) causate da falsi positivi dei filtri automatici di Google che scambiano dati finanziari e codici fiscali delle fatture per contenuti sensibili.
- **Risoluzione Troncatura Generazione (Rimozione Forzatura JSON Mode)**: Disabilitato il rilevamento automatico della modalità JSON in `gemini-proxy` basato sulla regex `/json/i` sui prompt. L'attivazione di `responseMimeType: 'application/json'` sull'API di Gemini senza fornire uno schema strutturato (`responseSchema`) causava un'instabilità interna nel motore di generazione di Google, portando a troncature costanti e sistematiche a circa 150 caratteri (es: troncando su `"data_scadenza": "2025-`). Ora la modalità JSON nativa viene abilitata solo se esplicitamente richiesta dal client tramite `jsonMode: true` (es: in `BackofficePage.jsx`), lasciando che per l'estrazione delle fatture il modello Pro generi testo libero, il quale viene poi perfettamente isolato ed estratto dal parser client-side robusto `pulisciEdEstraiJson`.
- **Passaggio a Gemini Pro per Estrazioni Contabili**: Mappate le funzioni `'estrai_fattura'` ed `'estrai_movimenti'` sul modello Gemini Pro (`gemini-pro-latest`) all'interno di `getModel` nella Edge Function `gemini-proxy`. Gemini Flash, essendo un modello più piccolo, subiva frequenti blocchi o troncature arbitrarie a causa della complessità della struttura a 19 campi JSON richiesta dal prompt. Il modello Pro (equivalente a Claude 3.5 Sonnet) garantisce invece un'estrazione solida, esaustiva e stabile. Aggiunto inoltre l'inoltro di `finishReason` e `modelUsed` dal proxy verso il client per consentire al file `geminiClient.js` di loggare in console eventuali troncature per esaurimento token (`MAX_TOKENS`) o blocchi di sicurezza.
- **Risoluzione Bug Rilevamento Tabelle Millesimali**: Corretto un bug in `SpeseForm.jsx` per cui, all'avvio o al caricamento asincrono delle tabelle millesimali dal database, l'effetto `useEffect` di ricalcolo delle ripartizioni non veniva eseguito a causa della mancanza di `tabelleAssociate` nell'array delle dipendenze. Questo causava la mancata compilazione del riparto (con conseguente errore di validazione bloccante a schermo) anche se la tabella era selezionata. Introdotto inoltre il flag `is_doc: true` per le tabelle provenienti da documenti statici e un meccanismo di auto-selezione intelligente: se il condominio ha una sola tabella strutturata in archivio, o se ne ha una denominata "Generale" o "Proprietà", questa viene preselezionata automaticamente migliorando l'esperienza utente.

---

## Storico Decisioni e Fatti Verificati della Sessione S44 (15 Luglio 2026 - Riconciliazione E2E e Correzioni Paganti & Ripartizioni)

### 1. Decisioni sul Workflow E2E
- **Analisi AI e popolamento condominio VIA CANZIGHINA**: Configurato ed eseguito con successo un caricamento E2E reale per il condominio `"VIA CANZIGHINA"` (ID: `bf35b4e1-12b9-41b6-b23c-0dc4c3a2fb10`). Il caricamento include l'esercizio 2025, 11 unità estratte da `Millesimi Via Canzighina - rettificati.pdf` (con millesimi proprietà/scale esatti), 15 voci di preventivo da `2025 PREVENTIVO.pdf` ed anagrafiche.
- **Predisposizione Riconciliazioni**: Inserite le 3 fatture fornitori reali in stato `'attesa'` (CAPOZIO, Agenzia delle Entrate F24, Del Bo Servizi) con ripartizioni automatiche, consentendo a Gabriele di testare manualmente il caricamento e l'abbinamento degli estratti conto PDF di test.

### 2. Bug Risolti (Fix Bug Triager)
- **Esercizio ID in Configurazione Pagante**: Risolto il crash `column config_pagante_unita.condominio_id does not exist`. La tabella `config_pagante_unita` è legata al singolo esercizio contabile (`esercizio_id`). Modificata `RateGridTab.jsx` per caricare i dati per `esercizio_id` e ridisegnata `ConfigPagantePage.jsx` introducendo un selettore di esercizio contabile per la gestione delle impostazioni annuali.
- **Risoluzione Bug Ripartizioni Vuote in RipartizioniPage**: Risolto il bug per cui le ripartizioni caricate per l'esercizio non venivano mostrate in `RipartizionePage.jsx` a causa del filtro errato `.eq('condominio_id', condominioId)` (colonna inesistente sulla tabella `ripartizioni`). Sostituita con un filtro su `spese.esercizio_id` tramite `.select('*, spesa:spese!inner(...)').eq('spese.esercizio_id', esercizioId)`.
- **Bonifica Colonna Nominativo in Anagrafica**: Rimossi i riferimenti alla colonna inesistente `nominativo` nella tabella `persone` in `ConfigPagantePage.jsx`, `RipartizionePage.jsx` e nell'esportatore Excel `exportXlsx.js`. Le query ora caricano `nome` e `cognome` e il nominativo viene ricostruito dinamicamente in frontend, escludendo crash a runtime.
- **Superficie mq in Excel**: Allineato l'esportatore Excel `exportXlsx.js` per mappare la colonna superficie a `u.mq` (anziché `u.superficie` che risultava indefinito).
- **Nesting occupanti/occupanti_unita in Excel**: Implementato il fallback automatico su `occupanti || occupanti_unita` in `exportXlsx.js` per supportare in modo robusto entrambi i formati di nodi e prevenire colonne vuote o crash a seconda del componente chiamante.

### 3. Fatti Verificati
- **Verifica Build**: Eseguito `npm run build` con successo, build completata senza alcun errore di compilazione.
- **Push e Commit**: Caricate le modifiche sul repository GitHub ed eseguito il push su `origin main`.

---

## Storico Decisioni e Fatti Verificati della Sessione S45 (15 Luglio 2026 - Ristrutturazione Dashboard Globale)

### 1. Decisioni sulla Dashboard Globale
- **Ristrutturazione Dashboard Studio (`DashboardPage.jsx`)**: Sostituita la vecchia interfaccia statica con una dashboard dinamica e guidata dai dati del database Supabase, offrendo una panoramica centralizzata di tutto lo studio amministrativo.
- **KPI Finanziari Aggregati**: Calcolati dinamicamente quattro indicatori-chiave:
  - *Condomini Gestiti*: Numero totale di fabbricati attivi e archiviati.
  - *Morosità Totale*: Somma cumulativa di tutte le rate insolute con data scadenza passata (`dovuto - pagato` dove `scadenza < oggi`).
  - *Riconciliazioni Pendenti*: Numero complessivo di movimenti bancari non riconciliati.
  - *Fatture da Pagare*: Totale delle ditte in attesa di saldo (fatture in stato `'attesa'`).
- **Tabella Riepilogo Condomini**: Creata una griglia interattiva dei fabbricati con metriche di salute (unità, saldo banca aggiornato all'ultimo estratto conto con saldo, insoluti rate, fatture pendenti e movimenti da riconciliare per singolo condominio).
- **Pannello Urgenze ed Alerting**: Integrati tre tipi di alert amministrativi in tempo reale:
  - Scadenze F24 pendenti calcolate sulle ritenute d'acconto non presentate associate a fatture pagate nel mese precedente.
  - Esercizi contabili in scadenza nei prossimi 30 giorni.
  - Riconciliazioni arretrate (movimenti non abbinati da più di 15 giorni).

### 2. Bug Risolti (Fix Bug Triager)
- **Allineamento Schema DB su Dashboard e useNotifiche**: Risolte le incongruenze tra le query client-side e il database schema reale:
  - *Mappatura Rate*: Sostituiti i campi inesistenti `dovuto` e `scadenza` in `rate_unita` con `importo` e una join su `rate:rata_id(data_scadenza)`.
  - *Mappatura Date Estratto Conto*: Sostituito il campo inesistente `data` in `estratto_conto` con `data_movimento`.
  - *Mappatura F24*: Sostituito il campo inesistente `f24_presentato` in `fatture_fornitori` con `ritenuta_pagata`.
- **Prevenzione Crash Notifiche**: Corretto l'hook `useNotifiche.js` che presentava le stesse query errate su `rate_unita` ed `estratto_conto`. Mappate le risposte all'interno dell'hook per garantire piena compatibilità con l'engine puro `notificheEngine.js` senza alterarne la logica interna.
- **Risoluzione Problemi di Contrasto**: Cambiato il colore del testo per il badge `.ricTag` in `#7c3aed` per migliorarne l'accessibilità visiva e il contrasto in modalità chiara (Light Mode).

### 3. Fatti Verificati
- **Verifica Build**: Eseguito `npm run build` con esito verde e compilazione corretta del bundle di produzione.
- **Supporto Tematico**: Sincronizzate tutte le aree della nuova dashboard con le variabili CSS globali, assicurando un contrasto ottimale e transizioni pulite in modalità chiara e scura.
- **Push e Commit**: Eseguiti i commit `S43 step2` (ristrutturazione iniziale) e `S45 step2: risolve bug query db dashboard e useNotifiche` con push completato con successo su `origin main`.


