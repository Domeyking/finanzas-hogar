import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const COLOR_DEFAULT = '#1F7A5C'

export default function Categorias() {
  const [categorias, setCategorias] = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [editing, setEditing]       = useState(null) // category object or 'new'
  const [parentForNew, setParentNew] = useState(null)
  const [expanded, setExpanded]     = useState(new Set())

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('categorias')
      .select('*')
      .order('orden', { ascending: true })
    if (error) setError(error.message)
    setCategorias(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const principales = categorias.filter(c => !c.parent_id).sort((a, b) => a.orden - b.orden)
  const subsDe = (id) => categorias.filter(c => c.parent_id === id).sort((a, b) => a.orden - b.orden)

  async function eliminar(cat) {
    const hijos = subsDe(cat.id).length
    const msg = hijos > 0
      ? `¿Eliminar "${cat.nombre}" y sus ${hijos} subcategoría(s)?`
      : `¿Eliminar "${cat.nombre}"?`
    if (!confirm(msg)) return
    const { error } = await supabase.from('categorias').delete().eq('id', cat.id)
    if (error) setError(error.message)
    load()
  }

  async function mover(cat, delta) {
    const siblings = categorias
      .filter(c => c.parent_id === cat.parent_id)
      .sort((a, b) => a.orden - b.orden)
    const idx = siblings.findIndex(c => c.id === cat.id)
    const newIdx = idx + delta
    if (newIdx < 0 || newIdx >= siblings.length) return
    const swap = siblings[newIdx]
    const ordenA = cat.orden
    const ordenB = swap.orden
    await supabase.from('categorias').update({ orden: ordenB }).eq('id', cat.id)
    await supabase.from('categorias').update({ orden: ordenA }).eq('id', swap.id)
    load()
  }

  async function toggleActiva(cat) {
    await supabase.from('categorias').update({ activa: !cat.activa }).eq('id', cat.id)
    load()
  }

  function startNew(parentId = null) {
    setEditing('new')
    setParentNew(parentId)
  }

  function startEdit(cat) {
    setEditing(cat)
    setParentNew(null)
  }

  function cancelEdit() {
    setEditing(null)
    setParentNew(null)
  }

  async function save(form) {
    setError('')
    if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return }

    if (editing === 'new') {
      const ordenMax = Math.max(
        0,
        ...categorias.filter(c => c.parent_id === parentForNew).map(c => c.orden || 0)
      )
      const { error } = await supabase.from('categorias').insert({
        nombre:    form.nombre.trim(),
        parent_id: parentForNew,
        color:     form.color || COLOR_DEFAULT,
        icono:     form.icono || null,
        orden:     ordenMax + 1,
        activa:    true,
      })
      if (error) { setError(error.message); return }
    } else {
      const { error } = await supabase.from('categorias').update({
        nombre: form.nombre.trim(),
        color:  form.color || COLOR_DEFAULT,
        icono:  form.icono || null,
      }).eq('id', editing.id)
      if (error) { setError(error.message); return }
    }
    cancelEdit()
    load()
  }

  function toggleExpand(id) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  if (loading) {
    return <p className="text-center text-sm text-slate-400 py-8">Cargando categorías...</p>
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-slate-700">
          {categorias.length} categoría{categorias.length === 1 ? '' : 's'}
        </h2>
        {editing === null && (
          <button onClick={() => startNew(null)}
            className="text-xs font-medium px-3 py-1.5 rounded-lg"
            style={{ background: '#1F7A5C', color: 'white' }}>
            + Nueva
          </button>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-500 bg-red-50 rounded-lg p-2.5">{error}</p>
      )}

      {editing !== null && (
        <CategoriaForm
          initial={editing === 'new' ? null : editing}
          parentInfo={editing === 'new' && parentForNew
            ? categorias.find(c => c.id === parentForNew)
            : null}
          onSave={save}
          onCancel={cancelEdit}
        />
      )}

      {principales.length === 0 && editing === null && (
        <div className="card text-center py-10" style={{ background: 'white', borderColor: '#d0ece4' }}>
          <p className="text-slate-400 text-sm">Aún no hay categorías. Crea la primera con "+ Nueva".</p>
        </div>
      )}

      <div className="space-y-2">
        {principales.map((cat, i) => {
          const subs = subsDe(cat.id)
          const isExpanded = expanded.has(cat.id)
          return (
            <div key={cat.id}>
              <CategoriaRow
                cat={cat}
                isFirst={i === 0}
                isLast={i === principales.length - 1}
                onMoveUp={() => mover(cat, -1)}
                onMoveDown={() => mover(cat, 1)}
                onEdit={() => startEdit(cat)}
                onDelete={() => eliminar(cat)}
                onToggleActiva={() => toggleActiva(cat)}
                onAddChild={() => startNew(cat.id)}
                onToggleExpand={subs.length > 0 ? () => toggleExpand(cat.id) : null}
                expanded={isExpanded}
                subCount={subs.length}
              />
              {isExpanded && subs.length > 0 && (
                <div className="ml-6 mt-2 space-y-2" style={{ borderLeft: '2px solid #d0ece4', paddingLeft: 12 }}>
                  {subs.map((sub, j) => (
                    <CategoriaRow
                      key={sub.id}
                      cat={sub}
                      isFirst={j === 0}
                      isLast={j === subs.length - 1}
                      onMoveUp={() => mover(sub, -1)}
                      onMoveDown={() => mover(sub, 1)}
                      onEdit={() => startEdit(sub)}
                      onDelete={() => eliminar(sub)}
                      onToggleActiva={() => toggleActiva(sub)}
                      isSub
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CategoriaRow({
  cat, isFirst, isLast, onMoveUp, onMoveDown, onEdit, onDelete,
  onToggleActiva, onAddChild, onToggleExpand, expanded, subCount, isSub,
}) {
  return (
    <div className="card flex items-center gap-2 py-2.5 px-3"
      style={{
        background: 'white',
        borderColor: '#d0ece4',
        opacity: cat.activa === false ? 0.5 : 1,
      }}>
      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: (cat.color || '#888780') + '22' }}>
        {cat.icono
          ? <span style={{ fontSize: 16 }}>{cat.icono}</span>
          : <div className="w-2.5 h-2.5 rounded-full" style={{ background: cat.color || '#888780' }} />
        }
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate">{cat.nombre}</p>
        {!isSub && subCount > 0 && (
          <button onClick={onToggleExpand}
            className="text-xs text-slate-400 hover:text-slate-600">
            {expanded ? '▾' : '▸'} {subCount} subcategoría{subCount === 1 ? '' : 's'}
          </button>
        )}
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        <button onClick={onMoveUp} disabled={isFirst}
          className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
          title="Subir">↑</button>
        <button onClick={onMoveDown} disabled={isLast}
          className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
          title="Bajar">↓</button>
        {!isSub && onAddChild && (
          <button onClick={onAddChild}
            className="text-xs px-2 py-1 rounded text-slate-500 hover:bg-slate-100"
            title="Agregar subcategoría">+ sub</button>
        )}
        <button onClick={onToggleActiva}
          className="text-xs px-2 py-1 rounded text-slate-500 hover:bg-slate-100"
          title={cat.activa === false ? 'Activar' : 'Desactivar'}>
          {cat.activa === false ? '○' : '●'}
        </button>
        <button onClick={onEdit}
          className="text-xs px-2 py-1 rounded text-slate-500 hover:bg-slate-100">
          Editar
        </button>
        <button onClick={onDelete}
          className="text-xs px-2 py-1 rounded text-red-400 hover:bg-red-50">
          Borrar
        </button>
      </div>
    </div>
  )
}

function CategoriaForm({ initial, parentInfo, onSave, onCancel }) {
  const [nombre, setNombre] = useState(initial?.nombre || '')
  const [color, setColor]   = useState(initial?.color || COLOR_DEFAULT)
  const [icono, setIcono]   = useState(initial?.icono || '')

  function handleSubmit(e) {
    e.preventDefault()
    onSave({ nombre, color, icono })
  }

  return (
    <form onSubmit={handleSubmit}
      className="card space-y-3"
      style={{ background: '#f4faf7', borderColor: '#d0ece4' }}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-slate-700">
          {initial ? `Editar "${initial.nombre}"` : parentInfo ? `Nueva subcategoría en "${parentInfo.nombre}"` : 'Nueva categoría'}
        </h3>
        <button type="button" onClick={onCancel}
          className="text-slate-400 hover:text-slate-600 text-lg leading-none">✕</button>
      </div>

      <div>
        <label className="label">Nombre</label>
        <input className="input" value={nombre} autoFocus
          onChange={e => setNombre(e.target.value)}
          placeholder="Ej: Supermercado" required />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Color</label>
          <div className="flex items-center gap-2">
            <input type="color" value={color}
              onChange={e => setColor(e.target.value)}
              style={{ width: 40, height: 36, padding: 0, border: '1px solid #d0ece4', borderRadius: 8, cursor: 'pointer' }} />
            <input className="input" value={color}
              onChange={e => setColor(e.target.value)}
              placeholder="#1F7A5C" />
          </div>
        </div>
        <div>
          <label className="label">Ícono (emoji)</label>
          <input className="input" value={icono}
            onChange={e => setIcono(e.target.value)}
            placeholder="🌿" maxLength={4} />
        </div>
      </div>

      <div className="flex gap-2">
        <button type="submit"
          className="flex-1 py-2.5 rounded-xl text-sm font-medium"
          style={{ background: '#1F7A5C', color: 'white' }}>
          {initial ? 'Guardar cambios' : 'Crear'}
        </button>
        <button type="button" onClick={onCancel}
          className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:bg-slate-100">
          Cancelar
        </button>
      </div>
    </form>
  )
}
