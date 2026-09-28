export type StoredMessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'error'

export interface StoredMessage {
  id: string
  text: string
  direction: 'incoming' | 'outgoing'
  timestamp: number
  status?: StoredMessageStatus
}

export interface StoredChat {
  id: string
  phone: string
  title: string
  messages: StoredMessage[]
}

export interface StoredChatState {
  chats: StoredChat[]
  activeChatId: string | null
}

interface StoragePayload extends StoredChatState {
  version: 1
}

const STORAGE_PREFIX = 'green-api:chats:'
const messageStatuses = new Set<StoredMessageStatus>([
  'sending',
  'sent',
  'delivered',
  'read',
  'error',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function parseMessage(value: unknown): StoredMessage | null {
  if (!isRecord(value)) return null
  if (typeof value.id !== 'string' || typeof value.text !== 'string') return null
  if (value.direction !== 'incoming' && value.direction !== 'outgoing') return null
  if (typeof value.timestamp !== 'number' || !Number.isFinite(value.timestamp)) return null
  if (value.status !== undefined && !messageStatuses.has(value.status as StoredMessageStatus)) return null

  return {
    id: value.id,
    text: value.text,
    direction: value.direction,
    timestamp: value.timestamp,
    // A request interrupted by a reload has an unknown result and should be retryable.
    status: value.status === 'sending' ? 'error' : value.status as StoredMessageStatus | undefined,
  }
}

function parseChat(value: unknown): StoredChat | null {
  if (!isRecord(value)) return null
  if (typeof value.id !== 'string' || typeof value.phone !== 'string' || typeof value.title !== 'string') {
    return null
  }
  if (!Array.isArray(value.messages)) return null

  return {
    id: value.id,
    phone: value.phone,
    title: value.title,
    messages: value.messages.map(parseMessage).filter((message): message is StoredMessage => Boolean(message)),
  }
}

export function chatStorageKey(idInstance: string) {
  return `${STORAGE_PREFIX}${idInstance.trim()}`
}

export function loadChatState(idInstance: string, storage: Storage = window.localStorage): StoredChatState {
  try {
    const raw = storage.getItem(chatStorageKey(idInstance))
    if (!raw) return { chats: [], activeChatId: null }

    const payload: unknown = JSON.parse(raw)
    if (!isRecord(payload) || payload.version !== 1 || !Array.isArray(payload.chats)) {
      return { chats: [], activeChatId: null }
    }

    const chats = payload.chats.map(parseChat).filter((chat): chat is StoredChat => Boolean(chat))
    const requestedActiveId = typeof payload.activeChatId === 'string' ? payload.activeChatId : null
    const activeChatId = chats.some((chat) => chat.id === requestedActiveId) ? requestedActiveId : null

    return { chats, activeChatId }
  } catch {
    return { chats: [], activeChatId: null }
  }
}

export function saveChatState(
  idInstance: string,
  state: StoredChatState,
  storage: Storage = window.localStorage,
) {
  try {
    const payload: StoragePayload = { version: 1, ...state }
    storage.setItem(chatStorageKey(idInstance), JSON.stringify(payload))
    return true
  } catch {
    return false
  }
}
