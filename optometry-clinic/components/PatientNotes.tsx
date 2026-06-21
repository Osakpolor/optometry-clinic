'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function PatientNotes({ patientId, initialNotes }: { patientId: string; initialNotes: string | null }) {
  const [notes, setNotes] = useState(initialNotes ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    const { error } = await supabase.from('patients').update({ notes }).eq('id', patientId)
    setSaving(false)
    if (!error) {
      setSaved(true)
      router.refresh()
    }
  }

  return (
    <div className="mt-6">
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium">CRM notes</span>
        <textarea
          value={notes}
          onChange={(e) => { setNotes(e.target.value); setSaved(false) }}
          rows={6}
          className="rounded border border-gray-300 p-2"
          placeholder="Preferences, follow-up reminders, conversation history..."
        />
      </label>
      <button onClick={handleSave} disabled={saving} className="mt-2 rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50">
        {saving ? 'Saving…' : saved ? 'Saved' : 'Save notes'}
      </button>
    </div>
  )
}