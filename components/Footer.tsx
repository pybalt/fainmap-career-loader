import Link from 'next/link'

export default function Footer() {
  const linkedinUrl = process.env.LINKEDIN_URL || '#'

  return (
    <footer className="bg-blue-600 text-white py-4 text-center">
      <p>
        Author: Leonel B. Bravo -{' '}
        <Link href={linkedinUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-200">
          LinkedIn
        </Link>
      </p>
    </footer>
  )
}

