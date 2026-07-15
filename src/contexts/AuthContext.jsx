import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let channel = null
    const currentSessionId = (() => {
      let sid = sessionStorage.getItem('condosmart_session_id')
      if (!sid) {
        sid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2)
        sessionStorage.setItem('condosmart_session_id', sid)
      }
      return sid
    })()

    const setupSessionTracker = async (currentUser) => {
      if (!currentUser) return

      try {
        // Registra o aggiorna la sessione corrente sul database
        await supabase.from('user_sessions').upsert({
          user_id: currentUser.id,
          session_id: currentSessionId,
          updated_at: new Date().toISOString()
        })

        // Rimuove in modo pulito il canale precedente se esistente per evitare collisioni
        if (channel) {
          await supabase.removeChannel(channel)
          channel = null
        }
        
        channel = supabase
          .channel(`user_sessions_${currentUser.id}_${currentSessionId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'user_sessions',
              filter: `user_id=eq.${currentUser.id}`
            },
            (payload) => {
              if (payload.new && payload.new.session_id !== currentSessionId) {
                // Notifica l'utente e disconnetti
                alert('Sessione disconnessa: è stato rilevato un accesso da un altro dispositivo con questo account.')
                supabase.auth.signOut()
              }
            }
          )
          .subscribe()
      } catch (err) {
        console.error('Errore nel tracciamento della sessione:', err)
      }
    }

    // Recupera sessione iniziale
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      const currentUser = session?.user ?? null
      setUser(currentUser)
      if (currentUser) {
        setupSessionTracker(currentUser)
      }
      setLoading(false)
    })

    // Ascolta cambiamenti auth (login, logout, refresh token)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      const currentUser = session?.user ?? null
      setUser(currentUser)
      
      if (event === 'SIGNED_IN' && currentUser) {
        setupSessionTracker(currentUser)
      } else if (event === 'SIGNED_OUT') {
        if (channel) {
          channel.unsubscribe()
          channel = null
        }
      }
    })

    return () => {
      subscription.unsubscribe()
      if (channel) channel.unsubscribe()
    }
  }, [])

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    return { data, error }
  }

  const signUp = async (email, password, metadata = {}) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: metadata }
    })
    return { data, error }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const resetPassword = async (email) => {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    return { data, error }
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut, resetPassword }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve essere usato dentro <AuthProvider>')
  return ctx
}
