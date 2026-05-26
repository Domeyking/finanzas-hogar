import { syncGmail } from './gmail-sync.js'

export default async function handler(req, res) {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    return res.status(500).json({ ok: false, error: 'CRON_SECRET no configurado' })
  }
  const auth = req.headers.authorization || ''
  if (auth !== `Bearer ${expected}`) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' })
  }

  try {
    const result = await syncGmail()
    return res.status(200).json({ ok: true, ...result })
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message })
  }
}
