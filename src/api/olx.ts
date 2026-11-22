import { apiClient } from './client'
import type { RequestOptions } from './contracts'
import type { components } from './generated/core'

export type OlxConnection = components['schemas']['OlxConnectionView']
export type OlxPublication = components['schemas']['OlxPublicationView']
export type OlxContent = components['schemas']['OlxContentRequest']
export type OlxOAuthStart = components['schemas']['OlxOAuthStartView']
const path = (id: string) => `/olx-alpha/parts/${encodeURIComponent(id)}`
export const olxApi = {
  async connection(options: RequestOptions = {}): Promise<OlxConnection> {
    return (
      await apiClient.get<OlxConnection>(
        '/integrations/olx/connection',
        options,
      )
    ).data
  },
  async connect(
    accountId: string,
    options: RequestOptions = {},
  ): Promise<OlxConnection> {
    return (
      await apiClient.post<OlxConnection>(
        '/olx-alpha/connection',
        { accountId },
        options,
      )
    ).data
  },
  async disconnect(options: RequestOptions = {}): Promise<OlxConnection> {
    return (
      await apiClient.delete<OlxConnection>(
        '/integrations/olx/connection',
        options,
      )
    ).data
  },
  async startOAuth(options: RequestOptions = {}): Promise<OlxOAuthStart> {
    return (
      await apiClient.post<OlxOAuthStart>(
        '/integrations/olx/oauth/start',
        {},
        options,
      )
    ).data
  },
  async startWriteOAuth(options: RequestOptions = {}): Promise<OlxOAuthStart> {
    return (
      await apiClient.post<OlxOAuthStart>(
        '/integrations/olx/oauth/write/start',
        {},
        options,
      )
    ).data
  },
  async verifyConnection(options: RequestOptions = {}): Promise<OlxConnection> {
    return (
      await apiClient.post<OlxConnection>(
        '/integrations/olx/verify',
        {},
        options,
      )
    ).data
  },
  async get(id: string, options: RequestOptions = {}): Promise<OlxPublication> {
    return (await apiClient.get<OlxPublication>(path(id), options)).data
  },
  async save(
    id: string,
    content: OlxContent,
    options: RequestOptions = {},
  ): Promise<OlxPublication> {
    return (
      await apiClient.put<OlxPublication>(
        `${path(id)}/content`,
        content,
        options,
      )
    ).data
  },
  async publish(
    id: string,
    options: RequestOptions = {},
  ): Promise<OlxPublication> {
    return (
      await apiClient.post<OlxPublication>(`${path(id)}/publish`, {}, options)
    ).data
  },
  async refresh(
    id: string,
    options: RequestOptions = {},
  ): Promise<OlxPublication> {
    return (
      await apiClient.post<OlxPublication>(`${path(id)}/refresh`, {}, options)
    ).data
  },
  async restore(
    id: string,
    options: RequestOptions = {},
  ): Promise<OlxPublication> {
    return (
      await apiClient.post<OlxPublication>(`${path(id)}/restore`, {}, options)
    ).data
  },
  async exclude(
    id: string,
    excluded: boolean,
    options: RequestOptions = {},
  ): Promise<OlxPublication> {
    return (
      await apiClient.post<OlxPublication>(
        `${path(id)}/exclude?excluded=${excluded}`,
        {},
        options,
      )
    ).data
  },
  async simulate(
    id: string,
    status: string,
    options: RequestOptions = {},
  ): Promise<OlxPublication> {
    return (
      await apiClient.post<OlxPublication>(
        `${path(id)}/simulate`,
        { status },
        options,
      )
    ).data
  },
}

/** Top-level POST lets the callback host set its own HttpOnly cookie across origins. */
export function launchOlxOAuth(start: OlxOAuthStart) {
  if (!start.launchUrl || !start.ticket)
    throw new Error('OLX authorization is unavailable.')
  const url = new URL(start.launchUrl)
  if (
    url.pathname !== '/api/v1/integrations/olx/oauth/launch' ||
    (url.protocol !== 'https:' &&
      !(
        url.protocol === 'http:' &&
        ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
      )) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error('Invalid OLX authorization destination.')
  const form = document.createElement('form')
  form.method = 'POST'
  form.action = url.href
  const ticket = document.createElement('input')
  ticket.type = 'hidden'
  ticket.name = 'ticket'
  ticket.value = start.ticket
  form.append(ticket)
  document.body.append(form)
  try {
    form.submit()
  } finally {
    form.remove()
  }
}
