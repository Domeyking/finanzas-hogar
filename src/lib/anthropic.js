import { supabase } from './supabase'

export async function obtenerReglas(cuentaId) {
  if (!cuentaId) return []
  const { data } = await supabase
    .from('reglas_categoria')
    .select('keyword, categoria_id')
    .eq('cuenta_id', cuentaId)
  return (data || []).filter(r => r.categoria_id)
}

export async function guardarRegla(cuentaId, userId, keyword, categoriaId, categoriaNombre) {
  const kw = keyword.trim().toLowerCase()
  if (!kw || kw.length < 3 || !cuentaId || !categoriaId) return
  await supabase
    .from('reglas_categoria')
    .upsert(
      // categoria_id es la fuente de verdad; categoria (texto) es caché.
      { cuenta_id: cuentaId, user_id: userId, keyword: kw, categoria_id: categoriaId, categoria: categoriaNombre || null },
      { onConflict: 'cuenta_id,keyword' }
    )
}

// `items` es la lista de categorías (con id) de la cuenta, para resolver
// los nombres que devuelve la IA a un categoria_id.
export async function categorizarTransacciones(transacciones, cuentaId, items = []) {
  const reglas = cuentaId ? await obtenerReglas(cuentaId) : []
  const idDeNombre = (nombre) => {
    const m = items.find(c => c.nombre === nombre && !c.parent_id)
    return m ? m.id : null
  }

  const sinRegla = []
  const conRegla = []

  transacciones.forEach((t, i) => {
    const desc = t.descripcion.toLowerCase()
    const regla = reglas.find(r => desc.includes(r.keyword))
    if (regla) {
      conRegla.push({ index: i + 1, categoria_id: regla.categoria_id, descripcion_limpia: t.descripcion, aprendida: true })
    } else {
      sinRegla.push({ ...t, _originalIndex: i + 1 })
    }
  })

  if (sinRegla.length === 0) return conRegla

  const response = await fetch('/api/categorizar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transacciones: sinRegla }),
  })

  if (!response.ok) {
    const err = await response.json()
    throw new Error(err.error || 'Error en el servidor')
  }

  const resultado = await response.json()

  const resultadoFinal = resultado.map(r => ({
    index:        sinRegla[r.index - 1]?._originalIndex || r.index,
    categoria_id: idDeNombre(r.categoria),
    descripcion_limpia: r.descripcion_limpia,
    aprendida:    false,
  }))

  return [...conRegla, ...resultadoFinal].sort((a, b) => a.index - b.index)
}
