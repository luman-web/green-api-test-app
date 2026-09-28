export function normalizePhone(value: string): string {
  return value.replace(/\D/g, '')
}

export function validateWhatsAppPhone(value: string): string | null {
  const phone = normalizePhone(value)

  if (!phone) return 'Введите номер телефона.'
  if (!/^\d{11,16}$/.test(phone)) {
    return 'Введите 11–16 цифр в международном формате.'
  }

  return null
}

export function formatPhone(value: string): string {
  const phone = normalizePhone(value)
  return phone ? `+${phone}` : value
}
