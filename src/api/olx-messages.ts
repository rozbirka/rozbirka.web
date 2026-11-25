import { isAxiosError } from 'axios'
import { apiClient } from './client'
import type { RequestOptions } from './contracts'
import type { components } from './generated/core'

type Schema = components['schemas']

export type OlxConversation = Schema['OlxConversationView']
export type OlxConversationPage = Schema['OlxConversationPage']
export type OlxConversationHistory = Schema['OlxConversationHistory']
export type OlxConversationMessage = Schema['OlxConversationMessageView']

const threadsPath = '/integrations/olx/live/threads'
const requestTimeout = 45_000

function messagesPath(threadId: string) {
  return `${threadsPath}/${encodeURIComponent(threadId)}/messages`
}

export const olxMessagesApi = {
  async threads(
    page: number,
    expectedAccountId: string,
    options: RequestOptions = {},
  ): Promise<OlxConversationPage> {
    return (
      await apiClient.get<OlxConversationPage>(threadsPath, {
        timeout: requestTimeout,
        ...options,
        params: { page, expectedAccountId },
      })
    ).data
  },
  async history(
    threadId: string,
    expectedAccountId: string,
    options: RequestOptions = {},
  ): Promise<OlxConversationHistory> {
    return (
      await apiClient.get<OlxConversationHistory>(messagesPath(threadId), {
        timeout: requestTimeout,
        ...options,
        params: { expectedAccountId },
      })
    ).data
  },
  async reply(
    threadId: string,
    expectedAccountId: string,
    text: string,
    options: RequestOptions = {},
  ): Promise<Schema['OlxConversationReplyView']> {
    return (
      await apiClient.post<Schema['OlxConversationReplyView']>(
        messagesPath(threadId),
        { expectedAccountId, text },
        { timeout: requestTimeout, ...options },
      )
    ).data
  },
  async markRead(
    threadId: string,
    expectedAccountId: string,
    options: RequestOptions = {},
  ): Promise<Schema['OlxConversationReadView']> {
    return (
      await apiClient.post<Schema['OlxConversationReadView']>(
        `${threadsPath}/${encodeURIComponent(threadId)}/read`,
        { expectedAccountId },
        { timeout: requestTimeout, ...options },
      )
    ).data
  },
  async attachment(
    threadId: string,
    messageId: string,
    attachmentIndex: number,
    expectedAccountId: string,
    options: RequestOptions = {},
  ): Promise<Blob> {
    try {
      return (
        await apiClient.get<Blob>(
          `${messagesPath(threadId)}/${encodeURIComponent(messageId)}/attachments/${attachmentIndex}`,
          {
            timeout: requestTimeout,
            ...options,
            params: { expectedAccountId },
            responseType: 'blob',
          },
        )
      ).data
    } catch (error) {
      // The error envelope is a Blob when Axios is set to download the file.
      if (isAxiosError<unknown>(error) && error.response) {
        const body = error.response.data
        if (
          body instanceof Blob &&
          body.size <= 32 * 1024 &&
          /^(application\/json|application\/problem\+json)(?:;|$)/i.test(
            body.type,
          )
        ) {
          try {
            const decoded: unknown = JSON.parse(await body.text())
            error.response.data = decoded
          } catch {
            // Keep the original HTTP status for an unreadable error envelope.
          }
        }
      }
      throw error
    }
  },
}
