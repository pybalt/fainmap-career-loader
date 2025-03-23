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

    // Construir la URL con el parámetro de facultad
    const workerURL = new URL(WORKER_URL);
    workerURL.searchParams.append('facultyId', faculty);
    workerURL.searchParams.append('saveToDb', 'true');

    // Enviar al worker el HTML plano
    const response = await fetch(workerURL.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain', // Enviar como texto plano
      },
      body: html, // Solo enviar el HTML, sin JSON
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

