export async function categorizarTransacciones(transacciones) {
  const response = await fetch('/api/categorizar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transacciones }),
  })

  if (!response.ok) {
    const err = await response.json()
    throw new Error(err.error || 'Error en el servidor')
  }

  return response.json()
}
