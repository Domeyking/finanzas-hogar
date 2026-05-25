import { google } from 'googleapis'
import { createClient } from '@supabase/supabase-js'

function getGmail() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET
  )
  oauth2Client.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN })
  return google.gmail({ version: 'v1', auth: oauth2Client })
}

function getSupabase() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  })
}

function decodePart(part) {
  if (!part) return ''
  let out = ''
  if (part.body && part.body.data) {
    out += Buffer.from(part.body.data, 'base64').toString('utf-8')
  }
  if (part.parts) {
    for (const p of part.parts) out += '\n' + decodePart(p)
  }
  return out
}

function stripHtml(s) {
  return s
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|td|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim()
}

function parseMonto(s) {
  return parseInt(String(s).replace(/[^\d]/g, ''), 10)
}

function parseFechaDDMMYYYY(s) {
  const m = String(s).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (!m) return null
  const [, dd, mm, yyyy] = m
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
}

function getHeader(headers, name) {
  const h = headers.find(x => x.name.toLowerCase() === name.toLowerCase())
  return h ? h.value : ''
}

function parseEmail(msg) {
  const headers = msg.payload.headers || []
  const from = getHeader(headers, 'From').toLowerCase()
  const subject = getHeader(headers, 'Subject') || ''
  const dateHeader = getHeader(headers, 'Date')
  const rawBody = decodePart(msg.payload)
  const body = stripHtml(rawBody).replace(/\n/g, ' ')

  // 1. Transferencias de Fondos
  if (from.includes('serviciodetransferencias@bancochile.cl') && /Transferencias de Fondos a/i.test(subject)) {
    const fechaMatch = body.match(/Fecha[:\s]*(\d{1,2}\/\d{1,2}\/\d{4})/i)
    const montoMatch = body.match(/Monto[:\s]*\$([\d.]+)/i)
    if (!fechaMatch || !montoMatch) return null
    const nombre = subject.replace(/.*Transferencias de Fondos a\s*/i, '').trim()
    return {
      fecha: parseFechaDDMMYYYY(fechaMatch[1]),
      monto: parseMonto(montoMatch[1]),
      descripcion: nombre || 'Transferencia',
      categoria: 'Otro',
      fuente: 'Transferencia',
      needsAi: false,
    }
  }

  // 2. Giro con Tarjeta de Débito
  if (from.includes('enviodigital@bancochile.cl') && /Giro con Tarjeta de D[eé]bito/i.test(subject)) {
    const m = body.match(/giro en Cajero por \$([\d.]+)[\s\S]*?el (\d{1,2}\/\d{1,2}\/\d{4})/i)
    if (!m) return null
    return {
      fecha: parseFechaDDMMYYYY(m[2]),
      monto: parseMonto(m[1]),
      descripcion: 'Giro cajero automático',
      categoria: 'Otro',
      fuente: 'Tarjeta de débito',
      needsAi: false,
    }
  }

  // 3. Compra con Tarjeta de Crédito
  if (from.includes('enviodigital@bancochile.cl') && /Compra con Tarjeta de Cr[eé]dito/i.test(subject)) {
    const m = body.match(/compra por \$([\d.]+) con Tarjeta de Cr[eé]dito \*+\d+ en (.+?) el (\d{1,2}\/\d{1,2}\/\d{4})/i)
    if (!m) return null
    return {
      fecha: parseFechaDDMMYYYY(m[3]),
      monto: parseMonto(m[1]),
      descripcion: m[2].trim(),
      fuente: 'Tarjeta de crédito',
      needsAi: true,
    }
  }

  // 4. Cargo por uso de Tarjeta de Débito (notificaciones)
  if (from.includes('notificaciones@bancochile.cl') && /Cargo por uso de tu Tarjeta de D[eé]bito/i.test(subject)) {
    const m = body.match(/compra por \$([\d.]+) con cargo a Cuenta \*+\d+ en (.+?) el (\d{1,2}\/\d{1,2}\/\d{4})/i)
    if (!m) return null
    return {
      fecha: parseFechaDDMMYYYY(m[3]),
      monto: parseMonto(m[1]),
      descripcion: m[2].trim(),
      fuente: 'Tarjeta de débito',
      needsAi: true,
    }
  }

  // 5. Cargo en Cuenta
  if (from.includes('enviodigital@bancochile.cl') && /Cargo en Cuenta/i.test(subject) && !/Cuota Cr[eé]dito Hipotecario/i.test(subject)) {
    const m = body.match(/compra por \$([\d.]+) con cargo a Cuenta \*+\d+ en (.+?) el (\d{1,2}\/\d{1,2}\/\d{4})/i)
    if (!m) return null
    return {
      fecha: parseFechaDDMMYYYY(m[3]),
      monto: parseMonto(m[1]),
      descripcion: m[2].trim(),
      fuente: 'Tarjeta de débito',
      needsAi: true,
    }
  }

  // 6. Cargo Cuota Crédito Hipotecario
  if (from.includes('enviodigital@bancochile.cl') && /Cargo Cuota Cr[eé]dito Hipotecario/i.test(subject)) {
    let fecha = null
    if (dateHeader) {
      const d = new Date(dateHeader)
      if (!isNaN(d.getTime())) fecha = d.toISOString().slice(0, 10)
    }
    return {
      fecha: fecha || new Date().toISOString().slice(0, 10),
      monto: 0,
      descripcion: 'Dividendo hipotecario',
      categoria: 'Arriendo / dividendo',
      fuente: 'Transferencia',
      needsAi: false,
    }
  }

  return null
}

