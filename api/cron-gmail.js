import { syncGmail } from './gmail-sync.js'

export default async function handler(req, res) {
  try {
    const result = await syncGmail()
    return res.status(200).json({ ok: true, ...result })
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message })
  }
}
