import type { IncomingTextMessage, NotificationBody, OutgoingMessageStatus } from './types'

export function parseOutgoingStatus(body: NotificationBody): OutgoingMessageStatus | null {
  if (body.typeWebhook !== 'outgoingMessageStatus' || !body.idMessage || !body.status) return null

  return {
    id: body.idMessage,
    chatId: body.chatId,
    status: body.status,
  }
}

export function parseIncomingText(body: NotificationBody): IncomingTextMessage | null {
  if (body.typeWebhook !== 'incomingMessageReceived') return null

  const type = body.messageData?.typeMessage
  const text =
    type === 'textMessage'
      ? body.messageData?.textMessageData?.textMessage
      : type === 'extendedTextMessage'
        ? body.messageData?.extendedTextMessageData?.text
        : undefined

  const chatId = body.senderData?.chatId
  if (!text || !chatId) return null

  return {
    id: body.idMessage ?? `${chatId}-${body.timestamp ?? Date.now()}`,
    chatId,
    text,
    senderName: body.senderData?.senderName || body.senderData?.chatName || 'Собеседник',
    timestamp: body.timestamp ? body.timestamp * 1000 : Date.now(),
  }
}
