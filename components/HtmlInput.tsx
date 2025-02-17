'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import Logo from './Logo'
import { FacultySelect } from './ui/faculty-select'

export default function HtmlInput() {
  const [html, setHtml] = useState('')
  const [feedback, setFeedback] = useState('')
  const [selectedFaculty, setSelectedFaculty] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedFaculty) {
      setFeedback('Por favor selecciona una facultad')
      return
    }
    setFeedback('Procesando...')

    try {
      const response = await fetch('/api/process-html', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ html, faculty: selectedFaculty }),
      })

      if (!response.ok) {
        throw new Error('Error al procesar el HTML')
      }

      setFeedback('¡HTML procesado exitosamente!')
      setHtml('')
    } catch (error) {
      setFeedback('Error al procesar el HTML. Por favor intenta de nuevo.')
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Logo />
      <form onSubmit={handleSubmit} className="space-y-4">
        <FacultySelect onSelect={setSelectedFaculty} />
        <div className="flex space-x-2">
          <Input
            type="text"
            placeholder="Pega el HTML acá"
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            className="flex-grow border-blue-300 focus:border-blue-500"
          />
          <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">
            Enviar
          </Button>
        </div>
      </form>
      {feedback && (
        <Alert className="mt-4">
          <AlertDescription>{feedback}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}

