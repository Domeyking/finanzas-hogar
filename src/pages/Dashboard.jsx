import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { CAT_COLORS, fmt, fmtShort, CATEGORIAS } from '../lib/constants'
import NuevoGasto from '../components/NuevoGasto'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

export default function Dashboard({ user }) {
  const [gastos, setGastos]         = useState([])
  const [loading, setLoading]       = useState(true)
  const [showForm, setShowForm]     = useState(false)
  const [filtroMes, setFiltroMes]   = useState(new Date().getMonth())
  const [filtroAnio, setFiltroAnio] = useState(new Date().getFullYear())
  const [vistaTab, setVistaTab]     = useState('resumen') // 'resumen' | 'lista'

  const userName = user.user_metadata?.full_name || user.email.split('@')[0]

  const fetchGastos = useCallback(async () => {
    setLoading(true)
    const inicio = `${filtroAnio}-${String(filtroMes + 1).padStart(2, '0')}-01`
    const fin    = new Date(filtroAnio, filtroMes + 1, 0).toISOString().split('T')[0]
    const { data, error } = await supabase
      .from('gastos')
      .select('*')
      .gte('fecha', inicio)
      .lte('fecha', fin)
      .order('fecha', { ascending: false })
    if (!error) setGastos(data || [])
    setLoading(false)
  }, [filtroMes, filtroAnio])

  useEffect(() => { fetchGastos() }, [fetchGastos])

  async function borrarGasto(id) {
    if (!confirm('¿Eliminar este gasto?')) return
    await supabase.from('gastos').delete().eq('id', id)
    fetchGastos()
  }

  const totalMes    = gastos.reduce((s, g) => s + Number(g.monto), 0)
  const misGastos   = gastos.filter(g => g.user_id === user.id)
  const totalMio    = misGastos.reduce((s, g) => s + Number(g.monto), 0)

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

  const anios = [filtroAnio - 1, filtroAnio, filtroAnio + 1]

  return (
    <div className="min-h-screen pb-8">
      {/* Header */}
      <div className="bg-brand px-4 pt-8 pb-16">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-1">
            <div>
              <p className="text-brand-light text-sm">Hola, {userName}</p>
              <h1 className="text-white text-xl font-semibold">Finanzas del hogar</h1>
            </div>
            <button
              onClick={async () => await supabase.auth.signOut()}
              className="text-brand-light text-xs hover:text-white"
            >
              Salir
            </button>
          </div>

          {/* Filtro mes/año */}
          <div className="flex gap-2 mt-4 flex-wrap">
            {MESES.map((m, i) => (
              <button key={m} onClick={() => setFiltroMes(i)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                  filtroMes === i ? 'bg-white text-brand' : 'bg-white/20 text-white hover:bg-white/30'
                }`}>
                {m}
              </button>
            ))}
            <select
              value={filtroAnio}
              onChange={e => setFiltroAnio(Number(e.target.value))}
              className="ml-auto bg-white/20 text-white text-xs rounded-full px-3 py-1 border-0 focus:outline-none cursor-pointer"
            >
              {anios.map(a => <option key={a} value={a} className="text-slate-800">{a}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 -mt-10 space-y-4">
        {/* Metric cards */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total mes', value: fmtShort(totalMes), sub: `${gastos.length} gastos` },
            { label: 'Mi parte', value: fmtShort(totalMio), sub: `${misGastos.length} gastos` },
            { label: 'Pareja', value: fmtShort(totalMes - totalMio), sub: `${gastos.length - misGastos.length} gastos` },
          ].map(m => (
            <div key={m.label} className="card text-center">
              <p className="text-xs text-slate-500 mb-0.5">{m.label}</p>
              <p className="text-base font-semibold text-slate-800">{m.value}</p>
              <p className="text-xs text-slate-400">{m.sub}</p>
            </div>
          ))}
        </div>

        {/* Botón nuevo gasto */}
        {!showForm && (
          <button onClick={() => setShowForm(true)} className="btn-primary w-full flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Registrar gasto
          </button>
        )}

        {showForm && (
          <NuevoGasto user={user} onSaved={() => { setShowForm(false); fetchGastos() }} onCancel={() => setShowForm(false)} />
        )}

        {/* Tabs */}
        <div className="flex rounded-xl bg-slate-100 p-1">
          {[['resumen', 'Resumen'], ['lista', 'Todos los gastos']].map(([k, label]) => (
            <button key={k} onClick={() => setVistaTab(k)}
              className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-all ${
                vistaTab === k ? 'bg-white text-slate-800' : 'text-slate-500'
              }`}>
              {label}
            </button>
          ))}
        </div>

        {loading && <p className="text-center text-sm text-slate-400 py-8">Cargando...</p>}

        {!loading && gastos.length === 0 && (
          <div className="card text-center py-10">
            <p className="text-slate-400 text-sm">Sin gastos en {MESES[filtroMes]} {filtroAnio}</p>
            <p className="text-slate-400 text-xs mt-1">¡Registra el primero!</p>
          </div>
        )}

        {/* Vista resumen */}
        {!loading && gastos.length > 0 && vistaTab === 'resumen' && (
          <>
            {/* Pie chart por categoría */}
            <div className="card">
              <h3 className="text-sm font-medium text-slate-700 mb-3">Por categoría</h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={porCategoria} cx="50%" cy="50%" outerRadius={80}
                    dataKey="value" nameKey="name" paddingAngle={2}>
                    {porCategoria.map(entry => (
                      <Cell key={entry.name} fill={CAT_COLORS[entry.name] || '#B4B2A9'} />
                    ))}
                  </Pie>
                  <Tooltip formatter={v => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {porCategoria.slice(0, 6).map(d => (
                  <div key={d.name} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: CAT_COLORS[d.name] || '#B4B2A9' }} />
                    <span className="text-xs text-slate-600 flex-1 truncate">{d.name}</span>
                    <span className="text-xs font-medium text-slate-700">{fmt(d.value)}</span>
                    <span className="text-xs text-slate-400 w-8 text-right">
                      {Math.round(d.value / totalMes * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Bar chart por persona */}
            {porPersona.length > 1 && (
              <div className="card">
                <h3 className="text-sm font-medium text-slate-700 mb-3">Por persona</h3>
                <ResponsiveContainer width="100%" height={120}>
                  <BarChart data={porPersona} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11 }} width={50} />
                    <Tooltip formatter={v => fmt(v)} />
                    <Bar dataKey="value" fill="#534AB7" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}

        {/* Vista lista */}
        {!loading && gastos.length > 0 && vistaTab === 'lista' && (
          <div className="card divide-y divide-slate-100">
            {gastos.map(g => (
              <div key={g.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                <div className="w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center mt-0.5"
                  style={{ backgroundColor: (CAT_COLORS[g.categoria] || '#888780') + '22' }}>
                  <div className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: CAT_COLORS[g.categoria] || '#888780' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{g.descripcion}</p>
                  <p className="text-xs text-slate-400">{g.categoria} · {g.user_name} · {g.fecha}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-semibold text-slate-800">{fmt(g.monto)}</p>
                  {g.user_id === user.id && (
                    <button onClick={() => borrarGasto(g.id)}
                      className="text-xs text-red-400 hover:text-red-600 mt-0.5">
                      Eliminar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
