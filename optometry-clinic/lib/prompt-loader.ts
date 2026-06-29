import fs from 'fs'
import path from 'path'

type ClinicConfig = {
  clinic_name: string
  clinic_address: string
  clinic_phone: string
  clinic_services: string
  clinic_hours: string
  patient_context: string
}

export async function loadClinicPrompt(
  clinicId: string,
  config: ClinicConfig
): Promise<string> {
  // Load the markdown file for this clinic
  const promptPath = path.join(process.cwd(), 'prompts', `${clinicId}.md`)
  
  let template: string
  
  try {
    template = fs.readFileSync(promptPath, 'utf-8')
  } catch {
    // Fall back to base template if clinic-specific one doesn't exist
    const basePath = path.join(process.cwd(), 'prompts', 'base-template.md')
    template = fs.readFileSync(basePath, 'utf-8')
  }

  // Strip the frontmatter (--- metadata ---)
  template = template.replace(/^---[\s\S]*?---\n/, '')

  // Replace all {{variables}} with actual values
  const compiled = template
    .replace(/{{clinic_name}}/g, config.clinic_name)
    .replace(/{{clinic_address}}/g, config.clinic_address)
    .replace(/{{clinic_phone}}/g, config.clinic_phone)
    .replace(/{{clinic_services}}/g, config.clinic_services)
    .replace(/{{clinic_hours}}/g, config.clinic_hours)
    .replace(/{{patient_context}}/g, config.patient_context)

  return compiled
}