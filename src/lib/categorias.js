import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { CATEGORIAS, CAT_COLORS } from './constants'
import { sembrarCategoriasSiVacio } from './cuentas'

async function consultarCategorias(cuentaId) {
  let q = supabase
    .from('categorias')
    .select('id, nombre, color, icono, parent_id, orden, activa')
    .eq('activa', true)
    .order('parent_id', { ascending: true, nullsFirst: true })
    .order('orden', { ascending: true })
  if (cuentaId) q = q.eq('cuenta_id', cuentaId)
  return q
}

export async function fetchCategorias(cuentaId) {
  let { data, error } = await consultarCategorias(cuentaId)

  // Sin categorías en esta cuenta: sembrar las por defecto y reintentar,
  // así los gastos siempre tienen categoria_id (UUID) válido — nunca el
  // fallback local-N que rompería el FK.
  if (cuentaId && !error && (!data || data.length === 0)) {
    await sembrarCategoriasSiVacio(cuentaId)
    ;({ data, error } = await consultarCategorias(cuentaId))
  }

  if (error || !data || data.length === 0) {
    return {
      nombres: CATEGORIAS,
      colores: CAT_COLORS,
      items:   CATEGORIAS.map((n, i) => ({ id: `local-${i}`, nombre: n, color: CAT_COLORS[n], parent_id: null })),
      desdeSupabase: false,
    }
  }

  return {
    nombres: data.filter(c => !c.parent_id).map(c => c.nombre),
    colores: data.reduce((acc, c) => {
      acc[c.nombre] = c.color || CAT_COLORS[c.nombre] || '#888780'
      return acc
    }, {}),
    items: data,
    desdeSupabase: true,
  }
}

export function useCategorias(cuentaId) {
  const [state, setState] = useState({
    nombres: CATEGORIAS,
    colores: CAT_COLORS,
    items:   CATEGORIAS.map((n, i) => ({ id: `local-${i}`, nombre: n, color: CAT_COLORS[n], parent_id: null })),
    desdeSupabase: false,
    cargando: true,
  })
  useEffect(() => {
    let cancelado = false
    fetchCategorias(cuentaId).then(r => {
      if (!cancelado) setState({ ...r, cargando: false })
    })
    return () => { cancelado = true }
  }, [cuentaId])
  return state
}

export function subcategoriasDe(items, parentNombre) {
  const parent = items.find(c => c.nombre === parentNombre && !c.parent_id)
  if (!parent) return []
  return items.filter(c => c.parent_id === parent.id).sort((a, b) => a.orden - b.orden)
}

export function subcategoriasDeId(items, parentId) {
  if (!parentId) return []
  return items.filter(c => c.parent_id === parentId).sort((a, b) => a.orden - b.orden)
}

// Mapa id → { nombre, color, parent_id } para resolver nombre/color al mostrar.
// El id es la fuente de verdad; el nombre se resuelve en pantalla.
export function mapaPorId(items) {
  return items.reduce((acc, c) => {
    acc[c.id] = { nombre: c.nombre, color: c.color, parent_id: c.parent_id }
    return acc
  }, {})
}

// Resuelve el id de una categoría a partir de su nombre (para la IA / CSV,
// que producen nombres). parentId null = categoría raíz.
export function idPorNombre(items, nombre, parentId = null) {
  if (!nombre) return null
  const match = items.find(c =>
    c.nombre === nombre && (c.parent_id || null) === (parentId || null)
  )
  return match ? match.id : null
}
