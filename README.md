# CondoAI — Setup Sessione 1

## Setup locale

```bash
# 1. Entra nella cartella
cd condoai

# 2. Installa dipendenze
npm install

# 3. Crea il file .env (copia dal template)
cp .env.example .env

# 4. Compila .env con le tue credenziali Supabase
# (le trovi in Supabase > Project Settings > API)

# 5. Avvia il server di sviluppo
npm run dev
```

## Setup Supabase

1. Vai su [supabase.com](https://supabase.com) → il tuo progetto
2. Apri **SQL Editor**
3. Incolla ed esegui tutto il contenuto di `supabase/schema_sessione1.sql`
4. Vai su **Authentication > Email Templates** e personalizza le email (opzionale per ora)

## Struttura file

```
src/
├── contexts/
│   └── AuthContext.jsx      ← gestione sessione globale
├── components/
│   └── ProtectedRoute.jsx   ← blocca accesso senza login
├── pages/
│   ├── LoginPage.jsx
│   ├── RegisterPage.jsx
│   ├── ForgotPasswordPage.jsx
│   └── DashboardPage.jsx
├── lib/
│   └── supabaseClient.js    ← client Supabase singleton
├── App.jsx                  ← router
├── main.jsx                 ← entry point
└── index.css                ← stili globali
```

## Deploy su Vercel

```bash
# Installa Vercel CLI (se non ce l'hai)
npm i -g vercel

# Deploy
vercel

# Aggiungi le variabili d'ambiente su Vercel:
# VITE_SUPABASE_URL
# VITE_SUPABASE_ANON_KEY
```

Il file `vercel.json` gestisce già il routing SPA (redirect tutto a index.html).
