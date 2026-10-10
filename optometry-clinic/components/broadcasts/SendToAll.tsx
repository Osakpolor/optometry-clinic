'use client'

// components/broadcasts/SendToAll.tsx
// Minimal admin control for the World Sight Day blast: a live recipient count,
// a "send test to me" button, and a guarded "send to all" that only unlocks
// once the admin types the confirmation phrase.
//
// A click is NEVER silent: every send renders an inline result banner (success
// or error) in the page itself. The toast() calls are kept too, but the banner
// does not depend on a <Toaster> being mounted.

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { sendWorldSightDayTest, sendWorldSightDayToAll } from '@/app/actions/broadcastCampaign'
import { SEND_TO_ALL_CONFIRM_PHRASE } from '@/lib/broadcast-campaign'

type Props = {
  recipientCount: number
  imageUrl: string // '' when the header image is unresolved
}

type Result = { kind: 'success' | 'error'; text: string } | null

export function SendToAll({ recipientCount, imageUrl }: Props) {
  const [testPhone, setTestPhone] = useState('')
  const [confirmText, setConfirmText] = useState('')
  const [loading, setLoading] = useState<'test' | 'all' | null>(null)
  const [result, setResult] = useState<Result>(null)

  const imageConfigured = imageUrl.length > 0
  const confirmed = confirmText.trim().toUpperCase() === SEND_TO_ALL_CONFIRM_PHRASE

  function show(kind: 'success' | 'error', text: string) {
    setResult({ kind, text })
    if (kind === 'success') toast.success(text)
    else toast.error(text)
  }

  async function run(kind: 'test' | 'all') {
    setLoading(kind)
    setResult(null)
    try {
      const res =
        kind === 'test'
          ? await sendWorldSightDayTest(testPhone)
          : await sendWorldSightDayToAll(confirmText)

      if (res.ok) {
        show(
          'success',
          kind === 'test'
            ? `Test queued to ${res.totalCount} recipient — now sending.`
            : `Queued to ${res.totalCount.toLocaleString()} patient(s) — now sending. In test mode, only allowlisted numbers actually receive it.`,
        )
        if (kind === 'all') setConfirmText('')
      } else {
        show('error', res.error)
      }
    } catch (e: unknown) {
      // A thrown server action (e.g. auth failure) would otherwise hang silently.
      show('error', e instanceof Error ? e.message : 'The send failed unexpectedly. Please try again.')
    } finally {
      setLoading(null)
    }
  }

  function handleTest() {
    if (!testPhone.trim()) {
      show('error', 'Enter a test phone number first.')
      return
    }
    void run('test')
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

      {/* Inline result — the guarantee that a click is never silent */}
      {result && (
        <div
          role="status"
          aria-live="polite"
          className={`rounded-lg border px-4 py-3 text-sm ${
            result.kind === 'success'
              ? 'border-brand/30 bg-brand/5 text-brand'
              : 'border-destructive/30 bg-destructive/5 text-destructive'
          }`}
        >
          {result.text}
        </div>
      )}

      {/* Image config state */}
      {imageConfigured ? (
        <p className="text-xs text-muted-foreground break-all">
          Header image: <span className="text-gray-700">{imageUrl}</span>
        </p>
      ) : (
        <p className="text-xs text-destructive">
          Header image not configured — sends will be rejected by Meta.
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
          Must be a patient on file, not opted out, and (in test mode) on the allowlist.
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
          onClick={() => void run('all')}
          disabled={loading !== null || !confirmed || !imageConfigured || recipientCount === 0}
        >
          {loading === 'all' ? 'Sending…' : `Send to ${recipientCount.toLocaleString()} patients`}
        </Button>
      </div>
    </div>
  )
}
