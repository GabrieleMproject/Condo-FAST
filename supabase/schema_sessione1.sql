-- ============================================
-- CondoAI — Schema iniziale Supabase
-- Sessione 1: tabella profili utenti
-- ============================================

-- Estensione UUID (già attiva su Supabase, ma per sicurezza)
create extension if not exists "uuid-ossp";

-- ─── Profili amministratori ──────────────────
-- Supabase crea automaticamente auth.users
-- Noi creiamo una tabella pubblica "profiles" collegata
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  nome text,
  cognome text,
  telefono text,
  studio_nome text,         -- es. "Studio Rossi & Associati"
  piva text,                -- partita IVA
  indirizzo text,
  citta text,
  cap text,
  piano text default 'trial',  -- 'trial' | 'active' | 'suspended'
  trial_ends_at timestamptz default (now() + interval '14 days'),
  stripe_customer_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS: ogni utente vede solo il proprio profilo
alter table public.profiles enable row level security;

create policy "Utente vede solo il proprio profilo"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Utente aggiorna solo il proprio profilo"
  on public.profiles for update
  using (auth.uid() = id);

-- Trigger: crea automaticamente il profilo alla registrazione
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, nome, cognome)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'nome',
    new.raw_user_meta_data->>'cognome'
  );
  return new;
end;
$$ language plpgsql security definer;

-- Collega il trigger all'evento di signup
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── Indici utili ─────────────────────────────
create index if not exists profiles_email_idx on public.profiles(email);
create index if not exists profiles_piano_idx on public.profiles(piano);
