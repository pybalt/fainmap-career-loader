import Header from '@/components/Header'
import HtmlInput from '@/components/HtmlInput'
import Footer from '@/components/Footer'

export default function Home() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <Header />
      <main className="flex-grow flex items-center">
        <div className="container mx-auto px-4">
          <HtmlInput />
        </div>
      </main>
      <Footer />
    </div>
  )
}

