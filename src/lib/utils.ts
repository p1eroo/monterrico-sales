import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Contact, LinkedCompany } from "@/types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Obtiene la empresa principal de un contacto (isPrimary o la primera) */
export function getPrimaryCompany(contact: Contact): LinkedCompany | undefined {
  if (!contact.companies?.length) return undefined
  return contact.companies.find((c) => c.isPrimary) ?? contact.companies[0]
}

/** Nombre de la empresa principal (compatibilidad) */
export function getPrimaryCompanyName(contact: Contact): string {
  return getPrimaryCompany(contact)?.name ?? ''
}
