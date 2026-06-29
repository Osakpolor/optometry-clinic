import fs from 'fs'
import path from 'path'

type ClinicConfig = {
  clinic_name: string
  clinic_address: string
  clinic_phone: string
  clinic_services: string
  clinic_hours: string
  patient_context: string
  is_first_message: string
  time_of_day: string
  patient_name: string
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
    .replace(/{{patient_context}}/g, config.patient_context)
    .replace(/{{is_first_message}}/g, config.is_first_message)
    .replace(/{{time_of_day}}/g, config.time_of_day)
    .replace(/{{patient_name}}/g, config.patient_name)

  return compiled
}