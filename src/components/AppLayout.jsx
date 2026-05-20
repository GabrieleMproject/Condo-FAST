import { useState } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function AppLayout() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  const condominioMatch = location.pathname.match(/\/condomini\/([^/]+)/)
  const condominioId = condominioMatch ? condominioMatch[1] : null

  const handleSignOut = async () => {
    setSigningOut(true)
    try { await signOut(); navigate('/login') }
    finally { setSigningOut(false) }
  }

  const initials = user?.email?.substring(0, 2).toUpperCase() || 'AU'

  const ITEMS = [
    { to: '/dashboard',   icon: '📊', label: 'Dashboard' },
    { to: '/condomini',   icon: '🏢', label: 'Condomini' },
    { to: '/assemblee',   icon: '📅', label: 'Assemblee',    soon: true },
    { to: '/contabilita', icon: '💰', label: 'Contabilità',  soon: true },
    { to: '/documenti',   icon: '📁', label: 'Documenti',    soon: true },
    { to: '/comunicazioni', icon: '✉️', label: 'Comunicazioni', soon: true },
  ]

  return (
    <div style={{display:'flex',height:'100vh',background:'#0f172a',fontFamily:'Sora,sans-serif',overflow:'hidden'}}>
      <aside style={{width:collapsed?64:240,background:'#1e293b',display:'flex',flexDirection:'column',borderRight:'1px solid #334155',transition:'width .25s',flexShrink:0,overflow:'hidden'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'20px 16px',borderBottom:'1px solid #334155'}}>
          {!collapsed && <span style={{color:'#e2e8f0',fontSize:16,fontWeight:700}}>🏢 CondoAI</span>}
          <button style={{background:'none',border:'none',color:'#64748b',cursor:'pointer',fontSize:16}} onClick={()=>setCollapsed(!collapsed)}>
            {collapsed?'→':'←'}
          </button>
        </div>
        <nav style={{display:'flex',flexDirection:'column',gap:2,padding:'12px 8px',flex:1}}>
          {ITEMS.map(item => item.soon ? (
            <div key={item.to} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 12px',borderRadius:8,color:'#475569',borderLeft:'3px solid transparent'}}>
              <span style={{fontSize:16,width:20,textAlign:'center'}}>{item.icon}</span>
              {!collapsed && <><span style={{flex:1,fontSize:13}}>{item.label}</span><span style={{fontSize:9,background:'#1e3a5f',color:'#60a5fa',padding:'2px 6px',borderRadius:10,fontWeight:700}}>Presto</span></>}
            </div>
          ) : (
            <NavLink key={item.to} to={item.to}
              style={({isActive})=>({display:'flex',alignItems:'center',gap:10,padding:'9px 12px',borderRadius:8,textDecoration:'none',fontSize:13,fontWeight:500,background:isActive?'rgba(59,130,246,0.15)':'transparent',color:isActive?'#60a5fa':'#94a3b8',borderLeft:isActive?'3px solid #3b82f6':'3px solid transparent'})}>
              <span style={{fontSize:16,width:20,textAlign:'center'}}>{item.icon}</span>
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          ))}
          {condominioId && (
            <NavLink to={`/condomini/${condominioId}/anagrafica`}
              style={({isActive})=>({display:'flex',alignItems:'center',gap:10,padding:'9px 12px',borderRadius:8,textDecoration:'none',fontSize:13,fontWeight:500,background:isActive?'rgba(59,130,246,0.15)':'transparent',color:isActive?'#60a5fa':'#94a3b8',borderLeft:isActive?'3px solid #3b82f6':'3px solid transparent',marginTop:8,borderTop:'1px solid #1e293b'})}>
              <span style={{fontSize:16,width:20,textAlign:'center'}}>👥</span>
              {!collapsed && <span>Anagrafica</span>}
            </NavLink>
          )}
        </nav>
        <div style={{display:'flex',alignItems:'center',gap:10,padding:'12px',borderTop:'1px solid #334155'}}>
          <div style={{width:32,height:32,borderRadius:'50%',background:'#2563eb',color:'white',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,flexShrink:0}}>{initials}</div>
          {!collapsed && <div style={{flex:1,overflow:'hidden'}}><div style={{color:'#e2e8f0',fontSize:11,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{user?.email}</div><div style={{color:'#64748b',fontSize:10}}>Amministratore</div></div>}
          <button style={{background:'none',border:'none',color:'#64748b',cursor:'pointer',fontSize:16}} onClick={handleSignOut} disabled={signingOut}>🚪</button>
        </div>
      </aside>
      <main style={{flex:1,overflowY:'auto',background:'#0f172a'}}><Outlet /></main>
    </div>
  )
}
