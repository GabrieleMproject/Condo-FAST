# Lista delle cose da fare (TODO)

## Ottimizzazioni Tecniche (State Management)
Questi task riguardano il refactoring di alcuni componenti React per eliminare i warning di ESLint ed evitare re-render superflui. Sono task di manutenzione e non bloccano il funzionamento dell'app.

- [ ] **Risolvere `react-hooks/exhaustive-deps` (circa 47 file)**: Aggiungere le dipendenze mancanti agli array dei vari `useEffect` per evitare che lo stato diventi obsoleto (*stale closures*). Ove necessario, avvolgere le funzioni in `useCallback`.
- [ ] **Risolvere `react-hooks/set-state-in-effect` (circa 55 file)**: Spostare le logiche che calcolano stati derivati fuori dai `useEffect` e calcolarle direttamente durante il render (usando `useMemo`), oppure inizializzare lo stato correttamente. Questo eviterà render a cascata e ottimizzerà le prestazioni (es. in `PostboxPage`, `BackofficePage`, ecc.).
- [ ] **`src/components/SpeseForm.jsx`**: Risolvere il TODO presente nel codice alla riga 645 (avvolgere `calcolaRipartizioni` in `useCallback`).

---
*Ultimo aggiornamento: Ottimizzazione e fix dei crash a runtime completati.*
