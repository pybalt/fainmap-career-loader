'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription } from '@/components/ui/alert'
import Logo from './Logo'

export default function HtmlInput() {
  const [html, setHtml] = useState('')
  const [feedback, setFeedback] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFeedback('Processing...')

    try {
      const response = await fetch('/api/process-html', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ html }),
      })

      if (!response.ok) {
        throw new Error('Failed to process HTML')
      }

      setFeedback('HTML processed successfully!')
      setHtml('')
    } catch (error) {
      setFeedback('Error processing HTML. Please try again.')
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Logo />
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex space-x-2">
          <Input
            type="text"
            placeholder="Paste your HTML link here"
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            className="flex-grow border-blue-300 focus:border-blue-500"
          />
          <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">
            Submit
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

