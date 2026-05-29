import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { generarCodigo, sembrarCategoriasSiVacio } from '../lib/cuentas'

export default function CuentaMenu({ user, cuentas, cuentaActiva, onSwitch, onClose, onReload }) {
  const [vista, setVista] = useState('switch') // 'switch' | 'invitar' | 'crear' | 'unirse'
  const [codigoGenerado, setCodigoGenerado] = useState(null)
  const [generando, setGenerando] = useState(false)
  const [nombre, setNombre]       = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [codigoUnirse, setCodigoUnirse] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const esOwner = cuentaActiva?.role === 'owner' || cuentaActiva?.owner_id === user.id

  async function generar() {
    setGenerando(true)
    setError('')
    const codigo = generarCodigo()
    const { error: e1 } = await supabase.from('invitaciones').insert({
      cuenta_id:  cuentaActiva.id,
      codigo,
      created_by: user.id,
    })
    if (e1) { setError(e1.message); setGenerando(false); return }
    setCodigoGenerado(codigo)
    setGenerando(false)
  }

  async function crearOtra(e) {
    e.preventDefault()
    setError('')
    if (!nombre.trim()) { setError('Pon un nombre'); return }
    setBusy(true)
    const { data: authData, error: authErr } = await supabase.auth.getUser()
    if (authErr || !authData?.user) {
      setError('Sesión expirada'); setBusy(false); return
    }
    const uid = authData.user.id
    const cuentaId = crypto.randomUUID()
    const { error: e1 } = await supabase
      .from('cuentas')
      .insert({ id: cuentaId, nombre: nombre.trim(), descripcion: descripcion.trim() || null, owner_id: uid })
    if (e1) { setError(e1.message); setBusy(false); return }
    const { error: e2 } = await supabase.from('cuenta_miembros').insert({
      cuenta_id: cuentaId, user_id: uid, role: 'owner',
    })
    if (e2) { setError(e2.message); setBusy(false); return }
    await sembrarCategoriasSiVacio(cuentaId)
    setBusy(false)
    setNombre(''); setDescripcion('')
    await onReload()
    onSwitch({ id: cuentaId, nombre: nombre.trim(), descripcion: descripcion.trim() || null, owner_id: uid, role: 'owner' })
    onClose()
  }

  async function unirseOtra(e) {
    e.preventDefault()
    setError('')
    const code = codigoUnirse.trim().toUpperCase()
    if (!code) { setError('Pega el código'); return }
    setBusy(true)
    const { data: inv, error: e1 } = await supabase
      .from('invitaciones')
      .select('id, cuenta_id, used_by')
      .eq('codigo', code).maybeSingle()
    if (e1 || !inv) { setError('Código no válido'); setBusy(false); return }
    if (inv.used_by)  { setError('Ese código ya fue usado'); setBusy(false); return }
    const { error: e2 } = await supabase.from('cuenta_miembros').insert({
      cuenta_id: inv.cuenta_id, user_id: user.id, role: 'member',
    })
    if (e2) { setError(e2.message); setBusy(false); return }
    await supabase.from('invitaciones')
      .update({ used_by: user.id, used_at: new Date().toISOString() })
      .eq('id', inv.id)
    setBusy(false)
    setCodigoUnirse('')
    await onReload()
    onClose()
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 200, padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} className="card w-full max-w-md"
        style={{ background: 'white', borderColor: '#d0ece4', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-medium text-slate-800">Cuentas</h2>
          <button onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-lg leading-none">✕</button>
        </div>

        <div className="flex rounded-xl p-1 mb-4" style={{ background: '#f0faf6', fontSize: 12 }}>
          {[
            ['switch', 'Cambiar'],
            ['invitar', 'Invitar'],
            ['crear', '+ Nueva'],
            ['unirse', 'Unirme'],
          ].map(([k, label]) => (
            <button key={k} onClick={() => { setVista(k); setError(''); setCodigoGenerado(null) }}
              className="flex-1 py-1.5 font-medium rounded-lg transition-all"
              style={vista === k
                ? { background: 'white', color: '#1F7A5C' }
                : { color: '#9ca3af' }}>
              {label}
            </button>
          ))}
        </div>

        {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg p-2.5 mb-3">{error}</p>}

        {vista === 'switch' && (
          <div className="space-y-2">
            <p className="text-xs text-slate-500 mb-2">
              Una <strong>cuenta</strong> puede ser un hogar, proyecto, equipo, etc.
            </p>
            {cuentas.map(c => (
              <button key={c.id}
                onClick={() => { onSwitch(c); onClose() }}
                className="w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all hover:bg-slate-50"
                style={{
                  borderColor: c.id === cuentaActiva?.id ? '#1F7A5C' : '#d0ece4',
                  background: c.id === cuentaActiva?.id ? '#f0faf6' : 'white',
                }}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{c.nombre}</p>
                  {c.descripcion && (
                    <p className="text-xs text-slate-400 truncate">{c.descripcion}</p>
                  )}
                </div>
                <span className="text-xs text-slate-400">
                  {c.role === 'owner' ? 'owner' : 'miembro'}
                </span>
                {c.id === cuentaActiva?.id && (
                  <span style={{ color: '#1F7A5C', fontSize: 16 }}>✓</span>
                )}
              </button>
            ))}
          </div>
        )}

        {vista === 'invitar' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              Genera un código de un solo uso para que alguien se una a <strong>{cuentaActiva?.nombre}</strong>.
            </p>
            {!esOwner && (
              <p className="text-xs text-amber-600 bg-amber-50 rounded-lg p-2.5">
                Solo el owner puede generar códigos de invitación.
              </p>
            )}
            {codigoGenerado ? (
              <div className="space-y-2">
                <div style={{
                  background: '#f0faf6', borderRadius: 12, padding: 16, textAlign: 'center',
                  fontFamily: 'monospace', fontSize: 24, fontWeight: 600, letterSpacing: '0.15em', color: '#1F7A5C',
                  border: '1px solid #d0ece4',
                }}>
                  {codigoGenerado}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => navigator.clipboard?.writeText(codigoGenerado)}
                    className="flex-1 py-2 rounded-lg text-xs font-medium border"
                    style={{ borderColor: '#d0ece4', color: '#1F7A5C' }}>
                    Copiar
                  </button>
                  <button onClick={() => { setCodigoGenerado(null); generar() }}
                    disabled={generando}
                    className="flex-1 py-2 rounded-lg text-xs font-medium"
                    style={{ background: '#1F7A5C', color: 'white', opacity: generando ? 0.6 : 1 }}>
                    Generar otro
                  </button>
                </div>
                <p className="text-xs text-slate-400">
                  Compártelo. Solo sirve una vez.
                </p>
              </div>
            ) : (
              <button onClick={generar} disabled={generando || !esOwner}
                className="w-full py-2.5 rounded-xl text-sm font-medium"
                style={{ background: '#1F7A5C', color: 'white', opacity: (generando || !esOwner) ? 0.6 : 1 }}>
                {generando ? 'Generando...' : 'Generar código'}
              </button>
            )}
          </div>
        )}

        {vista === 'crear' && (
          <form onSubmit={crearOtra} className="space-y-3">
            <div>
              <label className="label">Nombre</label>
              <input className="input" autoFocus value={nombre}
                onChange={e => setNombre(e.target.value)}
                placeholder="Ej: Viaje 2026, Equipo, Personal" required />
            </div>
            <div>
              <label className="label">Descripción (opcional)</label>
              <input className="input" value={descripcion}
                onChange={e => setDescripcion(e.target.value)} />
            </div>
            <button type="submit" disabled={busy}
              className="w-full py-2.5 rounded-xl text-sm font-medium"
              style={{ background: '#1F7A5C', color: 'white', opacity: busy ? 0.6 : 1 }}>
              {busy ? 'Creando...' : 'Crear cuenta'}
            </button>
          </form>
        )}

        {vista === 'unirse' && (
          <form onSubmit={unirseOtra} className="space-y-3">
            <div>
              <label className="label">Código de invitación</label>
              <input className="input" autoFocus value={codigoUnirse}
                onChange={e => setCodigoUnirse(e.target.value.toUpperCase())}
                placeholder="A1B2C3D4" required
                style={{ fontFamily: 'monospace', letterSpacing: '0.1em' }} />
            </div>
            <button type="submit" disabled={busy}
              className="w-full py-2.5 rounded-xl text-sm font-medium"
              style={{ background: '#1F7A5C', color: 'white', opacity: busy ? 0.6 : 1 }}>
              {busy ? 'Uniéndome...' : 'Unirme'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
