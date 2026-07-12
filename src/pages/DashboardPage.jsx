import { useAuth } from '../contexts/AuthContext'
import { useCondomini } from '../hooks/useCondomini'
import { Building2, CheckCircle2, Home, Calendar } from 'lucide-react'

export default function DashboardPage() {
  const { user } = useAuth()
  const { condomini } = useCondomini()

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Amministratore'
  const attivi = condomini.filter(c => c.stato === 'attivo').length
  const unita  = condomini.reduce((s, c) => s + (c.num_unita || 0), 0)

  return (
    <div style={{padding:'32px',background: 'var(--app-bg)',minHeight:'100vh',fontFamily:'Sora,sans-serif'}}>
      <h1 style={{color: 'var(--text-primary)',fontSize:28,fontWeight:700,margin:'0 0 4px'}}>Dashboard</h1>
      <p style={{color: 'var(--text-muted)',fontSize:14,marginBottom:32}}>Benvenuto, {userName}</p>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:16,marginBottom:32}}>
        {[
          {label:'Condomini gestiti', value: condomini.length, icon: Building2, color:'#3b82f6'},
          {label:'Condomini attivi',  value: attivi,           icon: CheckCircle2, color:'#16a34a'},
          {label:'Unità totali',      value: unita,            icon: Home, color:'#d97706'},
          {label:'Scadenze mese',     value: '—',              icon: Calendar, color:'#dc2626'},
        ].map(k => (
          <div key={k.label} style={{background: 'var(--card-bg)',borderRadius:14,padding:'20px',border:`1px solid #334155`,borderLeft:`4px solid ${k.color}`}}>
            <div style={{color:k.color,marginBottom:8}}><k.icon size={28} /></div>
            <div style={{color: 'var(--text-primary)',fontSize:26,fontWeight:700}}>{k.value}</div>
            <div style={{color: 'var(--text-muted)',fontSize:13}}>{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{background: 'var(--card-bg)',borderRadius:14,padding:'32px',border: '1px solid var(--border-color)',textAlign:'center'}}>
        <div style={{display:'flex',justifyContent:'center',marginBottom:12}}><Building2 size={48} style={{color:'#3b82f6'}} /></div>
        <h3 style={{color: 'var(--text-primary)',fontSize:18,fontWeight:700,marginBottom:8}}>Sessione 3 completata</h3>
        <p style={{color: 'var(--text-muted)',fontSize:14}}>Anagrafica unità, proprietari e inquilini operativa.</p>
      </div>
    </div>
  )
}
