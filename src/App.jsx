import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { useCuentas } from './lib/cuentas'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import CrearOUnirseCuenta from './pages/CrearOUnirseCuenta'

export default function App() {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)
  const cuentaCtx = useCuentas(user)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (loading) return <Spinner />
  if (!user)   return <Login />
  if (cuentaCtx.loading) return <Spinner />
  if (!cuentaCtx.cuentaActiva) {
    return (
      <CrearOUnirseCuenta
        user={user}
        onReady={cuentaCtx.reload}
        onLogout={() => supabase.auth.signOut()}
      />
    )
  }
  return <Dashboard user={user} cuentaCtx={cuentaCtx} />
}

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
    </div>
  )
}
