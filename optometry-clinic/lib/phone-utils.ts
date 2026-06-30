// Normalises any Nigerian phone number format into one consistent format
// for reliable matching against the database

export function normalizePhone(phone: string): string {
  // Strip all non-digit characters (spaces, dashes, parentheses, +)
  let digits = phone.replace(/\D/g, '')

  // Remove leading 234 if present, then we'll work with local format
  if (digits.startsWith('234')) {
    digits = digits.slice(3)
  }

  // Remove leading 0 if present
  if (digits.startsWith('0')) {
    digits = digits.slice(1)
  }

  // Now digits should be the 10-digit local number (e.g. 8012345678)
  return digits
}

// Generates all common formats a number might be stored as in the database
export function getPhoneVariants(phone: string): string[] {
  const normalized = normalizePhone(phone)

  return [
    normalized,                  // 8012345678
    `0${normalized}`,            // 08012345678
    `234${normalized}`,          // 2348012345678
    `+234${normalized}`,         // +2348012345678
  ]
}