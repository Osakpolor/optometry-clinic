import fs from 'fs'
import path from 'path'

// Only STABLE, per-clinic identity fields live here. Everything that changes
// per message (today's date, time of day, greeting flags, the patient record)
// is supplied separately as an uncached system block by the caller, so the
// compiled prompt below stays byte-identical across calls and can be cached.
type ClinicConfig = {
  clinic_name: string
  clinic_address: string
  clinic_phone: string
  clinic_services: string
  clinic_hours: string
}

export async function loadClinicPrompt(
  clinicId: string,
  config: ClinicConfig
): Promise<string> {
  const promptPath = path.join(process.cwd(), 'prompts', `${clinicId}.md`)

  let template: string
  try {
    template = fs.readFileSync(promptPath, 'utf-8')
  } catch {
    const basePath = path.join(process.cwd(), 'prompts', 'base-template.md')
    template = fs.readFileSync(basePath, 'utf-8')
  }

  template = template.replace(/^---[\s\S]*?---\n/, '')

  const compiled = template
    .replace(/{{clinic_name}}/g, config.clinic_name)
    .replace(/{{clinic_address}}/g, config.clinic_address)
    .replace(/{{clinic_phone}}/g, config.clinic_phone)
    .replace(/{{clinic_services}}/g, config.clinic_services)
    .replace(/{{clinic_hours}}/g, config.clinic_hours)

  return compiled
}