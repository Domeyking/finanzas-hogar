export const CATEGORIAS = [
  'Arriendo / dividendo',
  'Supermercado',
  'Alimentación (resto)',
  'Transporte',
  'Salud',
  'Educación',
  'Entretenimiento',
  'Ropa / calzado',
  'Hogar / servicios básicos',
  'Tecnología',
  'Viajes',
  'Seguros',
  'Inversión / ahorro',
  'Otro',
]

export const FUENTES = [
  'Tarjeta de crédito',
  'Tarjeta de débito',
  'Transferencia',
  'Servipag',
  'Efectivo',
  'App / wallet',
]

export const CAT_COLORS = {
  'Arriendo / dividendo':       '#534AB7',
  'Supermercado':               '#1D9E75',
  'Alimentación (resto)':       '#5DCAA5',
  'Transporte':                 '#378ADD',
  'Salud':                      '#E24B4A',
  'Educación':                  '#185FA5',
  'Entretenimiento':            '#D85A30',
  'Ropa / calzado':             '#1F7A5C',
  'Hogar / servicios básicos':  '#BA7517',
  'Tecnología':                 '#7F77DD',
  'Viajes':                     '#0F6E56',
  'Seguros':                    '#888780',
  'Inversión / ahorro':         '#639922',
  'Otro':                       '#B4B2A9',
}

// Palabras genéricas de banco que NO identifican a un comercio/persona.
// Se ignoran al buscar gastos "parecidos" y al aprender reglas, para no
// agrupar cosas distintas solo porque comparten "transferencia", "pago", etc.
const STOPWORDS = new Set([
  'transferencia', 'transferencias', 'transf', 'transf.', 'tef', 'pago', 'pagos',
  'compra', 'compras', 'abono', 'cargo', 'giro', 'deposito', 'deposito', 'retiro',
  'a', 'de', 'del', 'la', 'el', 'los', 'las', 'por', 'con', 'para', 'su', 'sus',
  'un', 'una', 'y', 'en', 'al', 'spa', 'ltda', 'eirl', 'sa', 's.a.', 'cia',
])

// "Firma" de una descripción: tokens distintivos en minúscula, sin acentos
// ni puntuación, sin stopwords. Ej: "Transferencia a Felipe Olivares" -> "felipe olivares".
export function firmaDescripcion(desc) {
  if (!desc) return ''
  return desc.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // quita acentos
    .replace(/[^a-z0-9\s]/g, ' ')                     // quita puntuación
    .split(/\s+/)
    .filter(t => t.length >= 3 && !STOPWORDS.has(t))
    .join(' ')
}

export const fmt = (n) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)

export const fmtShort = (n) => {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`
  return `$${Math.round(n)}`
}
