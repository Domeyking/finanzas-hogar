import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { CAT_COLORS, fmt, fmtShort, CATEGORIAS } from '../lib/constants'
import NuevoGasto from '../components/NuevoGasto'
import CargaCSV from '../components/CargaCSV'
import CuentaMenu from '../components/CuentaMenu'
import Categorias from './Categorias'
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, Tooltip,
} from 'recharts'

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

export default function Dashboard({ user, cuentaCtx }) {
  const { cuentaActiva, cuentas, setCuentaActiva, reload: reloadCuentas } = cuentaCtx
  const cuentaId = cuentaActiva?.id
  const [gastos, setGastos]           = useState([])
  const [gastosAnio, setGastosAnio]   = useState([])
  const [loading, setLoading]         = useState(true)
  const [showForm, setShowForm]       = useState(false)
  const [showCSV, setShowCSV]         = useState(false)
  const [gastoEditar, setGastoEditar] = useState(null)
  const [filtroMes, setFiltroMes]     = useState(new Date().getMonth())
  const [filtroAnio, setFiltroAnio]   = useState(new Date().getFullYear())
  const [vistaAnual, setVistaAnual]   = useState(false)
  const [vistaTab, setVistaTab]       = useState('resumen')
  const [catDetalle, setCatDetalle]   = useState(null)
  const [toastMsg, setToastMsg]       = useState('')
  const [seleccion, setSeleccion]     = useState(new Set())
  const [modoSeleccion, setModoSeleccion] = useState(false)
  const [showCuentaMenu, setShowCuentaMenu] = useState(false)

  const userName = user.user_metadata?.full_name || user.email.split('@')[0]

  function showToast(msg) {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 3500)
  }

  const fetchGastos = useCallback(async () => {
    if (!cuentaId) return
    setLoading(true)
    const inicio = `${filtroAnio}-${String(filtroMes + 1).padStart(2, '0')}-01`
    const fin    = new Date(filtroAnio, filtroMes + 1, 0).toISOString().split('T')[0]
    const { data } = await supabase
      .from('gastos').select('*')
      .eq('cuenta_id', cuentaId)
      .gte('fecha', inicio).lte('fecha', fin)
      .order('fecha', { ascending: false })
    setGastos(data || [])
    setSeleccion(new Set())
    setLoading(false)
  }, [filtroMes, filtroAnio, cuentaId])

  const fetchGastosAnio = useCallback(async () => {
    if (!cuentaId) return
    const { data } = await supabase
      .from('gastos').select('*')
      .eq('cuenta_id', cuentaId)
      .gte('fecha', `${filtroAnio}-01-01`)
      .lte('fecha', `${filtroAnio}-12-31`)
    setGastosAnio(data || [])
  }, [filtroAnio, cuentaId])

  useEffect(() => { fetchGastos(); fetchGastosAnio() }, [fetchGastos, fetchGastosAnio])

  async function borrarGasto(id) {
    if (!confirm('¿Eliminar este gasto?')) return
    await supabase.from('gastos').delete().eq('id', id)
    fetchGastos()
  }

  async function borrarSeleccionados() {
    if (!confirm(`¿Eliminar ${seleccion.size} gastos?`)) return
    await supabase.from('gastos').delete().in('id', [...seleccion])
    setSeleccion(new Set())
    setModoSeleccion(false)
    fetchGastos()
    fetchGastosAnio()
    showToast(`✓ ${seleccion.size} gastos eliminados`)
  }

  function toggleSeleccion(id) {
    setSeleccion(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleTodos() {
    const misIds = gastos.filter(g => g.user_id === user.id).map(g => g.id)
    if (seleccion.size === misIds.length) {
      setSeleccion(new Set())
    } else {
      setSeleccion(new Set(misIds))
    }
  }

  function editarGasto(g) {
    setGastoEditar(g)
    setShowForm(true)
    setShowCSV(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cerrarForm() {
    setShowForm(false)
    setGastoEditar(null)
  }

  const totalMes      = gastos.reduce((s, g) => s + Number(g.monto), 0)
  const misGastos     = gastos.filter(g => g.user_id === user.id)
  const totalMio      = misGastos.reduce((s, g) => s + Number(g.monto), 0)
  const totalAnio     = gastosAnio.reduce((s, g) => s + Number(g.monto), 0)
  const misGastosAnio = gastosAnio.filter(g => g.user_id === user.id)
  const totalMioAnio  = misGastosAnio.reduce((s, g) => s + Number(g.monto), 0)

  const porCategoria = CATEGORIAS
    .map(cat => ({ name: cat, value: gastos.filter(g => g.categoria === cat).reduce((s, g) => s + Number(g.monto), 0) }))
    .filter(d => d.value > 0).sort((a, b) => b.value - a.value)

  const porCategoriaAnio = CATEGORIAS
    .map(cat => ({ name: cat, value: gastosAnio.filter(g => g.categoria === cat).reduce((s, g) => s + Number(g.monto), 0) }))
    .filter(d => d.value > 0).sort((a, b) => b.value - a.value)

  const porPersona = Object.entries(gastos.reduce((acc, g) => {
    acc[g.user_name] = (acc[g.user_name] || 0) + Number(g.monto); return acc
  }, {})).map(([name, value]) => ({ name, value }))

  const porPersonaAnio = Object.entries(gastosAnio.reduce((acc, g) => {
    acc[g.user_name] = (acc[g.user_name] || 0) + Number(g.monto); return acc
  }, {})).map(([name, value]) => ({ name, value }))

  const totalesPorCat = CATEGORIAS
    .map(cat => ({ cat, total: gastosAnio.filter(g => g.categoria === cat).reduce((s, g) => s + Number(g.monto), 0) }))
    .filter(d => d.total > 0).sort((a, b) => b.total - a.total)

  const top10    = totalesPorCat.slice(0, 10).map(d => d.cat)
  const hayOtros = totalesPorCat.length > 10

  const datosAnuales = MESES.map((mes, i) => {
    const mesGastos = gastosAnio.filter(g => new Date(g.fecha).getMonth() === i)
    const punto = { mes }
    top10.forEach(cat => {
      punto[cat] = mesGastos.filter(g => g.categoria === cat).reduce((s, g) => s + Number(g.monto), 0)
    })
    if (hayOtros) {
      punto['Otros'] = mesGastos.filter(g => !top10.includes(g.categoria)).reduce((s, g) => s + Number(g.monto), 0)
    }
    return punto
  })

  const barKeys = hayOtros ? [...top10, 'Otros'] : top10
  const colores = [...top10.map(c => CAT_COLORS[c] || '#B4B2A9'), '#B4B2A9']

  const gastosDetalle = catDetalle
    ? gastosAnio.filter(g => g.categoria === catDetalle).sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
    : []

  const evolucionCat = MESES.map((mes, i) => ({
    mes,
    total: gastosAnio.filter(g => g.categoria === catDetalle && new Date(g.fecha).getMonth() === i).reduce((s, g) => s + Number(g.monto), 0)
  }))

  const totalCat      = gastosDetalle.reduce((s, g) => s + Number(g.monto), 0)
  const mesesConGasto = evolucionCat.filter(m => m.total > 0).length
  const promedioCat   = mesesConGasto > 0 ? Math.round(totalCat / mesesConGasto) : 0

  const misIdsEnMes   = gastos.filter(g => g.user_id === user.id).map(g => g.id)
  const todosSelec    = misIdsEnMes.length > 0 && misIdsEnMes.every(id => seleccion.has(id))
  const algunosSelec  = seleccion.size > 0 && !todosSelec

  // ── Detalle categoría ──
  if (catDetalle) {
    const color = CAT_COLORS[catDetalle] || '#B4B2A9'
    return (
      <div className="min-h-screen pb-8" style={{ background: '#f4faf7' }}>
        <div style={{ background: color }} className="px-4 pt-8 pb-16">
          <div className="max-w-2xl mx-auto">
            <button onClick={() => setCatDetalle(null)} style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }} className="flex items-center gap-2 mb-4">← Volver</button>
            <h1 style={{ color: 'white', fontSize: 22, fontWeight: 500 }}>{catDetalle}</h1>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13 }}>{filtroAnio}</p>
          </div>
        </div>
        <div className="max-w-2xl mx-auto px-4 -mt-10 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total año',    value: fmtShort(totalCat),    sub: `${gastosDetalle.length} gastos` },
              { label: 'Promedio mes', value: fmtShort(promedioCat), sub: 'por mes activo' },
              { label: '% del total',  value: `${totalAnio > 0 ? Math.round(totalCat/totalAnio*100) : 0}%`, sub: 'del gasto anual' },
            ].map(m => (
              <div key={m.label} className="card text-center" style={{ background: 'white', borderColor: '#d0ece4' }}>
                <p className="text-xs text-slate-400 mb-0.5">{m.label}</p>
                <p className="text-base font-medium text-slate-800">{m.value}</p>
                <p className="text-xs text-slate-400">{m.sub}</p>
              </div>
            ))}
          </div>
          <div className="card" style={{ background: 'white', borderColor: '#d0ece4' }}>
            <h3 className="text-sm font-medium text-slate-700 mb-3">Evolución mensual</h3>
            {gastosDetalle.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">Sin gastos este año</p>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={evolucionCat} margin={{ top:4, right:4, left:0, bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e8f5f0" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={fmtShort} tick={{ fontSize: 10 }} width={44} />
                  <Tooltip formatter={v => fmt(v)} />
                  <Line type="monotone" dataKey="total" stroke={color} strokeWidth={2} dot={{ fill: color, r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
          {gastosDetalle.length > 0 && (
            <div className="card" style={{ background: 'white', borderColor: '#d0ece4' }}>
              <h3 className="text-sm font-medium text-slate-700 mb-3">Todos los gastos — {gastosDetalle.length}</h3>
              <div className="divide-y" style={{ borderColor: '#e8f5f0' }}>
                {gastosDetalle.map(g => (
                  <div key={g.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-800 truncate">{g.descripcion}</p>
                      <p className="text-xs text-slate-400">{g.user_name} · {g.fecha}</p>
                    </div>
                    <p className="text-sm font-medium flex-shrink-0" style={{ color }}>{fmt(g.monto)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Vista principal ──
  return (
    <div className="min-h-screen pb-8" style={{ background: '#f4faf7' }}>

      {showCuentaMenu && (
        <CuentaMenu
          user={user}
          cuentas={cuentas}
          cuentaActiva={cuentaActiva}
          onSwitch={setCuentaActiva}
          onClose={() => setShowCuentaMenu(false)}
          onReload={reloadCuentas}
        />
      )}

      {toastMsg && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', background: '#1e293b', color: 'white', borderRadius: 12, padding: '10px 20px', fontSize: 13, zIndex: 100, whiteSpace: 'nowrap' }}>
          {toastMsg}
        </div>
      )}

      <div style={{ background: '#1F7A5C' }} className="px-4 pt-8 pb-16">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 18, fontWeight: 500, color: 'white' }}>Happy</span>
                <span style={{ fontSize: 18, fontWeight: 500, color: 'white' }}>Life</span>
              </div>
              <div style={{ width: 26, height: 2, background: 'rgba(255,255,255,0.6)', borderRadius: 2 }} />
            </div>
            <div className="flex items-center gap-3">
              <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>Hola, {userName}</span>
              <button onClick={async () => await supabase.auth.signOut()} style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }} className="hover:text-white">Salir</button>
            </div>
          </div>

          <button onClick={() => setShowCuentaMenu(true)}
            className="flex items-center gap-2 mb-4 px-3 py-1.5 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.15)', color: 'white', fontSize: 13 }}>
            <span style={{ opacity: 0.7 }}>Cuenta:</span>
            <strong>{cuentaActiva?.nombre || '—'}</strong>
            <span style={{ opacity: 0.6 }}>▾</span>
          </button>

          <div className="flex gap-2 flex-wrap">
            {MESES.map((m, i) => (
              <button key={m} onClick={() => { setFiltroMes(i); setVistaAnual(false) }}
                className="px-3 py-1 rounded-full text-xs font-medium transition-all"
                style={!vistaAnual && filtroMes === i
                  ? { background: 'white', color: '#1F7A5C' }
                  : { background: 'rgba(255,255,255,0.2)', color: 'white' }}>
                {m}
              </button>
            ))}
            <button onClick={() => setVistaAnual(true)}
              className="px-3 py-1 rounded-full text-xs font-medium transition-all"
              style={vistaAnual ? { background: 'white', color: '#1F7A5C' } : { background: 'rgba(255,255,255,0.2)', color: 'white' }}>
              {filtroAnio}
            </button>
            <div className="flex gap-1 ml-1">
              <button onClick={() => setFiltroAnio(a => a - 1)} style={{ color: 'rgba(255,255,255,0.7)', fontSize: 16 }}>‹</button>
              <button onClick={() => setFiltroAnio(a => a + 1)} style={{ color: 'rgba(255,255,255,0.7)', fontSize: 16 }}>›</button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 -mt-10 space-y-4">

        <div className="grid grid-cols-3 gap-3">
          {(vistaAnual ? [
            { label: `Total ${filtroAnio}`, value: fmtShort(totalAnio),             sub: `${gastosAnio.length} gastos` },
            { label: 'Mi parte',            value: fmtShort(totalMioAnio),           sub: `${misGastosAnio.length} gastos` },
            { label: 'Pareja',              value: fmtShort(totalAnio-totalMioAnio), sub: `${gastosAnio.length-misGastosAnio.length} gastos` },
          ] : [
            { label: 'Total mes',  value: fmtShort(totalMes),          sub: `${gastos.length} gastos` },
            { label: 'Mi parte',   value: fmtShort(totalMio),          sub: `${misGastos.length} gastos` },
            { label: 'Pareja',     value: fmtShort(totalMes-totalMio), sub: `${gastos.length-misGastos.length} gastos` },
          ]).map(m => (
            <div key={m.label} className="card text-center" style={{ background: 'white', borderColor: '#d0ece4' }}>
              <p className="text-xs text-slate-400 mb-0.5">{m.label}</p>
              <p className="text-base font-medium text-slate-800">{m.value}</p>
              <p className="text-xs text-slate-400">{m.sub}</p>
            </div>
          ))}
        </div>

        {!showForm && !showCSV && (
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => { setGastoEditar(null); setShowForm(true) }}
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{ background: '#1F7A5C', color: 'white' }}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Nuevo gasto
            </button>
            <button onClick={() => setShowCSV(true)}
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all"
              style={{ background: 'white', color: '#1F7A5C', border: '1.5px solid #d0ece4' }}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              Cargar cartola
            </button>
          </div>
        )}

        {showForm && (
          <NuevoGasto user={user} cuentaId={cuentaId} gastoEditar={gastoEditar}
            onSaved={() => { cerrarForm(); fetchGastos(); fetchGastosAnio() }}
            onCancel={cerrarForm} />
        )}

        {showCSV && (
          <CargaCSV user={user} cuentaId={cuentaId}
onDone={(n, aprendidas) => { setShowCSV(false); fetchGastos(); fetchGastosAnio(); showToast(`✓ ${n} gastos importados${aprendidas > 0 ? ` · 🧠 ${aprendidas} reglas nuevas aprendidas` : ''}`) }}
            onCancel={() => setShowCSV(false)} />
        )}

        <div className="flex rounded-xl p-1" style={{ background: '#e8f5f0' }}>
          {[['resumen','Resumen'],['lista','Gastos'],['anio','Gráfico'],['categorias','Categorías']].map(([k, label]) => (
            <button key={k} onClick={() => { setVistaTab(k); setModoSeleccion(false); setSeleccion(new Set()) }}
              className="flex-1 py-1.5 text-sm font-medium rounded-lg transition-all"
              style={vistaTab === k ? { background: 'white', color: '#1F7A5C' } : { color: '#9ca3af' }}>
              {label}
            </button>
          ))}
        </div>

        {loading && <p className="text-center text-sm text-slate-400 py-8">Cargando...</p>}

        {!loading && vistaTab === 'resumen' && (
          <>
            {(vistaAnual ? gastosAnio : gastos).length === 0 ? (
              <div className="card text-center py-10" style={{ background: 'white', borderColor: '#d0ece4' }}>
                <p className="text-slate-400 text-sm">Sin gastos en {vistaAnual ? filtroAnio : `${MESES[filtroMes]} ${filtroAnio}`}</p>
              </div>
            ) : (
              <>
                <div className="card" style={{ background: 'white', borderColor: '#d0ece4' }}>
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="text-sm font-medium text-slate-700">Por categoría</h3>
                    <span className="text-xs text-slate-400">Toca para ver detalle</span>
                  </div>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={vistaAnual ? porCategoriaAnio : porCategoria}
                        cx="50%" cy="50%" outerRadius={80} dataKey="value" nameKey="name" paddingAngle={2}
                        onClick={d => setCatDetalle(d.name)} style={{ cursor: 'pointer' }}>
                        {(vistaAnual ? porCategoriaAnio : porCategoria).map(entry => (
                          <Cell key={entry.name} fill={CAT_COLORS[entry.name] || '#B4B2A9'} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1.5 mt-2">
                    {(vistaAnual ? porCategoriaAnio : porCategoria).slice(0, 8).map(d => (
                      <button key={d.name} onClick={() => setCatDetalle(d.name)}
                        className="w-full flex items-center gap-2 hover:bg-slate-50 rounded-lg px-1 py-1 transition-all">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: CAT_COLORS[d.name] || '#B4B2A9' }} />
                        <span className="text-xs text-slate-600 flex-1 text-left truncate">{d.name}</span>
                        <span className="text-xs font-medium text-slate-700">{fmt(d.value)}</span>
                        <span className="text-xs text-slate-400 w-8 text-right">{Math.round(d.value / (vistaAnual ? totalAnio : totalMes) * 100)}%</span>
                        <span className="text-xs text-slate-300">›</span>
                      </button>
                    ))}
                  </div>
                </div>
                {(vistaAnual ? porPersonaAnio : porPersona).length > 1 && (
                  <div className="card" style={{ background: 'white', borderColor: '#d0ece4' }}>
                    <h3 className="text-sm font-medium text-slate-700 mb-3">Por persona</h3>
                    <ResponsiveContainer width="100%" height={120}>
                      <BarChart data={vistaAnual ? porPersonaAnio : porPersona} margin={{ top:0, right:0, left:0, bottom:0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e8f5f0" />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11 }} width={50} />
                        <Bar dataKey="value" fill="#1F7A5C" radius={[6,6,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {!loading && vistaTab === 'lista' && (
          <>
            {gastos.length === 0 ? (
              <div className="card text-center py-10" style={{ background: 'white', borderColor: '#d0ece4' }}>
                <p className="text-slate-400 text-sm">Sin gastos en {MESES[filtroMes]} {filtroAnio}</p>
              </div>
            ) : (
              <>
                {/* Barra de selección múltiple */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button onClick={() => { setModoSeleccion(!modoSeleccion); setSeleccion(new Set()) }}
                    style={{ fontSize: 12, padding: '5px 12px', borderRadius: 8, border: '0.5px solid #d0ece4', background: modoSeleccion ? '#e8f5f0' : 'white', color: modoSeleccion ? '#1F7A5C' : '#94a3b8', cursor: 'pointer' }}>
                    {modoSeleccion ? 'Cancelar' : 'Seleccionar'}
                  </button>
                  {modoSeleccion && (
                    <>
                      <input type="checkbox" checked={todosSelec}
                        ref={el => { if (el) el.indeterminate = algunosSelec }}
                        onChange={toggleTodos}
                        style={{ accentColor: '#1F7A5C', cursor: 'pointer', width: 15, height: 15 }} />
                      <span style={{ fontSize: 12, color: '#94a3b8', flex: 1 }}>{seleccion.size} seleccionados</span>
                      {seleccion.size > 0 && (
                        <button onClick={borrarSeleccionados}
                          style={{ fontSize: 12, padding: '5px 12px', borderRadius: 8, background: '#fff0f0', color: '#c62828', border: '0.5px solid #ffcdd2', cursor: 'pointer' }}>
                          Eliminar {seleccion.size}
                        </button>
                      )}
                    </>
                  )}
                </div>

                <div className="card divide-y" style={{ background: 'white', borderColor: '#d0ece4' }}>
                  {gastos.map(g => (
                    <div key={g.id}
                      className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
                      style={{ borderColor: '#e8f5f0', background: seleccion.has(g.id) ? '#f0faf6' : 'white' }}>
                      {modoSeleccion && g.user_id === user.id && (
                        <input type="checkbox" checked={seleccion.has(g.id)}
                          onChange={() => toggleSeleccion(g.id)}
                          style={{ marginTop: 3, accentColor: '#1F7A5C', cursor: 'pointer', flexShrink: 0 }} />
                      )}
                      <div className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center mt-0.5"
                        style={{ backgroundColor: (CAT_COLORS[g.categoria] || '#888780') + '22' }}>
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CAT_COLORS[g.categoria] || '#888780' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate">{g.descripcion}</p>
                        <p className="text-xs text-slate-400">
                          {g.categoria}{g.subcategoria ? ` › ${g.subcategoria}` : ''} · {g.user_name} · {g.fecha}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0 flex flex-col gap-1">
                        <p className="text-sm font-medium" style={{ color: '#1F7A5C' }}>{fmt(g.monto)}</p>
                        {!modoSeleccion && g.user_id === user.id && (
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => editarGasto(g)} className="text-xs text-slate-400 hover:text-slate-600">Editar</button>
                            <button onClick={() => borrarGasto(g.id)} className="text-xs text-red-400 hover:text-red-600">Eliminar</button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {!loading && vistaTab === 'anio' && (
          <div className="card" style={{ background: 'white', borderColor: '#d0ece4' }}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-medium text-slate-700">Gasto anual {filtroAnio}</h3>
              <span className="text-sm font-medium" style={{ color: '#1F7A5C' }}>{fmt(totalAnio)}</span>
            </div>
            <p className="text-xs text-slate-400 mb-4">Top {top10.length} categorías por mes</p>
            {gastosAnio.length === 0 ? (
              <p className="text-center text-sm text-slate-400 py-6">Sin gastos en {filtroAnio}</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={datosAnuales} margin={{ top:0, right:0, left:0, bottom:0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e8f5f0" />
                    <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={fmtShort} tick={{ fontSize: 10 }} width={44} />
                    {barKeys.map((key, i) => (
                      <Bar key={key} dataKey={key} stackId="a"
                        fill={colores[i] || '#B4B2A9'}
                        radius={i === barKeys.length - 1 ? [4,4,0,0] : [0,0,0,0]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-4 space-y-1.5">
                  {barKeys.map((key, i) => {
                    const total = gastosAnio
                      .filter(g => key === 'Otros' ? !top10.includes(g.categoria) : g.categoria === key)
                      .reduce((s, g) => s + Number(g.monto), 0)
                    return (
                      <button key={key} onClick={() => key !== 'Otros' && setCatDetalle(key)}
                        className="w-full flex items-center gap-2 hover:bg-slate-50 rounded-lg px-1 py-1 transition-all">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: colores[i] || '#B4B2A9' }} />
                        <span className="text-xs text-slate-600 flex-1 text-left truncate">{key}</span>
                        <span className="text-xs font-medium text-slate-700">{fmt(total)}</span>
                        <span className="text-xs text-slate-400 w-8 text-right">{totalAnio > 0 ? Math.round(total / totalAnio * 100) : 0}%</span>
                        {key !== 'Otros' && <span className="text-xs text-slate-300">›</span>}
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {!loading && vistaTab === 'categorias' && <Categorias cuentaId={cuentaId} />}
      </div>
    </div>
  )
}
