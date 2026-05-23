import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [name, setName]         = useState('')
  const [mode, setMode]         = useState('login') // 'login' | 'register'
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [success, setSuccess]   = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    if (mode === 'register') {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      })
      if (error) setError(error.message)
      else setSuccess('Cuenta creada. Revisa tu email para confirmar.')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError('Email o contraseña incorrectos.')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-brand-light flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-slate-800">Finanzas del hogar</h1>
          <p className="text-sm text-slate-500 mt-1">Control financiero en pareja</p>
        </div>

        <div className="card">
          <div className="flex rounded-xl bg-slate-100 p-1 mb-5">
            {['login', 'register'].map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(''); setSuccess('') }}
                className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-all ${
                  mode === m ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'
                }`}
              >
                {m === 'login' ? 'Ingresar' : 'Registrarse'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === 'register' && (
              <div>
                <label className="label">Tu nombre</label>
                <input className="input" placeholder="Ej: María" value={name}
                  onChange={e => setName(e.target.value)} required />
              </div>
            )}
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" placeholder="tu@email.com" value={email}
                onChange={e => setEmail(e.target.value)} required />
            </div>
            <div>
              <label className="label">Contraseña</label>
              <input className="input" type="password" placeholder="••••••••" value={password}
                onChange={e => setPassword(e.target.value)} required minLength={6} />
            </div>

            {error   && <p className="text-xs text-red-500 bg-red-50 rounded-lg p-2.5">{error}</p>}
            {success && <p className="text-xs text-green-600 bg-green-50 rounded-lg p-2.5">{success}</p>}

            <button type="submit" className="btn-primary w-full mt-1" disabled={loading}>
              {loading ? 'Cargando...' : mode === 'login' ? 'Ingresar' : 'Crear cuenta'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
