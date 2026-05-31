import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { categorizarTransacciones, guardarRegla } from '../lib/anthropic'
import { FUENTES, fmt } from '../lib/constants'
import { useCategorias, mapaPorId, idPorNombre } from '../lib/categorias'

function parsearCSV(texto) {
  const lineas = texto.trim().split('\n').filter(l => l.trim())
  if (lineas.length < 2) return []
  const encabezados = lineas[0].split(/[,;|\t]/).map(h => h.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, ''))

  const idxFecha = encabezados.findIndex(h => h.includes('fecha') || h.includes('date'))
  const idxMonto = encabezados.findIndex(h => h.includes('monto') || h.includes('cargo') || h.includes('importe') || h.includes('amount') || h.includes('valor'))
  const idxDesc  = encabezados.findIndex(h => h.includes('descri') || h.includes('detalle') || h.includes('concepto') || h.includes('glosa') || h.includes('comercio'))

  return lineas.slice(1).map((linea, i) => {
    const cols = linea.split(/[,;|\t]/).map(c => c.trim().replace(/^"|"$/g, ''))
    const montoRaw = idxMonto >= 0 ? cols[idxMonto] : ''
    const monto = Math.abs(parseInt(montoRaw.replace(/\D/g, ''), 10))
    return {
      id: i,
      fecha:       idxFecha >= 0 ? cols[idxFecha] : new Date().toISOString().split('T')[0],
      descripcion: idxDesc  >= 0 ? cols[idxDesc]  : cols.join(' '),
      monto:       isNaN(monto) ? 0 : monto,
    }
  }).filter(t => t.monto > 0)
}

function normalizarFecha(str) {
  if (!str) return new Date().toISOString().split('T')[0]
  const m1 = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (m1) return `${m1[3]}-${m1[2].padStart(2,'0')}-${m1[1].padStart(2,'0')}`
  const m2 = str.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (m2) return str
  return new Date().toISOString().split('T')[0]
}

