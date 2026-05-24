import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { CAT_COLORS, fmt, fmtShort, CATEGORIAS } from '../lib/constants'
import NuevoGasto from '../components/NuevoGasto'
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

export default function Dashboard({ user }) {
  const [gastos, setGastos]           = useState([])
  const [gastosAnio, setGastosAnio]   = useState([])
  const [loading, setLoading]         = useState(true)
  const [showForm, setShowForm]       = useState(false)
  const [gastoEditar, setGastoEditar] = useState(null)
  const [filtroMes, setFiltroMes]     = useState(new Date().getMonth())
  const [filtroAnio, setFiltroAnio]   = useState(new Date().getFullYear())
  const [vistaAnual, setVistaAnual]   = useState(false)
  const [vistaTab, setVistaTab]       = useState('resumen')

  const userName = user.user_metadata?.full_name || user.email.split('@')[0]

  const fetchGastos = useCallback(async () => {
    setLoading(true)
    const inicio = `${filtroAnio}-${String(filtroMes + 1).padStart(2, '0')}-01`
    const fin    = new Date(filtroAnio, filtroMes + 1, 0).toISOString().split('T')[0]
    const { data } = await supabase
      .from('gastos').select('*')
      .gte('fecha', inicio).lte('fecha', fin)
      .order('fecha', { ascending: false })
    setGastos(data || [])
    setLoading(false)
  }, [filtroMes, filtroAnio])

  const fetchGastosAnio = useCallback(async () => {
    const { data } = await supabase
      .from('gastos').select('*')
      .gte('fecha', `${filtroAnio}-01-01`)
      .lte('fecha', `${filtroAnio}-12-31`)
    setGastosAnio(data || [])
  }, [filtroAnio])

  useEffect(() => { fetchGastos(); fetchGastosAnio() }, [fetchGastos, fetchGastosAnio])

  async function borrarGasto(id) {
    if (!confirm('¿Eliminar este gasto?')) return
    await supabase.from('gastos').delete().eq('id', id)
    fetchGastos()
  }

  function editarGasto(g) {
    setGastoEditar(g)
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cerrarForm() {
    setShowForm(false)
    setGastoEditar(null)
  }

  // Métricas mes
  const totalMes  = gastos.reduce((s, g) => s + Number(g.monto), 0)
  const misGastos = gastos.filter(g => g.user_id === user.id)
  const totalMio  = misGastos.reduce((s, g) => s + Number(g.monto), 0)

  // Métricas año
  const totalAnio    = gastosAnio.reduce((s, g) => s + Number(g.monto), 0)
  const misGastosAnio = gastosAnio.filter(g => g.user_id === user.id)
  const totalMioAnio  = misGastosAnio.reduce((s, g) => s + Number(g.monto), 0)

  const porCategoria = CATEGORIAS
    .map(cat => ({
      name: cat,
      value: gastos.filter(g => g.categoria === cat).reduce((s, g) => s + Number(g.monto), 0),
    }))
    .filter(d => d.value > 0)
    .sort((a, b) => b.value - a.value)

  const porPersona = Object.entries(
    gastos.reduce((acc, g) => {
      acc[g.user_name] = (acc[g.user_name] || 0) + Number(g.monto)
      return acc
    }, {})
  ).map(([name, value]) => ({ name, value }))

  const porPersonaAnio = Object.entries(
    gastosAnio.reduce((acc, g) => {
      acc[g.user_name] = (acc[g.user_name] || 0) + Number(g.monto)
      return acc
    }, {})
  ).map(([name, value]) => ({ name, value }))

  // Gráfico anual
  const totalesPorCat = CATEGORIAS
    .map(cat => ({
      cat,
      total: gastosAnio.filter(g => g.categoria === cat).reduce((s, g) => s + Number(g.monto), 0)
    }))
    .filter(d => d.total > 0)
    .sort((a, b) => b.total - a.total)

  const top10    = totalesPorCat.slice(0, 10).map(d => d.cat)
  const hayOtros = totalesPorCat.length > 10

  const datosAnuales = MESES.map((mes, i) => {
    const mesGastos = gastosAnio.filter(g => new Date(g.fecha).getMonth() === i)
    const punto = { mes }
    top10.forEach(cat => {
      punto[cat] = mesGastos.filter(g => g.categoria === cat).reduce((s, g) => s + Number(g.monto), 0)
    })
    if (hayOtros) {
      punto['Otros'] = mesGastos
        .filter(g => !top10.includes(g.categoria))
        .reduce((s, g) => s + Number(g.monto), 0)
    }
    return punto
  })

  const barKeys = hayOtros ? [...top10, 'Otros'] : top10
  const colores = [...top10.map(c => CAT_COLORS[c] || '#B4B2A9'), '#B4B2A9']

  const anios = [filtroAnio - 1, filtroAnio, filtroAnio + 1]

  // Categorías para vista anual resumen
  const porCategoriaAnio = CATEGORIAS
    .map(cat => ({
      name: cat,
      value: gastosAnio.filter(g => g.categoria === cat).reduce((s, g) => s + Number(g.monto), 0),
    }))
    .filter(d => d.value > 0)
    .sort((a, b) => b.value - a.value)

  return (
    <div className="min-h-screen pb-8" style={{ background: '#fdf6f9' }}>

      {/* Header */}
      <div style={{ background: '#D4537E' }} className="px-4 pt-8 pb-16">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-4">
            {/* Logo arreglado */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 18, fontWeight: 500, color: 'white' }}>Happy</span>
                <span style={{ fontSize: 18, fontWeight: 500, color: 'white' }}>Wife</span>
              </div>
              <div style={{ width: 26, height: 2, background: 'rgba(255,255,255,0.6)', borderRadius: 2 }} />
            </div>
            <div className="flex items-center gap-3">
              <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>Hola, {userName}</span>
              <button onClick={async () => await supabase.auth.signOut()}
                style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}
                className="hover:text-white">Salir</button>
            </div>
          </div>

          {/* Filtro meses + botón año */}
          <div className="flex gap-2 flex-wrap">
            {MESES.map((m, i) => (
              <button key={m} onClick={() => { setFiltroMes(i); setVistaAnual(false) }}
                className="px-3 py-1 rounded-full text-xs font-medium transition-all"
                style={!vistaAnual && filtroMes === i
                  ? { background: 'white', color: '#D4537E' }
                  : { background: 'rgba(255,255,255,0.2)', color: 'white' }}>
                {m}
              </button>
            ))}
            {/* Botón año */}
            <button onClick={() => setVistaAnual(true)}
              className="px-3 py-1 rounded-full text-xs font-medium transition-all"
              style={vistaAnual
                ? { background: 'white', color: '#D4537E' }
                : { background: 'rgba(255,255,255,0.2)', color: 'white' }}>
              {filtroAnio}
            </button>
            {/* Selector año anterior/siguiente */}
            <div className="flex gap-1 ml-1">
              <button onClick={() => setFiltroAnio(a => a - 1)}
                style={{ color: 'rgba(255,255,255,0.7)', fontSize: 16, lineHeight: 1 }}>‹</button>
              <button onClick={() => setFiltroAnio(a => a + 1)}
                style={{ color: 'rgba(255,255,255,0.7)', fontSize: 16, lineHeight: 1 }}>›</button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-10 space-y-4">

        {/* Métricas — cambian según vista mes o año */}
        <div className="grid grid-cols-3 gap-3">
          {vistaAnual ? [
            { label: `Total ${filtroAnio}`, value: fmtShort(totalAnio),          sub: `${gastosAnio.length} gastos` },
            { label: 'Mi parte',            value: fmtShort(totalMioAnio),        sub: `${misGastosAnio.length} gastos` },
            { label: 'Pareja',              value: fmtShort(totalAnio-totalMioAnio), sub: `${gastosAnio.length-misGastosAnio.length} gastos` },
          ] : [
            { label: 'Total mes',  value: fmtShort(totalMes),          sub: `${gastos.length} gastos` },
            { label: 'Mi parte',   value: fmtShort(totalMio),          sub: `${misGastos.length} gastos` },
            { label: 'Pareja',     value: fmtShort(totalMes-totalMio), sub: `${gastos.length-misGastos.length} gastos` },
          ].map(m => (
            <div key={m.label} className="card text-center" style={{ background: 'white', borderColor: '#f0d6e0' }}>
              <p className="text-xs text-slate-400 mb-0.5">{m.label}</p>
              <p className="text-base font-medium text-slate-800">{m.value}</p>
              <p className="text-xs text-slate-400">{m.sub}</p>
            </div>
          ))}
        </div>

        {/* Botón nuevo gasto */}
        {!showForm && (
          <button onClick={() => { setGastoEditar(null); setShowForm(true) }}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all"
            style={{ background: '#D4537E', color: 'white' }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Registrar gasto
          </button>
        )}

        {showForm && (
          <NuevoGasto user={user} gastoEditar={gastoEditar}
            onSaved={() => { cerrarForm(); fetchGastos(); fetchGastosAnio() }}
            onCancel={cerrarForm} />
        )}

        {/* Tabs */}
        <div className="flex rounded-xl p-1" style={{ background: '#fce8f0' }}>
          {[['resumen','Resumen'],['lista','Gastos'],['anio','Gráfico']].map(([k, label]) => (
            <button key={k} onClick={() => setVistaTab(k)}
              className="flex-1 py-1.5 text-sm font-medium rounded-lg transition-all"
              style={vistaTab === k
                ? { background: 'white', color: '#D4537E' }
                : { color: '#9ca3af' }}>
              {label}
            </button>
          ))}
        </div>

        {loading && <p className="text-center text-sm text-slate-400 py-8">Cargando...</p>}

        {/* Vista resumen — mes o año */}
        {!loading && vistaTab === 'resumen' && (
          <>
            {(vistaAnual ? gastosAnio : gastos).length === 0 ? (
              <div className="card text-center py-10" style={{ background: 'white', borderColor: '#f0d6e0' }}>
                <p className="text-slate-400 text-sm">
                  Sin gastos en {vistaAnual ? filtroAnio : `${MESES[filtroMes]} ${filtroAnio}`}
                </p>
              </div>
            ) : (
              <>
                <div className="card" style={{ background: 'white', borderColor: '#f0d6e0' }}>
                  <h3 className="text-sm font-medium text-slate-700 mb-3">Por categoría</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={vistaAnual ? porCategoriaAnio : porCategoria}
                        cx="50%" cy="50%" outerRadius={80}
                        dataKey="value" nameKey="name" paddingAngle={2}>
                        {(vistaAnual ? porCategoriaAnio : porCategoria).map(entry => (
                          <Cell key={entry.name} fill={CAT_COLORS[entry.name] || '#B4B2A9'} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1.5 mt-2">
                    {(vistaAnual ? porCategoriaAnio : porCategoria).slice(0, 6).map(d => (
                      <div key={d.name} className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: CAT_COLORS[d.name] || '#B4B2A9' }} />
                        <span className="text-xs text-slate-600 flex-1 truncate">{d.name}</span>
                        <span className="text-xs font-medium text-slate-700">{fmt(d.value)}</span>
                        <span className="text-xs text-slate-400 w-8 text-right">
                          {Math.round(d.value / (vistaAnual ? totalAnio : totalMes) * 100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {(vistaAnual ? porPersonaAnio : porPersona).length > 1 && (
                  <div className="card" style={{ background: 'white', borderColor: '#f0d6e0' }}>
                    <h3 className="text-sm font-medium text-slate-700 mb-3">Por persona</h3>
                    <ResponsiveContainer width="100%" height={120}>
                      <BarChart data={vistaAnual ? porPersonaAnio : porPersona}
                        margin={{ top:0, right:0, left:0, bottom:0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#fce8f0" />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11 }} width={50} />
                        <Bar dataKey="value" fill="#D4537E" radius={[6,6,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* Vista lista */}
        {!loading && vistaTab === 'lista' && (
          <>
            {gastos.length === 0 ? (
              <div className="card text-center py-10" style={{ background: 'white', borderColor: '#f0d6e0' }}>
                <p className="text-slate-400 text-sm">Sin gastos en {MESES[filtroMes]} {filtroAnio}</p>
              </div>
            ) : (
              <div className="card divide-y" style={{ background: 'white', borderColor: '#f0d6e0' }}>
                {gastos.map(g => (
                  <div key={g.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
                    style={{ borderColor: '#fce8f0' }}>
                    <div className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center mt-0.5"
                      style={{ backgroundColor: (CAT_COLORS[g.categoria] || '#888780') + '22' }}>
                      <div className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: CAT_COLORS[g.categoria] || '#888780' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{g.descripcion}</p>
                      <p className="text-xs text-slate-400">{g.categoria} · {g.user_name} · {g.fecha}</p>
                    </div>
                    <div className="text-right flex-shrink-0 flex flex-col gap-1">
                      <p className="text-sm font-medium" style={{ color: '#D4537E' }}>{fmt(g.monto)}</p>
                      {g.user_id === user.id && (
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => editarGasto(g)}
                            className="text-xs text-slate-400 hover:text-slate-600">Editar</button>
                          <button onClick={() => borrarGasto(g.id)}
                            className="text-xs text-red-400 hover:text-red-600">Eliminar</button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Vista gráfico anual */}
        {!loading && vistaTab === 'anio' && (
          <div className="card" style={{ background: 'white', borderColor: '#f0d6e0' }}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-medium text-slate-700">Gasto anual {filtroAnio}</h3>
              <span className="text-sm font-medium" style={{ color: '#D4537E' }}>{fmt(totalAnio)}</span>
            </div>
            <p className="text-xs text-slate-400 mb-4">Top {top10.length} categorías por mes</p>

            {gastosAnio.length === 0 ? (
              <p className="text-center text-sm text-slate-400 py-6">Sin gastos en {filtroAnio}</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={datosAnuales} margin={{ top:0, right:0, left:0, bottom:0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#fce8f0" />
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
                      <div key={key} className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: colores[i] || '#B4B2A9' }} />
                        <span className="text-xs text-slate-600 flex-1 truncate">{key}</span>
                        <span className="text-xs font-medium text-slate-700">{fmt(total)}</span>
                        <span className="text-xs text-slate-400 w-8 text-right">
                          {totalAnio > 0 ? Math.round(total / totalAnio * 100) : 0}%
                        </span>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
