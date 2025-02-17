import { NextResponse } from 'next/server'

const WORKER_URL = process.env.WORKER_URL || 'http://localhost:8787'

export async function POST(req: Request) {
  try {
    const { html, faculty } = await req.json()

    if (!html) {
      return NextResponse.json({ error: 'El HTML es requerido' }, { status: 400 })
    }

    if (!faculty) {
      return NextResponse.json({ error: 'La facultad es requerida' }, { status: 400 })
    }

    // Enviar al worker
    const response = await fetch(WORKER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: JSON.stringify({ html, faculty }),
    })

    if (!response.ok) {
      const error = await response.json()
      return NextResponse.json(error, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error procesando el HTML:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

