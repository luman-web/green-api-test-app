import { describe, expect, it } from 'vitest'
import { parseIncomingText, parseOutgoingStatus } from './notificationParser'

describe('parseIncomingText', () => {
  it('parses an incoming text notification', () => {
    const result = parseIncomingText({
      typeWebhook: 'incomingMessageReceived',
      timestamp: 1763115112,
      idMessage: 'message-1',
      senderData: { chatId: '10000000', senderName: 'Иван' },
      messageData: {
        typeMessage: 'textMessage',
        textMessageData: { textMessage: 'Привет!' },
      },
    })

    expect(result).toEqual({
      id: 'message-1',
      chatId: '10000000',
      text: 'Привет!',
      senderName: 'Иван',
      timestamp: 1763115112000,
    })
  })

  it('ignores status and non-text notifications', () => {
    expect(parseIncomingText({ typeWebhook: 'outgoingMessageStatus' })).toBeNull()
    expect(
      parseIncomingText({
        typeWebhook: 'incomingMessageReceived',
        senderData: { chatId: '1' },
        messageData: { typeMessage: 'imageMessage' },
      }),
    ).toBeNull()
  })

  it('parses outgoing delivery and read statuses', () => {
    expect(parseOutgoingStatus({
      typeWebhook: 'outgoingMessageStatus',
      idMessage: 'message-2',
      chatId: '79991234567@c.us',
      status: 'read',
    })).toEqual({
      id: 'message-2',
      chatId: '79991234567@c.us',
      status: 'read',
    })
  })
})
