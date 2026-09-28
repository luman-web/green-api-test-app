import {
  type SubmitEvent as ReactSubmitEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  checkWhatsapp,
  enableHttpNotifications,
  getSettings,
  sendMessage,
} from './api/greenApiClient'
import { parseIncomingText, parseOutgoingStatus } from './api/notificationParser'
import type { Credentials, NotificationBody } from './api/types'
import { useNotificationPolling } from './hooks/useNotificationPolling'
import {
  loadChatState,
  saveChatState,
  type StoredChat as Chat,
  type StoredMessage as Message,
  type StoredMessageStatus as MessageStatus,
} from './storage/chatStorage'
import { formatPhone, normalizePhone, validateWhatsAppPhone } from './utils/phone'

const DEFAULT_GREEN_API_URL = 'https://api.green-api.com'

// Вспомогательное представление данных. Сетевые запросы находятся в src/api,
// polling — в src/hooks, а постоянное локальное состояние — в src/storage.
function initials(value: string) {
  const visible = value.replace('+', '')
  return visible.slice(-2) || 'M'
}

function formatTime(timestamp: number) {
  return new Intl.DateTimeFormat('ru', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(timestamp)
}

function LoginPage({ onConnect }: { onConnect: (credentials: Credentials) => void }) {
  const [idInstance, setIdInstance] = useState('')
  const [token, setToken] = useState('')
  const [apiUrl, setApiUrl] = useState(DEFAULT_GREEN_API_URL)
  const [showToken, setShowToken] = useState(false)
  const [error, setError] = useState('')

  const submit = (event: ReactSubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    const id = idInstance.trim()
    const apiTokenInstance = token.trim()

    if (!/^\d+$/.test(id)) {
      setError('ID инстанса должен состоять из цифр.')
      return
    }
    if (!apiTokenInstance) {
      setError('Введите API-токен инстанса.')
      return
    }

    let normalizedApiUrl: string
    try {
      const parsedUrl = new URL(apiUrl.trim())
      if (
        parsedUrl.protocol !== 'https:' ||
        parsedUrl.username ||
        parsedUrl.password ||
        parsedUrl.pathname !== '/' ||
        parsedUrl.search ||
        parsedUrl.hash
      ) {
        throw new Error()
      }
      normalizedApiUrl = parsedUrl.origin
    } catch {
      setError('Введите корректный HTTPS-адрес API без пути, например https://api.green-api.com.')
      return
    }

    onConnect({ idInstance: id, apiTokenInstance, apiUrl: normalizedApiUrl })
  }

  return (
    <main className="login-shell">
      <section className="login-brand" aria-label="Описание приложения">
        <div className="brand-mark brand-mark--large" aria-hidden="true">
          W
        </div>
        <p className="eyebrow">GREEN-API · WHATSAPP</p>
        <h1>Сообщения без лишнего</h1>
        <p className="brand-copy">
          Минималистичный веб-чат для отправки и получения сообщений в WhatsApp.
        </p>
        <div className="brand-orbit" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </section>

      <section className="login-panel">
        <form className="login-card" onSubmit={submit}>
          <div className="mobile-brand">
            <div className="brand-mark">W</div>
            <span>WhatsApp Chat</span>
          </div>
          <p className="eyebrow">Подключение</p>
          <h2>Войдите в свой инстанс</h2>
          <p className="muted">Данные используются только для запросов к GREEN-API.</p>

          <label className="field">
            <span>ID Instance</span>
            <input
              inputMode="numeric"
              autoComplete="off"
              placeholder="3100000000"
              value={idInstance}
              onChange={(event) => setIdInstance(event.target.value)}
            />
          </label>

          <label className="field">
            <span>API Token Instance</span>
            <div className="input-action">
              <input
                type={showToken ? 'text' : 'password'}
                autoComplete="off"
                placeholder="Введите токен"
                value={token}
                onChange={(event) => setToken(event.target.value)}
              />
              <button type="button" onClick={() => setShowToken((value) => !value)}>
                {showToken ? 'Скрыть' : 'Показать'}
              </button>
            </div>
          </label>

          <label className="field">
            <span>API URL</span>
            <input
              type="url"
              inputMode="url"
              autoComplete="url"
              placeholder={DEFAULT_GREEN_API_URL}
              value={apiUrl}
              onChange={(event) => setApiUrl(event.target.value)}
            />
            <small>Оставьте общий адрес или укажите API URL вашего инстанса из кабинета GREEN-API.</small>
          </label>

          {error && <div className="inline-error" role="alert">{error}</div>}

          <button className="primary-button" type="submit">
            Продолжить
            <span aria-hidden="true">→</span>
          </button>

          <p className="privacy-note">Токен не сохраняется в localStorage и не отправляется третьим лицам.</p>
        </form>
      </section>
    </main>
  )
}

function NewChatDialog({
  open,
  loading,
  error,
  onClose,
  onCreate,
}: {
  open: boolean
  loading: boolean
  error: string
  onClose: () => void
  onCreate: (phone: string) => void
}) {
  const [phone, setPhone] = useState('')
  if (!open) return null

  const submit = (event: ReactSubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    onCreate(phone)
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-chat-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button className="icon-button dialog-close" type="button" onClick={onClose} aria-label="Закрыть">
          ×
        </button>
        <div className="dialog-icon" aria-hidden="true">＋</div>
        <h2 id="new-chat-title">Новый чат</h2>
        <p className="muted">Введите номер получателя в международном формате.</p>
        <form onSubmit={submit}>
          <label className="field">
            <span>Номер телефона</span>
            <input
              autoFocus
              inputMode="tel"
              placeholder="+7 999 123-45-67"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </label>
          {error && <div className="inline-error" role="alert">{error}</div>}
          <button className="primary-button" type="submit" disabled={loading}>
            {loading ? <span className="spinner" /> : 'Создать чат'}
          </button>
        </form>
      </section>
    </div>
  )
}

function ChatPage({ credentials, onLogout }: { credentials: Credentials; onLogout: () => void }) {
  const initialChatState = useMemo(
    () => loadChatState(credentials.idInstance),
    [credentials.idInstance],
  )
  const [chats, setChats] = useState<Chat[]>(() => initialChatState.chats)
  const [activeChatId, setActiveChatId] = useState<string | null>(() => initialChatState.activeChatId)
  const [showNewChat, setShowNewChat] = useState(false)
  const [newChatLoading, setNewChatLoading] = useState(false)
  const [newChatError, setNewChatError] = useState('')
  const [composerText, setComposerText] = useState('')
  const [composerError, setComposerError] = useState('')
  const [connectionError, setConnectionError] = useState('')
  const [connected, setConnected] = useState(true)
  const [settingsIssue, setSettingsIssue] = useState(false)
  const [settingsLoading, setSettingsLoading] = useState(false)
  const [settingsNotice, setSettingsNotice] = useState('')
  const [pollingEnabled, setPollingEnabled] = useState(false)
  const seenIds = useRef(new Set(initialChatState.chats.flatMap((chat) => chat.messages.map((message) => message.id))))

  useEffect(() => {
    saveChatState(credentials.idInstance, { chats, activeChatId })
  }, [activeChatId, chats, credentials.idInstance])

  const activeChat = useMemo(
    () => chats.find((chat) => chat.id === activeChatId) ?? null,
    [activeChatId, chats],
  )

  const handleNotification = useCallback((body: NotificationBody) => {
    const outgoingStatus = parseOutgoingStatus(body)
    if (outgoingStatus) {
      const status: MessageStatus =
        outgoingStatus.status === 'read'
          ? 'read'
          : outgoingStatus.status === 'delivered'
            ? 'delivered'
            : outgoingStatus.status === 'sent'
              ? 'sent'
              : 'error'

      setChats((current) =>
        current.map((chat) => ({
          ...chat,
          messages: chat.messages.map((message) =>
            message.id === outgoingStatus.id ? { ...message, status } : message,
          ),
        })),
      )
      return
    }

    const message = parseIncomingText(body)
    if (!message || seenIds.current.has(message.id)) return
    seenIds.current.add(message.id)
    const incomingMessage: Message = {
      id: message.id,
      text: message.text,
      direction: 'incoming',
      timestamp: message.timestamp,
    }

    setChats((current) => {
      let matched = false
      const updated = current.map((chat) => {
        const incomingPhone = normalizePhone(message.chatId.split('@')[0])
        const matchesChat = chat.id === message.chatId || chat.phone === incomingPhone
        if (matchesChat) matched = true

        return matchesChat
          ? {
              ...chat,
              title: chat.title || message.senderName,
              messages: [
                ...chat.messages,
                incomingMessage,
              ],
            }
          : chat
      })

      if (matched) return updated

      const phone = normalizePhone(message.chatId.split('@')[0])
      return [
        ...updated,
        {
          id: message.chatId,
          phone,
          title: message.senderName || formatPhone(phone),
          messages: [
            incomingMessage,
          ],
        },
      ]
    })
    setActiveChatId((current) => current ?? message.chatId)
  }, [])

  const handleConnectionChange = useCallback((value: boolean) => {
    setConnected(value)
    if (value) setConnectionError('')
  }, [])

  const handlePollingError = useCallback((message: string) => {
    setConnectionError(message)
  }, [])

  useNotificationPolling({
    credentials: pollingEnabled ? credentials : null,
    onNotification: handleNotification,
    onConnectionChange: handleConnectionChange,
    onError: handlePollingError,
  })

  useEffect(() => {
    let active = true
    setPollingEnabled(false)

    void getSettings(credentials)
      .then((settings) => {
        if (!active) return
        setSettingsIssue(
            settings.incomingWebhook !== 'yes' ||
            settings.outgoingWebhook !== 'yes' ||
            settings.outgoingAPIMessageWebhook !== 'yes' ||
            settings.outgoingMessageWebhook !== 'yes' ||
            settings.markIncomingMessagesReaded !== 'yes' ||
            Boolean(settings.webhookUrl),
        )
      })
      .catch((error) => {
        if (!active) return
        setSettingsIssue(true)
        setConnectionError(error instanceof Error ? error.message : 'Не удалось проверить настройки инстанса.')
      })
      .finally(() => {
        if (active) setPollingEnabled(true)
      })

    return () => {
      active = false
    }
  }, [credentials])

  const configureReceiving = async () => {
    setSettingsLoading(true)
    setSettingsNotice('')
    setPollingEnabled(false)

    try {
      // Let the active long-poll request abort before calling SetSettings.
      await new Promise((resolve) => window.setTimeout(resolve, 250))
      const result = await enableHttpNotifications(credentials)
      if (!result.saveSettings) throw new Error('GREEN-API не подтвердил сохранение настроек.')
      setSettingsIssue(false)
      setSettingsNotice('Настройки сохранены. Инстанс перезапускается; применение может занять до 5 минут.')
    } catch (error) {
      setSettingsNotice(error instanceof Error ? error.message : 'Не удалось сохранить настройки.')
    } finally {
      setSettingsLoading(false)
      setPollingEnabled(true)
    }
  }

  const createChat = async (rawPhone: string) => {
    const validationError = validateWhatsAppPhone(rawPhone)
    if (validationError) {
      setNewChatError(validationError)
      return
    }

    const phone = normalizePhone(rawPhone)
    setNewChatLoading(true)
    setNewChatError('')

    try {
      const result = await checkWhatsapp(credentials, phone)
      if (!result.existsWhatsapp || !result.chatId) {
        throw new Error(result.reason || 'На этом номере не найден аккаунт WhatsApp.')
      }

      setChats((current) => {
        if (current.some((chat) => chat.id === result.chatId)) return current
        return [
          ...current,
          { id: result.chatId!, phone, title: formatPhone(phone), messages: [] },
        ]
      })
      setActiveChatId(result.chatId)
      setShowNewChat(false)
    } catch (error) {
      setNewChatError(error instanceof Error ? error.message : 'Не удалось создать чат.')
    } finally {
      setNewChatLoading(false)
    }
  }

  const submitMessage = async (event: ReactSubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    const text = composerText.trim()
    if (!activeChat || !text) return

    const localId = `local-${crypto.randomUUID()}`
    const outgoing: Message = {
      id: localId,
      text,
      direction: 'outgoing',
      timestamp: Date.now(),
      status: 'sending',
    }

    setComposerText('')
    setComposerError('')
    setChats((current) =>
      current.map((chat) =>
        chat.id === activeChat.id ? { ...chat, messages: [...chat.messages, outgoing] } : chat,
      ),
    )

    try {
      const response = await sendMessage(credentials, activeChat.id, text)
      setChats((current) =>
        current.map((chat) =>
          chat.id === activeChat.id
            ? {
                ...chat,
                messages: chat.messages.map((message) =>
                  message.id === localId
                    ? { ...message, id: response.idMessage || localId, status: 'sent' }
                    : message,
                ),
              }
            : chat,
        ),
      )
    } catch (error) {
      setComposerError(error instanceof Error ? error.message : 'Не удалось отправить сообщение.')
      setChats((current) =>
        current.map((chat) =>
          chat.id === activeChat.id
            ? {
                ...chat,
                messages: chat.messages.map((message) =>
                  message.id === localId ? { ...message, status: 'error' } : message,
                ),
              }
            : chat,
        ),
      )
    }
  }

  return (
    <main className="app-shell">
      <aside className={`sidebar ${activeChat ? 'sidebar--mobile-hidden' : ''}`}>
        <header className="sidebar-header">
          <div className="app-title">
            <div className="brand-mark">W</div>
            <div>
              <strong>WhatsApp Chat</strong>
              <span>GREEN-API</span>
            </div>
          </div>
          <button className="icon-button" type="button" onClick={onLogout} title="Выйти" aria-label="Выйти">
            ↪
          </button>
        </header>

        <button
          className="new-chat-button"
          type="button"
          onClick={() => {
            setNewChatError('')
            setShowNewChat(true)
          }}
        >
          <span aria-hidden="true">＋</span>
          Новый чат
        </button>

        <div className="chat-list-label">Чаты</div>
        <div className="chat-list">
          {chats.length === 0 ? (
            <div className="sidebar-empty">
              <div aria-hidden="true">✦</div>
              <p>Здесь появятся ваши диалоги</p>
            </div>
          ) : (
            chats.map((chat) => {
              const lastMessage = chat.messages.at(-1)
              return (
                <button
                  className={`chat-list-item ${activeChatId === chat.id ? 'chat-list-item--active' : ''}`}
                  type="button"
                  key={chat.id}
                  onClick={() => setActiveChatId(chat.id)}
                >
                  <span className="avatar avatar--small">{initials(chat.phone)}</span>
                  <span className="chat-list-copy">
                    <strong>{chat.title}</strong>
                    <span>{lastMessage?.text ?? 'Новый диалог'}</span>
                  </span>
                  {lastMessage && <time>{formatTime(lastMessage.timestamp)}</time>}
                </button>
              )
            })
          )}
        </div>

        <footer className="connection-footer">
          <span className={`status-dot ${connected ? '' : 'status-dot--offline'}`} />
          {connected ? 'Подключено к GREEN-API' : 'Переподключение…'}
        </footer>
      </aside>

      <section className={`conversation ${activeChat ? '' : 'conversation--mobile-hidden'}`}>
        {activeChat ? (
          <>
            <header className="conversation-header">
              <button className="mobile-back" type="button" onClick={() => setActiveChatId(null)} aria-label="К списку чатов">‹</button>
              <span className="avatar">{initials(activeChat.phone)}</span>
              <div>
                <strong>{activeChat.title}</strong>
                <span>{formatPhone(activeChat.phone)}</span>
              </div>
              <span className={`header-status ${connected ? '' : 'header-status--error'}`}>
                {connected ? 'онлайн' : 'нет связи'}
              </span>
            </header>

            {settingsIssue && (
              <div className="settings-banner">
                <span>Уведомления о входящих сообщениях или статусах выключены либо настройки не удалось проверить.</span>
                <button type="button" onClick={configureReceiving} disabled={settingsLoading}>
                  {settingsLoading ? 'Сохраняем…' : 'Включить'}
                </button>
              </div>
            )}
            {settingsNotice && <div className="settings-notice">{settingsNotice}</div>}
            {connectionError && <div className="connection-banner">{connectionError}</div>}

            <div className="messages" aria-live="polite">
              <div className="day-divider"><span>Сегодня</span></div>
              {activeChat.messages.length === 0 ? (
                <div className="conversation-empty">
                  <span className="avatar avatar--hero">{initials(activeChat.phone)}</span>
                  <h2>{activeChat.title}</h2>
                  <p>Напишите первое сообщение, чтобы начать диалог.</p>
                </div>
              ) : (
                activeChat.messages.map((message) => (
                  <div
                    className={`message-row message-row--${message.direction}`}
                    key={message.id}
                  >
                    <div className={`message-bubble ${message.status === 'error' ? 'message-bubble--error' : ''}`}>
                      <p>{message.text}</p>
                      <span>
                        {formatTime(message.timestamp)}
                        {message.direction === 'outgoing' && (
                          <i
                            className={message.status === 'read' ? 'message-status--read' : ''}
                            aria-label={
                              message.status === 'error'
                                ? 'Ошибка отправки'
                                : message.status === 'read'
                                  ? 'Прочитано'
                                  : message.status === 'delivered'
                                    ? 'Доставлено'
                                    : 'Отправлено'
                            }
                          >
                            {message.status === 'sending'
                              ? '·'
                              : message.status === 'error'
                                ? '!'
                                : message.status === 'delivered' || message.status === 'read'
                                  ? '✓✓'
                                  : '✓'}
                          </i>
                        )}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <form className="composer" onSubmit={submitMessage}>
              {composerError && <div className="composer-error" role="alert">{composerError}</div>}
              <div className="composer-inner">
                <textarea
                  aria-label="Сообщение"
                  placeholder="Сообщение"
                  rows={1}
                  maxLength={4096}
                  value={composerText}
                  onChange={(event) => setComposerText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault()
                      event.currentTarget.form?.requestSubmit()
                    }
                  }}
                />
                <button className="send-button" type="submit" disabled={!composerText.trim()} aria-label="Отправить">
                  ↑
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="welcome-state">
            <div className="welcome-art" aria-hidden="true">
              <span>✦</span>
              <span>●</span>
              <span>✦</span>
            </div>
            <h2>Ваши сообщения — здесь</h2>
            <p>Выберите существующий диалог или создайте новый чат.</p>
            <button className="secondary-button" type="button" onClick={() => setShowNewChat(true)}>
              Начать общение
            </button>
          </div>
        )}
      </section>

      <NewChatDialog
        open={showNewChat}
        loading={newChatLoading}
        error={newChatError}
        onClose={() => !newChatLoading && setShowNewChat(false)}
        onCreate={createChat}
      />
    </main>
  )
}

export default function App() {
  // Корневая граница приложения: до подключения показываем LoginPage,
  // после подключения передаём учетные данные только в ChatPage и не сохраняем токен.
  const [credentials, setCredentials] = useState<Credentials | null>(null)

  if (!credentials) return <LoginPage onConnect={setCredentials} />
  return <ChatPage credentials={credentials} onLogout={() => setCredentials(null)} />
}
