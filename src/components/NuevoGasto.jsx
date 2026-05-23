import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { CATEGORIAS, FUENTES } from '../lib/constants'

export default function NuevoGasto({ user, onSaved, onCancel }) {
  const hoy = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    fecha: hoy,
    descripcion: '',
    monto: '',
    categoria: CATEGORIAS[1],
    fuente: FUENTES[0],
    notas: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const monto = parseInt(form.monto.replace(/\D/g, ''), 10)
    if (!monto || monto <= 0) { setError('Ingresa un monto válido'); return }

    setLoading(true)
    const { error } = await supabase.from('gastos').insert({
      user_id:     user.id,
      user_name:   user.user_metadata?.full_name || user.email.split('@')[0],
      fecha:       form.fecha,
      descripcion: form.descripcion,
      monto,
      categoria:   form.categoria,
      fuente:      form.fuente,
      notas:       form.notas || null,
    })
    setLoading(false)
    if (error) { setError(error.message); return }
    onSaved()
  }

  function formatMonto(raw) {
    const digits = raw.replace(/\D/g, '')
    if (!digits) return ''
    return parseInt(digits, 10).toLocaleString('es-CL')
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-slate-800">Nuevo gasto</h2>
        {onCancel && (
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 text-lg leading-none">✕</button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Fecha</label>
            <input className="input" type="date" value={form.fecha}
              onChange={e => set('fecha', e.target.value)} required />
          </div>
          <div>
            <label className="label">Monto ($)</label>
            <input className="input" inputMode="numeric" placeholder="0"
              value={form.monto}
              onChange={e => set('monto', formatMonto(e.target.value))}
              required />
          </div>
        </div>

        <div>
          <label className="label">Descripción</label>
          <input className="input" placeholder="Ej: JUMBO Las Condes" value={form.descripcion}
            onChange={e => set('descripcion', e.target.value)} required />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Categoría</label>
            <select className="input" value={form.categoria} onChange={e => set('categoria', e.target.value)}>
              {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Fuente</label>
            <select className="input" value={form.fuente} onChange={e => set('fuente', e.target.value)}>
              {FUENTES.map(f => <option key={f}>{f}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="label">Notas (opcional)</label>
          <input className="input" placeholder="Ej: compra semanal" value={form.notas}
            onChange={e => set('notas', e.target.value)} />
        </div>

        {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg p-2.5">{error}</p>}

        <button type="submit" className="btn-primary w-full" disabled={loading}>
          {loading ? 'Guardando...' : 'Guardar gasto'}
        </button>
      </form>
    </div>
  )
}
