import type {
  CheckWhatsappResponse,
  Credentials,
  InstanceSettings,
  NotificationEnvelope,
  SendMessageResponse,
} from './types'

export class GreenApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message)
    this.name = 'GreenApiError'
  }
}

function endpoint(credentials: Credentials, method: string, baseUrl = credentials.apiUrl) {
  const rawBase = baseUrl.trim().replace(/\/+$/, '')
  return `${rawBase}/waInstance${credentials.idInstance.trim()}/${method}/${credentials.apiTokenInstance.trim()}`
}

function errorMessage(status: number, payload: unknown): string {
  if (status === 401) return 'Неверный ID инстанса или API-токен.'
  if (status === 466) return 'Достигнут лимит чатов тарифа Developer.'
  if (status === 469) return 'WhatsApp временно ограничил поиск контактов. Попробуйте позже.'
  if (status === 429) return 'Слишком много запросов. Подождите немного.'

  if (payload && typeof payload === 'object') {
    const data = payload as Record<string, unknown>
    const value = data.message ?? data.reason ?? data.description
    if (typeof value === 'string') return value
  }

  return `GREEN-API вернул ошибку ${status}.`
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response

  try {
    response = await fetch(url, init)
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new GreenApiError('Не удалось подключиться к GREEN-API. Проверьте интернет и API URL.')
  }

  const text = await response.text()
  let payload: unknown = null

  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = text
    }
  }

  if (!response.ok) {
    throw new GreenApiError(errorMessage(response.status, payload), response.status)
  }

  return payload as T
}

export async function checkWhatsapp(credentials: Credentials, phoneNumber: string) {
  const init: RequestInit = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phoneNumber: Number(phoneNumber) }),
  }

  const shard = credentials.idInstance.trim().slice(0, 4)
  const shardUrl = /^\d{4}$/.test(shard) ? `https://${shard}.api.green-api.com` : null
  const urls = [
    endpoint(credentials, 'checkWhatsapp'),
    shardUrl ? endpoint(credentials, 'checkWhatsapp', shardUrl) : null,
  ].filter((url, index, items): url is string => Boolean(url) && items.indexOf(url) === index)

  let lastError: unknown

  for (const url of urls) {
    try {
      return await request<CheckWhatsappResponse>(url, init)
    } catch (error) {
      lastError = error

      // Try the instance shard only for routing/CORS failures.
      if (!(error instanceof GreenApiError) || (error.status !== undefined && error.status !== 404)) {
        throw error
      }
    }
  }

  throw lastError
}

export function sendMessage(credentials: Credentials, chatId: string, message: string) {
  return request<SendMessageResponse>(endpoint(credentials, 'sendMessage'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chatId, message }),
  })
}

export function getSettings(credentials: Credentials) {
  return request<InstanceSettings>(endpoint(credentials, 'getSettings'))
}

export function enableHttpNotifications(credentials: Credentials) {
  return request<{ saveSettings: boolean }>(endpoint(credentials, 'setSettings'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      webhookUrl: '',
      incomingWebhook: 'yes',
      outgoingWebhook: 'yes',
      outgoingAPIMessageWebhook: 'yes',
      outgoingMessageWebhook: 'yes',
      markIncomingMessagesReaded: 'yes',
    }),
  })
}

export function receiveNotification(credentials: Credentials, signal: AbortSignal) {
  const url = `${endpoint(credentials, 'receiveNotification')}?receiveTimeout=5`
  return request<NotificationEnvelope | null>(url, { signal })
}

export function deleteNotification(credentials: Credentials, receiptId: number) {
  return request<{ result: boolean }>(
    `${endpoint(credentials, 'deleteNotification')}/${receiptId}`,
    { method: 'DELETE' },
  )
}
