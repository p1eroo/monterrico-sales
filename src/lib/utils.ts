import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Lead, LinkedCompany } from "@/types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Obtiene la empresa principal de un contacto (isPrimary o la primera) */
export function getPrimaryCompany(lead: Lead): LinkedCompany | undefined {
  if (!lead.companies?.length) return undefined
  return lead.companies.find((c) => c.isPrimary) ?? lead.companies[0]
}

/** Nombre de la empresa principal (compatibilidad) */
export function getPrimaryCompanyName(lead: Lead): string {
  return getPrimaryCompany(lead)?.name ?? ''
}
