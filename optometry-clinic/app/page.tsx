import Link from 'next/link'

const SERVICES = [
  { name: 'Eye exam', description: 'Comprehensive vision and eye health checks.' },
  { name: 'Glasses fitting', description: 'Find the right frames and lenses for your prescription.' },
  { name: 'Contact lens fitting', description: 'Get fitted and trained for comfortable contact lens wear.' },
  { name: 'Follow-up visit', description: 'Check-ins after a procedure, fitting, or treatment.' },
]

export default function Home() {
  return (
    <main className="mx-auto max-w-4xl p-10">
      <section className="py-12">
        <h1 className="text-4xl font-semibold">Clear vision starts here</h1>
        <p className="mt-4 max-w-xl text-gray-600">
          Comprehensive eye exams, glasses, and contact lens fittings — book an appointment in minutes.
        </p>
        <Link href="/book" className="mt-6 inline-block rounded bg-black px-5 py-3 text-sm text-white">
          Book an appointment
        </Link>
      </section>

      <section className="py-12">
        <h2 className="text-2xl font-semibold">Our services</h2>
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          {SERVICES.map((s) => (
            <div key={s.name} className="rounded border border-gray-200 p-5">
              <h3 className="font-medium">{s.name}</h3>
              <p className="mt-2 text-sm text-gray-600">{s.description}</p>
            </div>
          ))}
        </div>
        <Link href="/services" className="mt-4 inline-block text-sm text-blue-600 underline">
          See full services list
        </Link>
      </section>
    </main>
  )
}