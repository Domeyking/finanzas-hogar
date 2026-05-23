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
  'Ropa / calzado':             '#D4537E',
  'Hogar / servicios básicos':  '#BA7517',
  'Tecnología':                 '#7F77DD',
  'Viajes':                     '#0F6E56',
  'Seguros':                    '#888780',
  'Inversión / ahorro':         '#639922',
  'Otro':                       '#B4B2A9',
}

export const fmt = (n) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(n)

export const fmtShort = (n) => {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`
  return `$${Math.round(n)}`
}
