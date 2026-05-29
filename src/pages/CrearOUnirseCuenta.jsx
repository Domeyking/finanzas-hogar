import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { sembrarCategoriasSiVacio } from '../lib/cuentas'
import Logo from '../components/Logo'

export default function CrearOUnirseCuenta({ user, onReady, onLogout }) {
  const [modo, setModo]     = useState('crear')
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [codigo, setCodigo] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')

  async function crear(e) {
    e.preventDefault()
    setError('')
    if (!nombre.trim()) { setError('Pon un nombre'); return }
    setLoading(true)

    const { data: cuenta, error: e1 } = await supabase
      .from('cuentas')
      .insert({
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
        owner_id: user.id,
      })
      .select()
      .single()
    if (e1) { setError(e1.message); setLoading(false); return }

    const { error: e2 } = await supabase.from('cuenta_miembros').insert({
      cuenta_id: cuenta.id,
      user_id:   user.id,
      role:      'owner',
    })
    if (e2) { setError(e2.message); setLoading(false); return }

    await sembrarCategoriasSiVacio(cuenta.id)

    setLoading(false)
    onReady()
  }

  async function unirse(e) {
    e.preventDefault()
    setError('')
    const code = codigo.trim().toUpperCase()
    if (!code) { setError('Pega el código'); return }
    setLoading(true)

    const { data: inv, error: e1 } = await supabase
      .from('invitaciones')
      .select('id, cuenta_id, used_by')
      .eq('codigo', code)
      .maybeSingle()
    if (e1 || !inv) {
      setError('Código no válido'); setLoading(false); return
    }
    if (inv.used_by) {
      setError('Este código ya fue usado'); setLoading(false); return
    }

    const { error: e2 } = await supabase.from('cuenta_miembros').insert({
      cuenta_id: inv.cuenta_id,
      user_id:   user.id,
      role:      'member',
    })
    if (e2) { setError(e2.message); setLoading(false); return }

    await supabase.from('invitaciones')
      .update({ used_by: user.id, used_at: new Date().toISOString() })
      .eq('id', inv.id)

    setLoading(false)
    onReady()
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#f4faf7' }}>
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6 gap-3">
          <Logo size="lg" />
          <p className="text-sm text-slate-500 text-center">
            Crea una <strong>Cuenta</strong> o únete a una existente.
            <br />
            <span className="text-xs text-slate-400">Puede ser un hogar, proyecto, equipo, etc.</span>
          </p>
        </div>

        <div className="card" style={{ background: 'white', borderColor: '#d0ece4' }}>
          <div className="flex rounded-xl p-1 mb-5" style={{ background: '#f0faf6' }}>
            {['crear', 'unirse'].map(m => (
              <button key={m} onClick={() => { setModo(m); setError('') }}
                className="flex-1 py-1.5 text-sm font-medium rounded-lg transition-all"
                style={modo === m
                  ? { background: 'white', color: '#1F7A5C' }
                  : { color: '#9ca3af' }}>
                {m === 'crear' ? 'Crear nueva' : 'Unirme con código'}
              </button>
            ))}
          </div>

          {modo === 'crear' && (
            <form onSubmit={crear} className="space-y-3">
              <div>
                <label className="label">Nombre</label>
                <input className="input" autoFocus value={nombre}
                  onChange={e => setNombre(e.target.value)}
                  placeholder="Ej: Hogar, Equipo de trabajo, Viaje 2026" required />
              </div>
              <div>
                <label className="label">Descripción (opcional)</label>
                <input className="input" value={descripcion}
                  onChange={e => setDescripcion(e.target.value)}
                  placeholder="¿De qué se trata?" />
              </div>
              {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg p-2.5">{error}</p>}
              <button type="submit" disabled={loading}
                className="w-full py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{ background: '#1F7A5C', color: 'white', opacity: loading ? 0.6 : 1 }}>
                {loading ? 'Creando...' : 'Crear cuenta'}
              </button>
            </form>
          )}

          {modo === 'unirse' && (
            <form onSubmit={unirse} className="space-y-3">
              <div>
                <label className="label">Código de invitación</label>
                <input className="input" autoFocus value={codigo}
                  onChange={e => setCodigo(e.target.value.toUpperCase())}
                  placeholder="Ej: A1B2C3D4" required
                  style={{ fontFamily: 'monospace', letterSpacing: '0.1em', textTransform: 'uppercase' }} />
                <p className="text-xs text-slate-400 mt-1">
                  Pide a alguien de la cuenta que te genere un código.
                </p>
              </div>
              {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg p-2.5">{error}</p>}
              <button type="submit" disabled={loading}
                className="w-full py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{ background: '#1F7A5C', color: 'white', opacity: loading ? 0.6 : 1 }}>
                {loading ? 'Uniéndome...' : 'Unirme a la cuenta'}
              </button>
            </form>
          )}
        </div>

        {onLogout && (
          <button onClick={onLogout}
            className="w-full mt-4 text-xs text-slate-400 hover:text-slate-600">
            Salir de la sesión
          </button>
        )}
      </div>
    </div>
  )
}
