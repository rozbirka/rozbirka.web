import { apiClient } from './client'
import type { RequestOptions } from './contracts'
import type { components } from './generated/core'

type Schema = components['schemas']
export type OlxAdvertPage = Schema['OlxAdvertPage']
export type OlxAdvert = Schema['OlxAdvertView']
export type OlxLocalAdvert = Schema['OlxLocalAdvertView']
export type OlxLocalAdvertPage = Schema['OlxLocalAdvertPage']
export type OlxCategory = Schema['OlxCategoryView']
export type OlxAttribute = Schema['OlxAttributeView']
export type OlxCity = Schema['OlxCityView']
export type OlxDistrict = Schema['OlxDistrictView']
export type OlxPreparation = Schema['OlxPreparationView']
export type OlxPrepareContent = Schema['OlxPrepareRequest']
export type OlxPreview = Schema['OlxPreviewView']
export type OlxLivePublication = Schema['OlxLivePublicationView']
export type OlxPublicationJob = Schema['OlxPublicationJobView']
export type StartOlxPublicationJob = Schema['StartOlxPublicationJobRequest']
export type RetryOlxPublicationJob = Schema['RetryOlxPublicationJobRequest']
const live = '/integrations/olx/live'
export const olxLiveApi = {
  async startPublicationJob(
    request: StartOlxPublicationJob,
    options: RequestOptions = {},
  ): Promise<OlxPublicationJob> {
    return (
      await apiClient.post<OlxPublicationJob>(
        `${live}/publication-jobs`,
        request,
        options,
      )
    ).data
  },
  async retryPublicationJob(
    id: string,
    request: RetryOlxPublicationJob,
    options: RequestOptions = {},
  ): Promise<OlxPublicationJob> {
    return (
      await apiClient.post<OlxPublicationJob>(
        `${live}/publication-jobs/${encodeURIComponent(id)}/retry`,
        request,
        options,
      )
    ).data
  },
  async publicationJob(
    id: string,
    options: RequestOptions = {},
  ): Promise<OlxPublicationJob> {
    return (
      await apiClient.get<OlxPublicationJob>(
        `${live}/publication-jobs/${encodeURIComponent(id)}`,
        options,
      )
    ).data
  },
  async publicationJobs(
    options: RequestOptions = {},
  ): Promise<OlxPublicationJob[]> {
    return (
      await apiClient.get<OlxPublicationJob[]>(
        `${live}/publication-jobs`,
        options,
      )
    ).data
  },
  async completeReconciliation(
    accountId: string,
    options: RequestOptions = {},
  ): Promise<Schema['OlxReconciliationView']> {
    const request: Schema['OlxCompleteReconciliationRequest'] = { accountId }
    return (
      await apiClient.post<Schema['OlxReconciliationView']>(
        '/integrations/olx/reconciliation/complete',
        request,
        options,
      )
    ).data
  },
  async publication(
    id: string,
    options: RequestOptions = {},
  ): Promise<OlxLivePublication> {
    return (
      await apiClient.get<OlxLivePublication>(
        `${live}/parts/${encodeURIComponent(id)}/publication`,
        options,
      )
    ).data
  },
  async saveDraft(
    id: string,
    content: OlxPrepareContent,
    expectedRevision: string | null,
    {
      expectedAccountId,
      ...options
    }: RequestOptions & { expectedAccountId?: string } = {},
  ): Promise<OlxLivePublication> {
    const request: Schema['OlxSaveDraftRequest'] = {
      content,
      expectedRevision,
      ...(expectedAccountId ? { expectedAccountId } : {}),
    }
    return (
      await apiClient.put<OlxLivePublication>(
        `${live}/parts/${encodeURIComponent(id)}/draft`,
        request,
        options,
      )
    ).data
  },
  async link(
    id: string,
    advertId: string,
    expectedRevision: string | null,
    {
      expectedAccountId,
      ...options
    }: RequestOptions & { expectedAccountId?: string } = {},
  ): Promise<OlxLivePublication> {
    const request: Schema['OlxLinkAdvertRequest'] = {
      advertId,
      expectedRevision,
      ...(expectedAccountId ? { expectedAccountId } : {}),
    }
    return (
      await apiClient.post<OlxLivePublication>(
        `${live}/parts/${encodeURIComponent(id)}/link`,
        request,
        { ...options, timeout: 60000 },
      )
    ).data
  },
  async publish(
    id: string,
    expectedRevision: string,
    {
      expectedAccountId,
      ...options
    }: RequestOptions & { expectedAccountId?: string } = {},
  ): Promise<OlxLivePublication> {
    const request: Schema['OlxPublishRequest'] = {
      expectedRevision,
      ...(expectedAccountId ? { expectedAccountId } : {}),
    }
    return (
      await apiClient.post<OlxLivePublication>(
        `${live}/parts/${encodeURIComponent(id)}/publish`,
        request,
        { ...options, timeout: 100000 },
      )
    ).data
  },
  async refreshPublication(
    id: string,
    options: RequestOptions = {},
  ): Promise<OlxLivePublication> {
    return (
      await apiClient.post<OlxLivePublication>(
        `${live}/parts/${encodeURIComponent(id)}/refresh`,
        {},
        { ...options, timeout: 100000 },
      )
    ).data
  },
  async remove(
    id: string,
    {
      expectedAccountId,
      expectedAdvertId,
      ...options
    }: RequestOptions & {
      expectedAccountId?: string
      expectedAdvertId?: string
    } = {},
  ): Promise<OlxLivePublication> {
    return (
      await apiClient.post<OlxLivePublication>(
        `${live}/parts/${encodeURIComponent(id)}/remove`,
        {},
        {
          ...options,
          params: { expectedAccountId, expectedAdvertId },
          timeout: 100000,
        },
      )
    ).data
  },
  async setExclusion(
    id: string,
    request: Schema['OlxSetExclusionRequest'],
    options: RequestOptions = {},
  ): Promise<OlxLivePublication> {
    return (
      await apiClient.put<OlxLivePublication>(
        `${live}/parts/${encodeURIComponent(id)}/exclusion`,
        request,
        options,
      )
    ).data
  },
  async restore(
    id: string,
    options: RequestOptions = {},
  ): Promise<OlxLivePublication> {
    return (
      await apiClient.post<OlxLivePublication>(
        `${live}/parts/${encodeURIComponent(id)}/restore`,
        {},
        { ...options, timeout: 100000 },
      )
    ).data
  },
  async city(id: number, options: RequestOptions = {}): Promise<OlxCity> {
    return (
      await apiClient.get<OlxCity>(`${live}/cities/${id}`, {
        ...options,
        timeout: 60000,
      })
    ).data
  },
  async adverts(
    page: number,
    {
      expectedAccountId,
      ...options
    }: RequestOptions & { expectedAccountId?: string } = {},
  ): Promise<OlxAdvertPage> {
    return (
      await apiClient.get<OlxAdvertPage>(`${live}/adverts`, {
        ...options,
        params: { page, expectedAccountId },
        timeout: 45000,
      })
    ).data
  },
  async localAdverts(
    page: number,
    expectedAccountId: string,
    options: RequestOptions = {},
  ): Promise<OlxLocalAdvertPage> {
    return (
      await apiClient.get<OlxLocalAdvertPage>(`${live}/adverts/local`, {
        ...options,
        params: { page, expectedAccountId },
      })
    ).data
  },
  async preparation(
    id: string,
    options: RequestOptions = {},
  ): Promise<OlxPreparation> {
    return (
      await apiClient.get<OlxPreparation>(
        `${live}/parts/${encodeURIComponent(id)}/preparation`,
        { ...options, timeout: 45000 },
      )
    ).data
  },
  async categories(options: RequestOptions = {}): Promise<OlxCategory[]> {
    return (
      await apiClient.get<OlxCategory[]>(`${live}/categories`, {
        ...options,
        timeout: 60000,
      })
    ).data
  },
  async attributes(
    id: number,
    options: RequestOptions = {},
  ): Promise<OlxAttribute[]> {
    return (
      await apiClient.get<OlxAttribute[]>(
        `${live}/categories/${id}/attributes`,
        {
          ...options,
          timeout: 60000,
        },
      )
    ).data
  },
  async cities(
    this: void,
    query: string,
    options: RequestOptions = {},
  ): Promise<OlxCity[]> {
    return (
      await apiClient.get<OlxCity[]>(`${live}/cities`, {
        ...options,
        params: { query },
        timeout: 60000,
      })
    ).data
  },
  async districts(
    id: number,
    options: RequestOptions = {},
  ): Promise<OlxDistrict[]> {
    return (
      await apiClient.get<OlxDistrict[]>(`${live}/cities/${id}/districts`, {
        ...options,
        timeout: 60000,
      })
    ).data
  },
  async preview(
    id: string,
    content: OlxPrepareContent,
    options: RequestOptions = {},
  ): Promise<OlxPreview> {
    return (
      await apiClient.post<OlxPreview>(
        `${live}/parts/${encodeURIComponent(id)}/preview`,
        content,
        { ...options, timeout: 60000 },
      )
    ).data
  },
}
