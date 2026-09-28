import { useEffect, useRef } from 'react'
import { deleteNotification, receiveNotification } from '../api/greenApiClient'
import type { Credentials, NotificationBody } from '../api/types'

interface PollingOptions {
  credentials: Credentials | null
  onNotification: (body: NotificationBody) => void
  onConnectionChange: (connected: boolean) => void
  onError: (message: string) => void
}

export function useNotificationPolling({
  credentials,
  onNotification,
  onConnectionChange,
  onError,
}: PollingOptions) {
  const callbacks = useRef({ onNotification, onConnectionChange, onError })

  useEffect(() => {
    callbacks.current = { onNotification, onConnectionChange, onError }
  }, [onNotification, onConnectionChange, onError])

  useEffect(() => {
    if (!credentials) return

    const controller = new AbortController()
    let active = true
    let retryDelay = 1000

    const poll = async () => {
      while (active) {
        try {
          const notification = await receiveNotification(credentials, controller.signal)
          if (!active) return

          callbacks.current.onConnectionChange(true)
          retryDelay = 1000

          if (notification) {
            callbacks.current.onNotification(notification.body)
            await deleteNotification(credentials, notification.receiptId)
          }
        } catch (error) {
          if (!active || (error instanceof DOMException && error.name === 'AbortError')) return

          callbacks.current.onConnectionChange(false)
          callbacks.current.onError(
            error instanceof Error ? error.message : 'Ошибка получения сообщений.',
          )

          await new Promise((resolve) => window.setTimeout(resolve, retryDelay))
          retryDelay = Math.min(retryDelay * 2, 10_000)
        }
      }
    }

    void poll()

    return () => {
      active = false
      controller.abort()
    }
  }, [credentials])
}
