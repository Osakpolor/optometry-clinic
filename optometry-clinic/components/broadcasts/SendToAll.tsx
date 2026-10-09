'use client'

// components/broadcasts/SendToAll.tsx
// Minimal admin control for the World Sight Day blast: a live recipient count,
// a "send test to me" button, and a guarded "send to all" that only unlocks
// once the admin types the confirmation phrase.

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { sendWorldSightDayTest, sendWorldSightDayToAll } from '@/app/actions/broadcastCampaign'
import { SEND_TO_ALL_CONFIRM_PHRASE } from '@/lib/broadcast-campaign'

type Props = {
  recipientCount: number
  imageUrl: string // '' when BROADCAST_WSD_IMAGE_URL is unset
}

export function SendToAll({ recipientCount, imageUrl }: Props) {
  const [testPhone, setTestPhone] = useState('')
  const [confirmText, setConfirmText] = useState('')
  const [loading, setLoading] = useState<'test' | 'all' | null>(null)

  const imageConfigured = imageUrl.length > 0
  const confirmed = confirmText.trim().toUpperCase() === SEND_TO_ALL_CONFIRM_PHRASE

  async function handleTest() {
    if (!testPhone.trim()) {
      toast.error('Enter a test phone number first.')
      return
    }
    setLoading('test')
    const res = await sendWorldSightDayTest(testPhone)
    setLoading(null)
    if (res.ok) toast.success(`Test queued to 1 number (${res.totalCount} recipient).`)
    else toast.error(res.error)
  }

  async function handleSendAll() {
    if (!confirmed) return
    setLoading('all')
    const res = await sendWorldSightDayToAll(confirmText)
    setLoading(null)
    if (res.ok) {
      toast.success(`World Sight Day queued to ${res.totalCount} patients — now sending.`)
      setConfirmText('')
    } else {
      toast.error(res.error)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Recipient count */}
      <div>
        <p className="text-3xl font-semibold tracking-tight text-gray-900">
          {recipientCount.toLocaleString()}
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          eligible patients (active, not opted out of marketing)
        </p>
      </div>

      {/* Image config warning */}
      {imageConfigured ? (
        <p className="text-xs text-muted-foreground break-all">
          Header image: <span className="text-gray-700">{imageUrl}</span>
        </p>
      ) : (
        <p className="text-xs text-destructive">
          Header image not configured — set <code>BROADCAST_WSD_IMAGE_URL</code> before sending,
          or Meta will reject every message.
        </p>
      )}

      {/* Send test to me */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Send test to me
        </label>
        <div className="flex gap-2">
          <Input
            value={testPhone}
            onChange={(e) => setTestPhone(e.target.value)}
            placeholder="2348012345678"
            className="text-sm"
            inputMode="tel"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleTest}
            disabled={loading !== null || !imageConfigured}
          >
            {loading === 'test' ? 'Sending…' : 'Send test'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Must be a patient on file, and (in test mode) on the allowlist.
        </p>
      </div>

      {/* Send to all — typed-confirmation guarded */}
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">Send World Sight Day to all</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            This messages all {recipientCount.toLocaleString()} eligible patients and cannot be
            undone. Type <span className="font-semibold">{SEND_TO_ALL_CONFIRM_PHRASE}</span> to confirm.
          </p>
        </div>
        <Input
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder={SEND_TO_ALL_CONFIRM_PHRASE}
          className="text-sm"
        />
        <Button
          type="button"
          size="sm"
          variant="destructive"
          onClick={handleSendAll}
          disabled={loading !== null || !confirmed || !imageConfigured || recipientCount === 0}
        >
          {loading === 'all' ? 'Sending…' : `Send to ${recipientCount.toLocaleString()} patients`}
        </Button>
      </div>
    </div>
  )
}
