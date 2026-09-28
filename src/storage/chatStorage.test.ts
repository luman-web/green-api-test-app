import { beforeEach, describe, expect, it } from 'vitest'
import { chatStorageKey, loadChatState, saveChatState } from './chatStorage'

describe('chatStorage', () => {
  beforeEach(() => localStorage.clear())

  it('stores chats separately for each instance', () => {
    saveChatState('7201000000', {
      activeChatId: '79991234567@c.us',
      chats: [{
        id: '79991234567@c.us',
        phone: '79991234567',
        title: '+7 999 123-45-67',
        messages: [{
          id: 'message-1',
          text: 'Привет!',
          direction: 'incoming',
          timestamp: 1_763_115_112_000,
        }],
      }],
    })

    expect(loadChatState('7201000000').chats).toHaveLength(1)
    expect(loadChatState('7202000000')).toEqual({ chats: [], activeChatId: null })
  })

  it('marks an interrupted outgoing message as failed after reload', () => {
    localStorage.setItem(chatStorageKey('1'), JSON.stringify({
      version: 1,
      activeChatId: 'chat',
      chats: [{
        id: 'chat',
        phone: '79991234567',
        title: 'Test',
        messages: [{
          id: 'local-1',
          text: 'Отправка',
          direction: 'outgoing',
          timestamp: 123,
          status: 'sending',
        }],
      }],
    }))

    expect(loadChatState('1').chats[0].messages[0].status).toBe('error')
  })

  it('ignores malformed persisted data', () => {
    localStorage.setItem(chatStorageKey('1'), '{broken json')
    expect(loadChatState('1')).toEqual({ chats: [], activeChatId: null })
  })
})
