'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'

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
    if (!error) { setSaved(true); router.refresh() }
  }

  return (
    <div className="flex flex-col gap-3">
      <textarea
        value={notes}
        onChange={e => { setNotes(e.target.value); setSaved(false) }}
        rows={5}
        placeholder="Receptionist or doctor notes about this patient…"
        className="w-full rounded-md border border-input bg-yellow-50 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
      />
      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving} size="sm">
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save notes'}
        </Button>
        {saved && <span className="text-xs text-green-600">Notes saved</span>}
      </div>
    </div>
  )
}