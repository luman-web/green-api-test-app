import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  checkWhatsapp,
  deleteNotification,
  enableHttpNotifications,
  getSettings,
  receiveNotification,
  sendMessage,
} from './greenApiClient'
import type { Credentials } from './types'

const credentials: Credentials = {
  idInstance: '1101000000',
  apiTokenInstance: 'test-token',
  apiUrl: 'https://api.green-api.com/',
}

function response(payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('greenApiClient', () => {
  afterEach(() => vi.restoreAllMocks())

  it('checks the account using a normalized numeric phone', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      response({ existsWhatsapp: true, chatId: '10000000@lid' }),
    )

    await checkWhatsapp(credentials, '79991234567')

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.green-api.com/waInstance1101000000/checkWhatsapp/test-token',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ phoneNumber: 79991234567 }),
      }),
    )
  })

  it('retries CheckWhatsapp through the instance shard after a 404', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: 'Not Found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
        .mockResolvedValueOnce(response({ existsWhatsapp: true, chatId: '10000000@lid' }))

    const result = await checkWhatsapp(credentials, '79991234567')

    expect(result.chatId).toBe('10000000@lid')
    expect(fetchMock.mock.calls[1][0]).toBe(
      'https://1101.api.green-api.com/waInstance1101000000/checkWhatsapp/test-token',
    )
  })

  it('sends a text message to a WhatsApp chatId', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      response({ idMessage: 'message-id' }),
    )

    await sendMessage(credentials, '10000000@lid', 'Привет!')

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.green-api.com/waInstance1101000000/sendMessage/test-token',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ chatId: '10000000@lid', message: 'Привет!' }),
      }),
    )
  })

  it('receives and deletes a queue notification', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(response({ receiptId: 42, body: {} }))
      .mockResolvedValueOnce(response({ result: true }))
    const controller = new AbortController()

    await receiveNotification(credentials, controller.signal)
    await deleteNotification(credentials, 42)

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.green-api.com/waInstance1101000000/receiveNotification/test-token?receiveTimeout=5',
    )
    expect(fetchMock.mock.calls[1]).toEqual([
      'https://api.green-api.com/waInstance1101000000/deleteNotification/test-token/42',
      { method: 'DELETE' },
    ])
  })

  it('reads and enables HTTP notification settings', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(response({ webhookUrl: '', incomingWebhook: 'no' }))
      .mockResolvedValueOnce(response({ saveSettings: true }))

    await getSettings(credentials)
    await enableHttpNotifications(credentials)

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.green-api.com/waInstance1101000000/getSettings/test-token',
    )
    expect(fetchMock.mock.calls[1]).toEqual([
      'https://api.green-api.com/waInstance1101000000/setSettings/test-token',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          webhookUrl: '',
          incomingWebhook: 'yes',
          outgoingWebhook: 'yes',
          outgoingAPIMessageWebhook: 'yes',
          outgoingMessageWebhook: 'yes',
          markIncomingMessagesReaded: 'yes',
        }),
      }),
    ])
  })
})
