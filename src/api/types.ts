export interface Credentials {
  idInstance: string
  apiTokenInstance: string
  apiUrl: string
}

export interface CheckWhatsappResponse {
  existsWhatsapp?: boolean
  chatId?: string
  fromCache?: boolean
  username?: string
  phoneNumber?: string
  status?: boolean
  reason?: string
}

export interface SendMessageResponse {
  idMessage: string
}

export interface InstanceSettings {
  webhookUrl?: string
  incomingWebhook?: 'yes' | 'no'
  outgoingWebhook?: 'yes' | 'no'
  outgoingAPIMessageWebhook?: 'yes' | 'no'
  outgoingMessageWebhook?: 'yes' | 'no'
  enableLidMode?: 'yes' | 'no'
  markIncomingMessagesReaded?: 'yes' | 'no'
}

export interface NotificationEnvelope {
  receiptId: number
  body: NotificationBody
}

export interface NotificationBody {
  typeWebhook?: string
  timestamp?: number
  idMessage?: string
  chatId?: string
  status?: 'sent' | 'delivered' | 'read' | 'failed' | 'noAccount' | 'notInGroup'
  sendByApi?: boolean
  senderData?: {
    chatId?: string
    chatName?: string
    senderName?: string
    senderPhoneNumber?: number
  }
  messageData?: {
    typeMessage?: string
    textMessageData?: {
      textMessage?: string
    }
    extendedTextMessageData?: {
      text?: string
    }
  }
}

export interface OutgoingMessageStatus {
  id: string
  chatId?: string
  status: NonNullable<NotificationBody['status']>
}

export interface IncomingTextMessage {
  id: string
  chatId: string
  text: string
  senderName: string
  timestamp: number
}
