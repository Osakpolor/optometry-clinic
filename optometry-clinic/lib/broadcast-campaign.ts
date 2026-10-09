// lib/broadcast-campaign.ts
// World Sight Day campaign config — the single source of truth shared by the
// server action (app/actions/broadcastCampaign.ts) and the admin page. Kept in a
// plain module (NOT a 'use server' file) so it can export constants and a sync
// helper, which a 'use server' module cannot.

export const WSD_CAMPAIGN = {
  title: 'World Sight Day — free eye test',
  templateName: 'wsd_free_eye_test_oct10_v3',
  language: 'en',
  bodyParams: ['{{first_name}}'],
  buttonUrl: null as string | null,
}

// Typed exactly (case-insensitive) to unlock the send-to-all button.
export const SEND_TO_ALL_CONFIRM_PHRASE = 'SEND TO ALL'

// Public broadcast-media banner. Required: these templates have an image header,
// and sending without one is rejected by Meta (#132012). Env overridable so a
// different bucket/file can be swapped without a code change.
const WSD_DEFAULT_IMAGE_URL =
  'https://sjasscoqswyjqgbbveow.supabase.co/storage/v1/object/public/broadcast-media/wsd-banner.png'

export function wsdHeaderImageUrl(): string {
  return process.env.BROADCAST_WSD_IMAGE_URL?.trim() || WSD_DEFAULT_IMAGE_URL
}