async function categorizarRemoto(transacciones, baseUrl) {
  if (!transacciones.length) return []
  const url = `${baseUrl}/api/categorizar`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transacciones }),
  })
  if (!res.ok) return []
  try {
    return await res.json()
  } catch {
    return []
  }
}

export async function syncGmail() {
  const userId = process.env.GMAIL_SYNC_USER_ID
  const userName = process.env.GMAIL_SYNC_USER_NAME || 'Sync'
  if (!userId) throw new Error('Falta GMAIL_SYNC_USER_ID')

  const supabase = getSupabase()
  const gmail = getGmail()

  const baseUrl = process.env.APP_BASE_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

  const query = 'from:bancochile.cl newer_than:7d'
  const listRes = await gmail.users.messages.list({
    userId: 'me',
    q: query,
    maxResults: 100,
  })
  const messages = listRes.data.messages || []
  if (!messages.length) return { fetched: 0, inserted: 0, skipped: 0 }

  const ids = messages.map(m => m.id)
  let existing = new Set()
  const { data: existingRows } = await supabase
    .from('gastos')
    .select('email_id')
    .in('email_id', ids)
  if (existingRows) existing = new Set(existingRows.map(r => r.email_id))

  const toInsert = []
  const aiPending = []

  for (const m of messages) {
    if (existing.has(m.id)) continue
    const full = await gmail.users.messages.get({ userId: 'me', id: m.id, format: 'full' })
    const parsed = parseEmail(full.data)
    if (!parsed || !parsed.fecha) continue
    const row = {
      email_id: m.id,
      user_id: userId,
      user_name: userName,
      fecha: parsed.fecha,
      monto: parsed.monto,
      descripcion: parsed.descripcion,
      fuente: parsed.fuente,
      categoria: parsed.categoria || 'Otro',
    }
    if (parsed.needsAi) {
      aiPending.push({ idx: toInsert.length, fecha: parsed.fecha, monto: parsed.monto, descripcion: parsed.descripcion })
    }
    toInsert.push(row)
  }

  if (aiPending.length) {
    const trans = aiPending.map(a => ({ fecha: a.fecha, monto: a.monto, descripcion: a.descripcion }))
    const cats = await categorizarRemoto(trans, baseUrl)
    for (const c of cats) {
      const i = c.index - 1
      if (i < 0 || i >= aiPending.length) continue
      const target = toInsert[aiPending[i].idx]
      target.categoria = c.categoria || 'Otro'
      if (c.descripcion_limpia) target.descripcion = c.descripcion_limpia
    }
  }

  let inserted = 0
  if (toInsert.length) {
    const { error } = await supabase.from('gastos').insert(toInsert)
    if (error) throw new Error(error.message)
    inserted = toInsert.length
  }

  return { fetched: messages.length, inserted, skipped: existing.size }
}

export default async function handler(req, res) {
  try {
    const result = await syncGmail()
    return res.status(200).json(result)
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
