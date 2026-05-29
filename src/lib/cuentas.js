import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'

const STORAGE_KEY = 'happylife.cuentaActiva'

export function useCuentas(user) {
  const [cuentas, setCuentas]                   = useState([])
  const [cuentaActiva, setCuentaActivaState]    = useState(null)
  const [loading, setLoading]                   = useState(true)

  const load = useCallback(async () => {
    if (!user) {
      setCuentas([])
      setCuentaActivaState(null)
      setLoading(false)
      return
    }
    setLoading(true)
    const { data } = await supabase
      .from('cuenta_miembros')
      .select('role, cuentas(id, nombre, descripcion, owner_id)')
      .eq('user_id', user.id)
    const lista = (data || [])
      .filter(m => m.cuentas)
      .map(m => ({ ...m.cuentas, role: m.role }))
    setCuentas(lista)

    if (lista.length > 0) {
      const saved = localStorage.getItem(STORAGE_KEY)
      const found = saved && lista.find(c => c.id === saved)
      setCuentaActivaState(found || lista[0])
    } else {
      setCuentaActivaState(null)
    }
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  function setCuentaActiva(c) {
    setCuentaActivaState(c)
    if (c) localStorage.setItem(STORAGE_KEY, c.id)
    else localStorage.removeItem(STORAGE_KEY)
  }

  return { cuentas, cuentaActiva, setCuentaActiva, loading, reload: load }
}

export function generarCodigo() {
  const alfabeto = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let codigo = ''
  for (let i = 0; i < 8; i++) {
    codigo += alfabeto[Math.floor(Math.random() * alfabeto.length)]
  }
  return codigo
}

// Categorías por defecto al crear una cuenta nueva
export const CATEGORIAS_SEED = [
  { nombre: 'Arriendo / dividendo',     color: '#534AB7' },
  { nombre: 'Supermercado',             color: '#1D9E75' },
  { nombre: 'Alimentación (resto)',     color: '#5DCAA5' },
  { nombre: 'Transporte',               color: '#378ADD' },
  { nombre: 'Salud',                    color: '#E24B4A' },
  { nombre: 'Educación',                color: '#185FA5' },
  { nombre: 'Entretenimiento',          color: '#D85A30' },
  { nombre: 'Ropa / calzado',           color: '#1F7A5C' },
  { nombre: 'Hogar / servicios básicos', color: '#BA7517' },
  { nombre: 'Tecnología',               color: '#7F77DD' },
  { nombre: 'Viajes',                   color: '#0F6E56' },
  { nombre: 'Seguros',                  color: '#888780' },
  { nombre: 'Inversión / ahorro',       color: '#639922' },
  { nombre: 'Otro',                     color: '#B4B2A9' },
]

export async function sembrarCategoriasSiVacio(cuentaId) {
  const { data } = await supabase
    .from('categorias')
    .select('id')
    .eq('cuenta_id', cuentaId)
    .limit(1)
  if (data && data.length > 0) return false
  await supabase.from('categorias').insert(
    CATEGORIAS_SEED.map((c, i) => ({
      cuenta_id: cuentaId,
      nombre:    c.nombre,
      color:     c.color,
      orden:     i + 1,
      activa:    true,
    }))
  )
  return true
}
