import { supabase } from './supabase'

export async function obtenerReglas(userId) {
  const { data } = await supabase
    .from('reglas_categoria')
    .select('keyword, categoria')
    .eq('user_id', userId)
  return data || []
}

export async function guardarRegla(userId, keyword, categoria) {
  const kw = keyword.trim().toLowerCase()
  if (!kw || kw.length < 3) return
  await supabase
    .from('reglas_categoria')
    .upsert({ user_id: userId, keyword: kw, categoria }, { onConflict: 'user_id,keyword' })
}

export async function categorizarTransacciones(transacciones, userId) {
  // 1. Cargar reglas aprendidas
  const reglas = userId ? await obtenerReglas(userId) : []

  // 2. Aplicar reglas locales primero
  const sinRegla = []
  const conRegla = []

  transacciones.forEach((t, i) => {
    const desc = t.descripcion.toLowerCase()
    const regla = reglas.find(r => desc.includes(r.keyword))
    if (regla) {
      conRegla.push({ index: i + 1, categoria: regla.categoria, descripcion_limpia: t.descripcion, aprendida: true })
    } else {
      sinRegla.push({ ...t, _originalIndex: i + 1 })
    }
  })

  // 3. Si todo se resolvió con reglas, retornar directo
  if (sinRegla.length === 0) return conRegla

  // 4. Llamar a la IA solo para las que no tienen regla
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

  // 5. Reindexar al índice original
  const resultadoFinal = resultado.map(r => ({
    ...r,
    index: sinRegla[r.index - 1]?._originalIndex || r.index,
    aprendida: false,
  }))

  // 6. Combinar y ordenar por índice original
  return [...conRegla, ...resultadoFinal].sort((a, b) => a.index - b.index)
}
