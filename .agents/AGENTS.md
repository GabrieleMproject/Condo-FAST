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
- **Chatbot AI in Assistenza:** Il form ticket statico in `AssistenzaPage` è stato rimosso e sostituito con una Chatbot AI UI interattiva (che conosce la mappa del sito CondoAI).
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




