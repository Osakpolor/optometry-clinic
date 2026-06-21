import Link from 'next/link'

const SERVICES = [
  { name: 'Eye exam', description: 'A full check of your vision and eye health, including screening for common conditions.' },
  { name: 'Glasses fitting', description: 'Personalized frame and lens selection based on your prescription, face shape, and lifestyle.' },
  { name: 'Contact lens fitting', description: 'Measurement, trial lenses, and hands-on training for safe and comfortable contact lens wear.' },
  { name: 'Follow-up visit', description: 'A shorter check-in after a fitting, procedure, or prescription change to confirm everything is working well.' },
]

export default function ServicesPage() {
  return (
    <main className="mx-auto max-w-3xl p-10">
      <h1 className="text-3xl font-semibold">Services</h1>
      <p className="mt-2 text-gray-600">Here&apos;s what we offer — book any of these directly online.</p>

      <div className="mt-8 flex flex-col gap-6">
        {SERVICES.map((s) => (
          <div key={s.name} className="border-b border-gray-200 pb-6">
            <h2 className="text-lg font-medium">{s.name}</h2>
            <p className="mt-2 text-gray-600">{s.description}</p>
          </div>
        ))}
      </div>

      <Link href="/book" className="mt-8 inline-block rounded bg-black px-5 py-3 text-sm text-white">
        Book an appointment
      </Link>
    </main>
  )
}