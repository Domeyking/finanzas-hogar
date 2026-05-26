import { useState } from 'react'
import { supabase } from '../lib/supabase'
import Logo from '../components/Logo'

export default function Login() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [name, setName]         = useState('')
  const [mode, setMode]         = useState('login')
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
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#f4faf7' }}>
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8 gap-3">
          <div style={{
            width: 64, height: 64, borderRadius: 18,
            background: 'white',
            border: '0.5px solid #d0ece4',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#1F7A5C" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
          </div>
          <Logo size="lg" />
          <p className="text-sm text-slate-400">Control financiero en pareja</p>
        </div>

        <div className="card" style={{ background: 'white', borderColor: '#d0ece4' }}>
          <div className="flex rounded-xl p-1 mb-5" style={{ background: '#f0faf6' }}>
            {['login', 'register'].map(m => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(''); setSuccess('') }}
                className="flex-1 py-1.5 text-sm font-medium rounded-lg transition-all"
                style={mode === m
                  ? { background: 'white', color: '#1F7A5C' }
                  : { color: '#9ca3af' }}
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

            <button type="submit" disabled={loading}
              className="w-full mt-1 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{ background: '#1F7A5C', color: 'white', opacity: loading ? 0.6 : 1 }}>
              {loading ? 'Cargando...' : mode === 'login' ? 'Ingresar' : 'Crear cuenta'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
