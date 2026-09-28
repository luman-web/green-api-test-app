import { describe, expect, it } from 'vitest'
import { normalizePhone, validateWhatsAppPhone } from './phone'

describe('phone utilities', () => {
  it('removes formatting from a phone number', () => {
    expect(normalizePhone('+7 (999) 123-45-67')).toBe('79991234567')
  })

  it('accepts international WhatsApp numbers', () => {
    expect(validateWhatsAppPhone('+7 999 123-45-67')).toBeNull()
    expect(validateWhatsAppPhone('+1 202 555 0100')).toBeNull()
  })

  it('rejects an unsupported number', () => {
    expect(validateWhatsAppPhone('123')).toMatch(/11–16 цифр/)
  })
})
