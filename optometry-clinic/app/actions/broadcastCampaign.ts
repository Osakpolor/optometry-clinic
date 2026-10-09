'use server'

// app/actions/broadcastCampaign.ts
//
// Minimal, campaign-specific wrappers around sendBroadcastNow for the World
// Sight Day blast. The campaign parameters (template, language, body token,
// button) live HERE on the server, not in the client — the admin page only
// chooses test-vs-all and supplies a test number / typed confirmation. That
// keeps a client from ever picking an arbitrary template or image.
//
// The header image URL comes from the env var BROADCAST_WSD_IMAGE_URL (the
// public broadcast-media PNG). It is REQUIRED — these templates have an image
// header, and sending without one is rejected by Meta (#132012).

import { getUserRole, canManageBroadcasts } from '@/lib/auth/roles'
import { sendBroadcastNow, type SendBroadcastResult } from '@/app/actions/broadcastActions'

const WSD_CAMPAIGN = {
  title: 'World Sight Day — free eye test',
  templateName: 'wsd_free_eye_test_oct10_v3',
  language: 'en',
  bodyParams: ['{{first_name}}'],
  buttonUrl: null as string | null,
}

// Typed exactly (case-insensitive) to unlock the send-to-all button.
export const SEND_TO_ALL_CONFIRM_PHRASE = 'SEND TO ALL'

function wsdImageUrl(): string {
  return process.env.BROADCAST_WSD_IMAGE_URL?.trim() ?? ''
}

async function assertAdmin() {
  // sendBroadcastNow guards too; this fails fast before any work/validation.
  const role = await getUserRole()
  if (!canManageBroadcasts(role)) {
    throw new Error('Not authorized: broadcasts are admin-only.')
  }
}

/** Send the WSD template to ONE number (the admin's own, for a live test). */
export async function sendWorldSightDayTest(testPhone: string): Promise<SendBroadcastResult> {
  await assertAdmin()

  const phone = testPhone?.trim()
  if (!phone) return { ok: false, error: 'Enter a test phone number first.' }

  const headerImageUrl = wsdImageUrl()
  if (!headerImageUrl) {
    return { ok: false, error: 'Header image not configured — set BROADCAST_WSD_IMAGE_URL.' }
  }

  return sendBroadcastNow({
    ...WSD_CAMPAIGN,
    title: `${WSD_CAMPAIGN.title} (test)`,
    headerImageUrl,
    audienceFilter: { phones: [phone] },
  })
}

/** Send the WSD template to ALL eligible patients. Requires a typed confirmation. */
export async function sendWorldSightDayToAll(confirmText: string): Promise<SendBroadcastResult> {
  await assertAdmin()

  if ((confirmText ?? '').trim().toUpperCase() !== SEND_TO_ALL_CONFIRM_PHRASE) {
    return { ok: false, error: `Type "${SEND_TO_ALL_CONFIRM_PHRASE}" to confirm the send to all patients.` }
  }

  const headerImageUrl = wsdImageUrl()
  if (!headerImageUrl) {
    return { ok: false, error: 'Header image not configured — set BROADCAST_WSD_IMAGE_URL.' }
  }

  // Empty audienceFilter = all active, non-opted-out patients (the enqueue
  // applies deleted_at IS NULL + marketing_opted_out = false).
  return sendBroadcastNow({
    ...WSD_CAMPAIGN,
    headerImageUrl,
    audienceFilter: {},
  })
}
