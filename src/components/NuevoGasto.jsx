import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { FUENTES } from '../lib/constants'
import { useCategorias, subcategoriasDe } from '../lib/categorias'

export default function NuevoGasto({ user, cuentaId, onSaved, onCancel, gastoEditar }) {
  const { nombres: CATEGORIAS, items, cargando } = useCategorias(cuentaId)
  const hoy = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    fecha: hoy,
    descripcion: '',
    monto: '',
    categoria: CATEGORIAS[1] || CATEGORIAS[0] || '',
    subcategoria: '',
    fuente: FUENTES[0],
    notas: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [similares, setSimilares] = useState(null) // { gastos, nuevaCat, gastoId }

  useEffect(() => {
    if (gastoEditar) {
      setForm({
        fecha:        gastoEditar.fecha,
        descripcion:  gastoEditar.descripcion,
        monto:        Number(gastoEditar.monto).toLocaleString('es-CL'),
        categoria:    gastoEditar.categoria,
        subcategoria: gastoEditar.subcategoria || '',
        fuente:       gastoEditar.fuente,
        notas:        gastoEditar.notas || '',
      })
    }
  }, [gastoEditar])

  useEffect(() => {
    if (!gastoEditar && CATEGORIAS.length > 0 && !CATEGORIAS.includes(form.categoria)) {
      setForm(f => ({ ...f, categoria: CATEGORIAS[1] || CATEGORIAS[0] || '' }))
    }
  }, [CATEGORIAS, gastoEditar])

  const subs = subcategoriasDe(items, form.categoria)

  useEffect(() => {
    // No limpiar mientras las categorías cargan: subs podría estar vacío
    // sólo porque todavía no llegó la data, y borraríamos un valor válido.
    if (cargando) return
    if (form.subcategoria && !subs.find(s => s.nombre === form.subcategoria)) {
      setForm(f => ({ ...f, subcategoria: '' }))
    }
  }, [form.categoria, cargando]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function buscarSimilares(descripcion, nuevaCategoria, gastoId) {
    if (!descripcion || !cuentaId) return []
    const palabras = descripcion.trim().split(/\s+/).filter(p => p.length >= 4)
    if (palabras.length === 0) return []
    const keyword = palabras[0]
    const { data } = await supabase
      .from('gastos')
      .select('id, fecha, descripcion, monto, categoria')
      .eq('cuenta_id', cuentaId)
      .ilike('descripcion', `%${keyword}%`)
      .neq('categoria', nuevaCategoria)
      .neq('id', gastoId || '00000000-0000-0000-0000-000000000000')
      .order('fecha', { ascending: false })
      .limit(50)
    return data || []
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const monto = parseInt(form.monto.replace(/\D/g, ''), 10)
    if (!monto || monto <= 0) { setError('Ingresa un monto válido'); return }

    setLoading(true)
    const payload = {
      fecha:        form.fecha,
      descripcion:  form.descripcion,
      monto,
      categoria:    form.categoria,
      subcategoria: form.subcategoria || null,
      fuente:       form.fuente,
      notas:        form.notas || null,
    }

    if (gastoEditar) {
      const cambioCategoria = gastoEditar.categoria !== form.categoria
      const { error } = await supabase
        .from('gastos').update(payload).eq('id', gastoEditar.id)
      setLoading(false)
      if (error) { setError(error.message); return }
      if (cambioCategoria) {
        const list = await buscarSimilares(form.descripcion, form.categoria, gastoEditar.id)
        if (list.length > 0) {
          setSimilares({ gastos: list, nuevaCat: form.categoria })
          return
        }
      }
    } else {
      const { error } = await supabase.from('gastos').insert({
        ...payload,
        cuenta_id:   cuentaId,
        user_id:     user.id,
        user_name:   user.user_metadata?.full_name || user.email.split('@')[0],
      })
      setLoading(false)
      if (error) { setError(error.message); return }
    }
    onSaved()
  }

  async function aplicarReclasificacion(ids) {
    if (ids.length > 0) {
      await supabase
        .from('gastos')
        .update({ categoria: similares.nuevaCat, subcategoria: null })
        .in('id', ids)

      const keyword = form.descripcion.trim().split(/\s+/).find(p => p.length >= 4)
      if (keyword && cuentaId) {
        await supabase.from('reglas_categoria').upsert(
          { cuenta_id: cuentaId, user_id: user.id, keyword: keyword.toLowerCase(), categoria: similares.nuevaCat },
          { onConflict: 'cuenta_id,keyword' }
        )
      }
    }
    setSimilares(null)
    onSaved()
  }

  function formatMonto(raw) {
    const digits = raw.replace(/\D/g, '')
    if (!digits) return ''
    return parseInt(digits, 10).toLocaleString('es-CL')
  }

  if (similares) {
    return (
      <SimilaresModal
        gastos={similares.gastos}
        nuevaCat={similares.nuevaCat}
        onConfirm={aplicarReclasificacion}
        onSkip={() => { setSimilares(null); onSaved() }}
      />
    )
  }

  return (
    <div className="card" style={{ background: 'white', borderColor: '#d0ece4' }}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-medium text-slate-800">
          {gastoEditar ? 'Editar gasto' : 'Nuevo gasto'}
        </h2>
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

        {subs.length > 0 && (
          <div>
            <label className="label">Subcategoría (opcional)</label>
            <select className="input" value={form.subcategoria} onChange={e => set('subcategoria', e.target.value)}>
              <option value="">— Ninguna —</option>
              {subs.map(s => <option key={s.id}>{s.nombre}</option>)}
            </select>
          </div>
        )}

        <div>
          <label className="label">Notas (opcional)</label>
          <input className="input" placeholder="Ej: compra semanal" value={form.notas}
            onChange={e => set('notas', e.target.value)} />
        </div>

        {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg p-2.5">{error}</p>}

        <button type="submit" disabled={loading}
          className="w-full py-2.5 rounded-xl text-sm font-medium transition-all"
          style={{ background: '#1F7A5C', color: 'white', opacity: loading ? 0.6 : 1 }}>
          {loading ? 'Guardando...' : gastoEditar ? 'Guardar cambios' : 'Guardar gasto'}
        </button>
      </form>
    </div>
  )
}

function SimilaresModal({ gastos, nuevaCat, onConfirm, onSkip }) {
  const [seleccion, setSeleccion] = useState(new Set(gastos.map(g => g.id)))

  function toggle(id) {
    setSeleccion(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  function toggleAll() {
    setSeleccion(seleccion.size === gastos.length ? new Set() : new Set(gastos.map(g => g.id)))
  }

  return (
    <div className="card" style={{ background: 'white', borderColor: '#d0ece4' }}>
      <h3 className="font-medium text-slate-800 mb-2">
        Encontré {gastos.length} gasto{gastos.length === 1 ? '' : 's'} similar{gastos.length === 1 ? '' : 'es'}
      </h3>
      <p className="text-xs text-slate-500 mb-3">
        Estos gastos parecen iguales pero están en otra categoría.
        Marcá los que querés reclasificar a <strong>{nuevaCat}</strong>.
      </p>

      <div className="mb-3 flex items-center justify-between">
        <button onClick={toggleAll} className="text-xs text-slate-500 underline">
          {seleccion.size === gastos.length ? 'Quitar todos' : 'Marcar todos'}
        </button>
        <span className="text-xs text-slate-400">{seleccion.size} de {gastos.length}</span>
      </div>

      <div className="space-y-1 max-h-72 overflow-y-auto mb-4" style={{ background: '#f4faf7', borderRadius: 10, padding: 8 }}>
        {gastos.map(g => (
          <label key={g.id} className="flex items-center gap-2 text-xs p-1.5 cursor-pointer hover:bg-white rounded">
            <input type="checkbox" checked={seleccion.has(g.id)}
              onChange={() => toggle(g.id)}
              style={{ accentColor: '#1F7A5C' }} />
            <span className="text-slate-400 flex-shrink-0">{g.fecha}</span>
            <span className="text-slate-700 truncate flex-1">{g.descripcion}</span>
            <span className="text-slate-500 flex-shrink-0">{g.categoria}</span>
            <span className="text-slate-700 flex-shrink-0">${Number(g.monto).toLocaleString('es-CL')}</span>
          </label>
        ))}
      </div>

      <div className="flex gap-2">
        <button onClick={() => onConfirm([...seleccion])}
          className="flex-1 py-2.5 rounded-xl text-sm font-medium"
          style={{ background: '#1F7A5C', color: 'white' }}>
          Reclasificar {seleccion.size}
        </button>
        <button onClick={onSkip}
          className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:bg-slate-100">
          Omitir
        </button>
      </div>
    </div>
  )
}
