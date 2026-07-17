import Link from 'next/link'

export default function BookLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Patient-facing nav — links back to the marketing site only */}
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <nav className="mx-auto flex max-w-4xl items-center justify-between px-4 sm:px-6 py-3">
          <Link
            href="https://olueyeclinic.com"
            className="font-bold text-base sm:text-lg text-gray-900 hover:text-brand transition-colors"
          >
            Olu Eye Clinic
          </Link>
          <div className="hidden sm:flex items-center gap-6 text-sm">
            <Link
              href="https://olueyeclinic.com/#services"
              className="text-gray-500 hover:text-gray-900 transition-colors"
            >
              Services
            </Link>
            <Link
              href="https://olueyeclinic.com/about"
              className="text-gray-500 hover:text-gray-900 transition-colors"
            >
              About us
            </Link>
            <Link
              href="https://olueyeclinic.com/contact"
              className="text-gray-500 hover:text-gray-900 transition-colors"
            >
              Contact
            </Link>
          </div>
        </nav>
      </header>
      {children}
    </>
  )
}