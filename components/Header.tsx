import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function Header() {
  return (
    <header className="bg-blue-600 text-white py-4">
      <div className="container mx-auto px-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold">fainmap</h1>
        <nav>
          <Button variant="ghost" asChild className="text-white hover:text-blue-200 mr-4">
            <Link href="/docs">Docs</Link>
          </Button>
          <Button variant="ghost" asChild className="text-white hover:text-blue-200">
            <Link href="/site">Site</Link>
          </Button>
        </nav>
      </div>
    </header>
  )
}

