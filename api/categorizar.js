export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { transacciones } = req.body

  const prompt = `Eres un asistente financiero chileno. Tienes esta lista de transacciones bancarias y debes categorizarlas.

Las categorías disponibles son EXACTAMENTE estas (usa solo estas, sin inventar otras):
- Arriendo / dividendo
- Supermercado
- Alimentación (resto)
- Transporte
- Salud
- Educación
- Entretenimiento
- Ropa / calzado
- Hogar / servicios básicos
- Tecnología
- Viajes
- Seguros
- Inversión / ahorro
- Otro

Transacciones a categorizar:
${transacciones.map((t, i) => `${i + 1}. Fecha: ${t.fecha} | Monto: ${t.monto} | Descripción: ${t.descripcion}`).join('\n')}

Responde ÚNICAMENTE con un JSON válido, sin texto antes ni después, con este formato exacto:
[
  {"index": 1, "categoria": "Supermercado", "descripcion_limpia": "Jumbo Las Condes"},
  {"index": 2, "categoria": "Transporte", "descripcion_limpia": "Metro Red"}
]

Reglas:
- "index" es el número de la transacción
- "categoria" debe ser exactamente una de las categorías listadas
- "descripcion_limpia" es la descripción simplificada y legible en español`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      return res.status(500).json({ error: err })
    }

    const data = await response.json()
    const text = data.content[0].text.trim()
    const clean = text.replace(/```json|```/g, '').trim()
    const resultado = JSON.parse(clean)
    return res.status(200).json(resultado)

  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
