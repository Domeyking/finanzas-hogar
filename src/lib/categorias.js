import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { CATEGORIAS, CAT_COLORS } from './constants'

export async function fetchCategorias() {
  const { data, error } = await supabase
    .from('categorias')
    .select('nombre, color, icono, parent_id, orden, activa')
    .eq('activa', true)
    .order('parent_id', { ascending: true, nullsFirst: true })
    .order('orden', { ascending: true })

  if (error || !data || data.length === 0) {
    return {
      nombres: CATEGORIAS,
      colores: CAT_COLORS,
      desdeSupabase: false,
    }
  }

  return {
    nombres: data.map(c => c.nombre),
    colores: data.reduce((acc, c) => {
      acc[c.nombre] = c.color || CAT_COLORS[c.nombre] || '#888780'
      return acc
    }, {}),
    desdeSupabase: true,
  }
}

export function useCategorias() {
  const [state, setState] = useState({
    nombres: CATEGORIAS,
    colores: CAT_COLORS,
    desdeSupabase: false,
    cargando: true,
  })
  useEffect(() => {
    let cancelado = false
    fetchCategorias().then(r => {
      if (!cancelado) setState({ ...r, cargando: false })
    })
    return () => { cancelado = true }
  }, [])
  return state
}
