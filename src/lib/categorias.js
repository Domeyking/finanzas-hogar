import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { CATEGORIAS, CAT_COLORS } from './constants'

export async function fetchCategorias(cuentaId) {
  let q = supabase
    .from('categorias')
    .select('id, nombre, color, icono, parent_id, orden, activa')
    .eq('activa', true)
    .order('parent_id', { ascending: true, nullsFirst: true })
    .order('orden', { ascending: true })
  if (cuentaId) q = q.eq('cuenta_id', cuentaId)
  const { data, error } = await q

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
