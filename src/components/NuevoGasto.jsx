import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { FUENTES, firmaDescripcion } from '../lib/constants'
import { useCategorias, subcategoriasDeId, mapaPorId, idPorNombre } from '../lib/categorias'

export default function NuevoGasto({ user, cuentaId, onSaved, onCancel, gastoEditar }) {
  const { items, cargando } = useCategorias(cuentaId)
  const raiz = items.filter(c => !c.parent_id)
  const mapa = mapaPorId(items)
  const hoy = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    fecha: hoy,
    descripcion: '',
    monto: '',
    categoria_id: '',
    subcategoria_id: '',
    fuente: FUENTES[0],
    notas: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [similares, setSimilares] = useState(null) // { gastos, nuevaCatId, nuevaCatNombre }

  useEffect(() => {
    if (gastoEditar) {
      // Preferir los ids; si el gasto es legacy (solo texto) resolver por nombre.
      const catId = gastoEditar.categoria_id || idPorNombre(items, gastoEditar.categoria)
      const subId = gastoEditar.subcategoria_id
        || idPorNombre(items, gastoEditar.subcategoria, catId)
      setForm({
        fecha:           gastoEditar.fecha,
        descripcion:     gastoEditar.descripcion,
        monto:           Number(gastoEditar.monto).toLocaleString('es-CL'),
        categoria_id:    catId || '',
        subcategoria_id: subId || '',
        fuente:          gastoEditar.fuente,
        notas:           gastoEditar.notas || '',
      })
    }
  }, [gastoEditar, cargando]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Default: segunda categoría raíz (la primera suele ser "Arriendo").
    if (!gastoEditar && !cargando && raiz.length > 0 && !mapa[form.categoria_id]) {
      setForm(f => ({ ...f, categoria_id: (raiz[1] || raiz[0]).id }))
    }
  }, [cargando, gastoEditar]) // eslint-disable-line react-hooks/exhaustive-deps

  const subs = subcategoriasDeId(items, form.categoria_id)

  useEffect(() => {
    // No limpiar mientras las categorías cargan: subs podría estar vacío
    // sólo porque todavía no llegó la data, y borraríamos un valor válido.
    if (cargando) return
    if (form.subcategoria_id && !subs.find(s => s.id === form.subcategoria_id)) {
      setForm(f => ({ ...f, subcategoria_id: '' }))
    }
  }, [form.categoria_id, cargando]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function buscarSimilares(descripcion, nuevaCatId, gastoId) {
    if (!descripcion || !cuentaId) return []
    // Tokens distintivos (sin "transferencia", "pago", "a", etc.).
    const tokens = firmaDescripcion(descripcion).split(' ').filter(Boolean)
    if (tokens.length === 0) return [] // descripción demasiado genérica
    // Buscamos por el token más distintivo y luego refinamos.
    const keyword = [...tokens].sort((a, b) => b.length - a.length)[0]
    const { data } = await supabase
      .from('gastos')
      .select('id, fecha, descripcion, monto, categoria_id')
      .eq('cuenta_id', cuentaId)
      .ilike('descripcion', `%${keyword}%`)
      .neq('categoria_id', nuevaCatId)
      .neq('id', gastoId || '00000000-0000-0000-0000-000000000000')
      .order('fecha', { ascending: false })
      .limit(50)
    // Solo los que comparten TODOS los tokens distintivos (mismo comercio/persona).
    return (data || []).filter(g => {
      const f = firmaDescripcion(g.descripcion)
      return tokens.every(t => f.includes(t))
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    const monto = parseInt(form.monto.replace(/\D/g, ''), 10)
    if (!monto || monto <= 0) { setError('Ingresa un monto válido'); return }

    if (!form.categoria_id) { setError('Selecciona una categoría'); return }

    setLoading(true)
    // categoria_id / subcategoria_id son la fuente de verdad; el texto es caché.
    const payload = {
      fecha:           form.fecha,
      descripcion:     form.descripcion,
      monto,
      categoria_id:    form.categoria_id,
      subcategoria_id: form.subcategoria_id || null,
      categoria:       mapa[form.categoria_id]?.nombre || null,
      subcategoria:    form.subcategoria_id ? (mapa[form.subcategoria_id]?.nombre || null) : null,
      fuente:          form.fuente,
      notas:           form.notas || null,
    }

    if (gastoEditar) {
      const cambioCategoria = (gastoEditar.categoria_id || null) !== form.categoria_id
      const { error } = await supabase
        .from('gastos').update(payload).eq('id', gastoEditar.id)
      setLoading(false)
      if (error) { setError(error.message); return }
      if (cambioCategoria) {
        const list = await buscarSimilares(form.descripcion, form.categoria_id, gastoEditar.id)
        if (list.length > 0) {
          setSimilares({ gastos: list, nuevaCatId: form.categoria_id, nuevaCatNombre: mapa[form.categoria_id]?.nombre || '' })
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
        .update({
          categoria_id:    similares.nuevaCatId,
          subcategoria_id: null,
          categoria:       similares.nuevaCatNombre,
          subcategoria:    null,
        })
        .in('id', ids)

      const keyword = firmaDescripcion(form.descripcion)
      if (keyword && cuentaId) {
        await supabase.from('reglas_categoria').upsert(
          {
            cuenta_id:    cuentaId,
            user_id:      user.id,
            keyword:      keyword.toLowerCase(),
            categoria_id: similares.nuevaCatId,
            categoria:    similares.nuevaCatNombre,
          },
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
        nuevaCat={similares.nuevaCatNombre}
        mapa={mapa}
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
            <select className="input" value={form.categoria_id} onChange={e => set('categoria_id', e.target.value)}>
              {raiz.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
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
            <select className="input" value={form.subcategoria_id} onChange={e => set('subcategoria_id', e.target.value)}>
              <option value="">— Ninguna —</option>
              {subs.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
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

function SimilaresModal({ gastos, nuevaCat, mapa, onConfirm, onSkip }) {
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
            <span className="text-slate-500 flex-shrink-0">{mapa[g.categoria_id]?.nombre || '—'}</span>
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
