import { supabase } from './supabase'

export async function obtenerReglas(cuentaId) {
  if (!cuentaId) return []
  const { data } = await supabase
    .from('reglas_categoria')
    .select('keyword, categoria')
    .eq('cuenta_id', cuentaId)
  return data || []
}

export async function guardarRegla(cuentaId, userId, keyword, categoria) {
  const kw = keyword.trim().toLowerCase()
  if (!kw || kw.length < 3 || !cuentaId) return
  await supabase
    .from('reglas_categoria')
    .upsert(
      { cuenta_id: cuentaId, user_id: userId, keyword: kw, categoria },
      { onConflict: 'cuenta_id,keyword' }
    )
}

export async function categorizarTransacciones(transacciones, cuentaId) {
  const reglas = cuentaId ? await obtenerReglas(cuentaId) : []

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
    ...r,
    index: sinRegla[r.index - 1]?._originalIndex || r.index,
    aprendida: false,
  }))

  return [...conRegla, ...resultadoFinal].sort((a, b) => a.index - b.index)
}