export default function CargaCSV({ user, cuentaId, onDone, onCancel }) {
  const { items } = useCategorias(cuentaId)
  const raiz = items.filter(c => !c.parent_id)
  const mapa = mapaPorId(items)
  const otroId = idPorNombre(items, 'Otro')
  const [paso, setPaso]           = useState('subir')
  const [transacciones, setTrans] = useState([])
  const [error, setError]         = useState('')
  const [progreso, setProgreso]   = useState(0)
  const [stats, setStats]         = useState({ aprendidas: 0, ia: 0 })

  const seleccionados = transacciones.filter(t => t.incluir)
  const todos         = transacciones.length > 0 && seleccionados.length === transacciones.length
  const algunos       = seleccionados.length > 0 && seleccionados.length < transacciones.length
  const total         = seleccionados.reduce((s, t) => s + t.monto, 0)

  async function handleArchivo(e) {
    const archivo = e.target.files[0]
    if (!archivo) return
    setError('')
    const texto = await archivo.text()
    const filas = parsearCSV(texto)
    if (filas.length === 0) {
      setError('No se encontraron transacciones. Verifica que el archivo tenga columnas de fecha, monto y descripción.')
      return
    }
    setPaso('procesando')
    const LOTE = 20
    const resultado = []
    let totalAprendidas = 0
    let totalIA = 0

    for (let i = 0; i < filas.length; i += LOTE) {
      const lote = filas.slice(i, i + LOTE)
      setProgreso(Math.round((i / filas.length) * 100))
      try {
        const cats = await categorizarTransacciones(lote, cuentaId, items)
        cats.forEach(c => {
          const fila = lote[c.index - 1]
          if (fila) {
            // categorizarTransacciones ya resuelve a id; fallback "Otro".
            const catId = c.categoria_id || otroId || ''
            resultado.push({
              ...fila,
              fecha:        normalizarFecha(fila.fecha),
              descripcion:  c.descripcion_limpia || fila.descripcion,
              categoria_id: catId,
              fuente:       'Tarjeta de crédito',
              incluir:      true,
              aprendida:    c.aprendida || false,
              categoriaOriginalId: catId,
            })
            if (c.aprendida) totalAprendidas++
            else totalIA++
          }
        })
      } catch (err) {
        setError('Error al categorizar: ' + err.message)
        setPaso('subir')
        return
      }
    }
    setProgreso(100)
    setStats({ aprendidas: totalAprendidas, ia: totalIA })
    setTrans(resultado)
    setPaso('preview')
  }

  function toggleTodos() {
    setTrans(t => t.map(x => ({ ...x, incluir: !todos })))
  }

  function toggleIncluir(id) {
    setTrans(t => t.map(x => x.id === id ? { ...x, incluir: !x.incluir } : x))
  }

  function eliminarSeleccionados() {
    setTrans(t => t.filter(x => !x.incluir))
  }

  function cambiarCategoriaSeleccionados(catId) {
    setTrans(t => t.map(x => x.incluir ? { ...x, categoria_id: catId } : x))
  }

  function cambiarCategoria(id, catId) {
    setTrans(t => t.map(x => x.id === id ? { ...x, categoria_id: catId } : x))
  }

  function cambiarFuente(id, fuente) {
    setTrans(t => t.map(x => x.id === id ? { ...x, fuente } : x))
  }

  async function guardarTodo() {
    setPaso('guardando')
    const userName = user.user_metadata?.full_name || user.email.split('@')[0]

    // Guardar reglas para categorías que fueron corregidas
    const corregidas = transacciones.filter(t =>
      t.incluir && t.categoria_id !== t.categoriaOriginalId
    )
    for (const t of corregidas) {
      const palabras = t.descripcion.split(' ').filter(p => p.length >= 4)
      if (palabras.length > 0 && t.categoria_id) {
        await guardarRegla(cuentaId, user.id, palabras[0].toLowerCase(), t.categoria_id, mapa[t.categoria_id]?.nombre)
      }
    }

    const aGuardar = seleccionados.map(t => ({
      cuenta_id:    cuentaId,
      user_id:      user.id,
      user_name:    userName,
      fecha:        t.fecha,
      descripcion:  t.descripcion,
      monto:        t.monto,
      categoria_id: t.categoria_id || null,
      categoria:    mapa[t.categoria_id]?.nombre || null,
      fuente:       t.fuente,
      notas:        null,
    }))

    const { error } = await supabase.from('gastos').insert(aGuardar)
    if (error) { setError(error.message); setPaso('preview'); return }
    onDone(aGuardar.length, corregidas.length)
  }

  return (
    <div className="card" style={{ background: 'white', borderColor: '#d0ece4' }}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-medium text-slate-800">Cargar cartola</h2>
        {onCancel && <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 text-lg">✕</button>}
      </div>

      {paso === 'subir' && (
        <div className="space-y-4">
          <div style={{ background: '#f0faf6', borderRadius: 12, padding: '1rem', fontSize: 13, color: '#155941', lineHeight: 1.6 }}>
            <strong>¿Cómo exportar tu cartola?</strong><br />
            Banco de Chile, BCI, Santander, Scotiabank: movimientos → exportar → elige <strong>CSV o Excel</strong>.
          </div>
          <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, border: '1.5px dashed #d0ece4', borderRadius: 12, padding: '2rem 1rem', cursor: 'pointer', background: '#f4faf7' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#1F7A5C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <span style={{ fontSize: 14, color: '#1F7A5C', fontWeight: 500 }}>Seleccionar archivo CSV</span>
            <span style={{ fontSize: 12, color: '#7da89b' }}>CSV, XLS o XLSX</span>
            <input type="file" accept=".csv,.xls,.xlsx,.txt" onChange={handleArchivo} style={{ display: 'none' }} />
          </label>
          {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg p-2.5">{error}</p>}
        </div>
      )}

      {paso === 'procesando' && (
        <div className="text-center py-8 space-y-4">
          <div style={{ width: 48, height: 48, borderRadius: '50%', border: '3px solid #d0ece4', borderTopColor: '#1F7A5C', margin: '0 auto', animation: 'spin 1s linear infinite' }} />
          <p style={{ fontSize: 14, color: '#1F7A5C', fontWeight: 500 }}>Categorizando con IA...</p>
          <div style={{ background: '#e8f5f0', borderRadius: 99, height: 6, overflow: 'hidden' }}>
            <div style={{ height: 6, background: '#1F7A5C', borderRadius: 99, width: progreso + '%', transition: 'width 0.3s' }} />
          </div>
          <p style={{ fontSize: 12, color: '#7da89b' }}>{progreso}% completado</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      )}

      {paso === 'preview' && (
        <div className="space-y-3">

          {/* Stats de categorización */}
          {(stats.aprendidas > 0 || stats.ia > 0) && (
            <div style={{ display: 'flex', gap: 8 }}>
              {stats.aprendidas > 0 && (
                <div style={{ background: '#e8f5e9', borderRadius: 8, padding: '6px 10px', fontSize: 12, color: '#2e7d32', flex: 1, textAlign: 'center' }}>
                  🧠 {stats.aprendidas} con reglas aprendidas
                </div>
              )}
              {stats.ia > 0 && (
                <div style={{ background: '#f0faf6', borderRadius: 8, padding: '6px 10px', fontSize: 12, color: '#155941', flex: 1, textAlign: 'center' }}>
                  ✨ {stats.ia} categorizadas por IA
                </div>
              )}
            </div>
          )}

          {/* Barra superior */}
          <div style={{ background: '#f0faf6', borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <input type="checkbox" checked={todos}
              ref={el => { if (el) el.indeterminate = algunos }}
              onChange={toggleTodos}
              style={{ accentColor: '#1F7A5C', cursor: 'pointer', width: 16, height: 16 }} />
            <span style={{ fontSize: 13, color: '#155941', flex: 1 }}>
              <strong>{seleccionados.length}</strong> de {transacciones.length} · {fmt(total)}
            </span>
            {seleccionados.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <select onChange={e => { if (e.target.value) { cambiarCategoriaSeleccionados(e.target.value); e.target.value = '' }}}
                  style={{ fontSize: 11, padding: '4px 8px', borderRadius: 8, border: '0.5px solid #d0ece4', background: 'white', color: '#155941', cursor: 'pointer' }}>
                  <option value="">Cambiar categoría...</option>
                  {raiz.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
                <button onClick={eliminarSeleccionados}
                  style={{ fontSize: 11, padding: '4px 10px', borderRadius: 8, background: '#fff0f0', color: '#c62828', border: '0.5px solid #ffcdd2', cursor: 'pointer' }}>
                  Eliminar {seleccionados.length}
                </button>
              </div>
            )}
            <button onClick={guardarTodo} disabled={seleccionados.length === 0}
              style={{ fontSize: 12, padding: '6px 14px', borderRadius: 10, background: seleccionados.length > 0 ? '#1F7A5C' : '#e5e7eb', color: seleccionados.length > 0 ? 'white' : '#9ca3af', border: 'none', cursor: seleccionados.length > 0 ? 'pointer' : 'default', fontWeight: 500 }}>
              Importar {seleccionados.length}
            </button>
          </div>

          <p style={{ fontSize: 12, color: '#7da89b' }}>
            Si corriges una categoría, la app la recordará para la próxima carga.
          </p>

          <div style={{ maxHeight: 400, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {transacciones.map(t => (
              <div key={t.id} style={{
                border: `0.5px solid ${t.incluir ? '#d0ece4' : '#e5e7eb'}`,
                borderRadius: 10, padding: '8px 12px',
                background: t.incluir ? 'white' : '#f9fafb',
                opacity: t.incluir ? 1 : 0.5,
              }}>
                <div className="flex items-start gap-3">
                  <input type="checkbox" checked={t.incluir} onChange={() => toggleIncluir(t.id)}
                    style={{ marginTop: 3, accentColor: '#1F7A5C', cursor: 'pointer' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1 flex-1 min-w-0">
                        <p style={{ fontSize: 13, fontWeight: 500, color: '#1e293b', margin: 0 }} className="truncate">{t.descripcion}</p>
                        {t.aprendida && (
                          <span title="Categoría aprendida" style={{ fontSize: 10, background: '#e8f5e9', color: '#2e7d32', borderRadius: 4, padding: '1px 5px', flexShrink: 0 }}>🧠</span>
                        )}
                      </div>
                      <p style={{ fontSize: 13, fontWeight: 500, color: '#1F7A5C', flexShrink: 0, margin: 0 }}>{fmt(t.monto)}</p>
                    </div>
                    <p style={{ fontSize: 11, color: '#94a3b8', margin: '2px 0 6px' }}>{t.fecha}</p>
                    <div className="flex gap-2 flex-wrap items-center">
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: mapa[t.categoria_id]?.color || '#B4B2A9', flexShrink: 0 }} />
                      <select value={t.categoria_id} onChange={e => cambiarCategoria(t.id, e.target.value)}
                        style={{ fontSize: 11, padding: '2px 6px', borderRadius: 6, border: `0.5px solid ${t.categoria_id !== t.categoriaOriginalId ? '#1F7A5C' : '#d0ece4'}`, background: t.categoria_id !== t.categoriaOriginalId ? '#f0faf6' : '#f4faf7', color: '#155941', cursor: 'pointer' }}>
                        {raiz.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                      </select>
                      <select value={t.fuente} onChange={e => cambiarFuente(t.id, e.target.value)}
                        style={{ fontSize: 11, padding: '2px 6px', borderRadius: 6, border: '0.5px solid #d0ece4', background: '#f4faf7', color: '#155941', cursor: 'pointer' }}>
                        {FUENTES.map(f => <option key={f}>{f}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg p-2.5">{error}</p>}
        </div>
      )}

      {paso === 'guardando' && (
        <div className="text-center py-8">
          <div style={{ width: 48, height: 48, borderRadius: '50%', border: '3px solid #d0ece4', borderTopColor: '#1F7A5C', margin: '0 auto', animation: 'spin 1s linear infinite' }} />
          <p style={{ fontSize: 14, color: '#1F7A5C', fontWeight: 500, marginTop: 12 }}>Guardando y aprendiendo...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      )}
    </div>
  )
}
